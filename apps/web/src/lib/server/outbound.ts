import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isAddressAllowed, isPortAllowed, isValidPort } from './address-policy';
import { OutboundError } from './errors';
import {
  MAX_CONCURRENT_LOOKUPS,
  MAX_CONCURRENT_PER_DESTINATION,
  MAX_IN_FLIGHT_BYTES,
  MAX_QUEUED_LOOKUPS,
  createByteBudget,
  createConcurrencyGate,
  createLookupLimiter,
  type ByteBudget,
  type ConcurrencyGate,
  type LookupLimiter,
} from './outbound-limits';

/**
 * The only module allowed to contact a caller-influenced destination (ADR 0003).
 * Resolve once, validate every address, then connect to what was validated.
 */

/** One resolved address. */
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** Resolves a host name to all its addresses. Injectable for tests; the default uses the system resolver. */
export type Resolver = (host: string, signal?: AbortSignal) => Promise<ResolvedAddress[]>;

/** Where to POST. */
export interface OutboundTarget {
  host: string;
  port: number;
  path: string;
  useSSL: boolean;
}

/** Server-built request headers; callers cannot name arbitrary headers. */
export interface OutboundOptions {
  /** Opt-in for loopback/private/link-local/CGNAT/ULA. Metadata and unspecified stay denied. */
  allowPrivate: boolean;
  /** One deadline covering DNS, connect and body read. Defaults to 15 s. */
  signal?: AbortSignal;
  authorization?: string;
  sessionId?: string;
  resolver?: Resolver;
  /** Can only lower the 8 MiB cap. */
  maxResponseBytes?: number;
  /**
   * Called with the validated addresses after policy passes and before any connection. It may
   * throw an `OutboundError` (e.g. RATE_LIMITED) to refuse the call; that error propagates as is.
   */
  onResolved?: (addresses: readonly ResolvedAddress[]) => void;
  /** Process-wide buffered-bytes budget. Injectable for tests. */
  byteBudget?: ByteBudget;
  /** Per-destination concurrency cap. Injectable for tests. */
  destinationGate?: ConcurrencyGate;
}

/** Response of a completed exchange. `json` is undefined when the body is not valid JSON. */
export interface OutboundResponse {
  status: number;
  sessionId: string | undefined;
  json: unknown;
}

export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const processByteBudget = createByteBudget(MAX_IN_FLIGHT_BYTES);
const processDestinationGate = createConcurrencyGate(MAX_CONCURRENT_PER_DESTINATION);
const DEFAULT_TIMEOUT_MS = 15_000;
const HOST_PATTERN = /^[A-Za-z0-9.:-]+$/;
const PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/;
const HEADER_VALUE_PATTERN = /^[\x20-\x7e]*$/;
const TLS_CODES = /^(ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_|HOSTNAME_MISMATCH|ERR_CERT)/;

type DnsLookup = (host: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

/**
 * Builds a resolver on `getaddrinfo`. It cannot be cancelled and runs on libuv's small thread
 * pool, so lookups are capped (a slow answer holds its slot until it really returns) and the
 * wait for a slot honours the request deadline. c-ares was rejected: it ignores /etc/hosts.
 */
export function createSystemResolver(lookup: DnsLookup, limiter: LookupLimiter): Resolver {
  return async (host, signal = new AbortController().signal) => {
    const results = await limiter.run(() => lookup(host, { all: true, verbatim: true }), signal);
    return results.map(({ address, family }) => ({ address, family: family === 6 ? 6 : 4 }));
  };
}

const systemResolver = createSystemResolver(dnsLookup, createLookupLimiter(MAX_CONCURRENT_LOOKUPS, MAX_QUEUED_LOOKUPS));

/** Rejects with TIMEOUT as soon as the signal aborts, without waiting for `promise`. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new OutboundError('TIMEOUT'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Checks the shape of target and headers before any DNS or socket activity. */
function validateInput(target: OutboundTarget, options: OutboundOptions): string {
  const host = target.host.startsWith('[') && target.host.endsWith(']') ? target.host.slice(1, -1) : target.host;
  if (host.length === 0 || host.length > 253 || !HOST_PATTERN.test(host)) throw new OutboundError('INVALID_INPUT');
  if (!isValidPort(target.port) || !PATH_PATTERN.test(target.path) || target.path.length > 256) {
    throw new OutboundError('INVALID_INPUT');
  }
  for (const value of [options.authorization, options.sessionId]) {
    if (value !== undefined && !HEADER_VALUE_PATTERN.test(value)) throw new OutboundError('INVALID_INPUT');
  }
  if (!isPortAllowed(target.port)) throw new OutboundError('HOST_NOT_ALLOWED');
  return host;
}

/**
 * Resolves `host` once and returns the validated addresses. An IP literal is its own only candidate.
 * Throws HOST_NOT_ALLOWED if ANY address is denied (mixed answers are refused, never filtered).
 */
export async function resolveAndValidate(
  host: string,
  allowPrivate: boolean,
  resolver: Resolver,
  signal: AbortSignal,
): Promise<ResolvedAddress[]> {
  const family = isIP(host);
  let addresses: ResolvedAddress[];
  if (family !== 0) {
    addresses = [{ address: host, family: family === 6 ? 6 : 4 }];
  } else {
    try {
      addresses = await abortable(resolver(host, signal), signal);
    } catch (error) {
      if (error instanceof OutboundError) throw error;
      throw new OutboundError('DNS_FAILED');
    }
  }
  if (addresses.length === 0) throw new OutboundError('DNS_FAILED');
  if (!addresses.every(({ address }) => isAddressAllowed(address, allowPrivate))) {
    throw new OutboundError('HOST_NOT_ALLOWED');
  }
  return addresses;
}

/** Builds a `lookup` that answers from the validated addresses only, in both the `all` and single shapes. */
export function createPinnedLookup(addresses: readonly ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const wanted = typeof options === 'object' && options !== null ? options.family : undefined;
    const all = typeof options === 'object' && options !== null && options.all === true;
    const family = wanted === 'IPv4' ? 4 : wanted === 'IPv6' ? 6 : wanted;
    const candidates = addresses.filter((a) => family === undefined || family === 0 || a.family === family);
    if (candidates.length === 0) {
      const error: NodeJS.ErrnoException = new Error('no validated address');
      error.code = 'ENOTFOUND';
      (callback as (e: NodeJS.ErrnoException) => void)(error);
      return;
    }
    if (all) {
      (callback as unknown as (e: null, a: ResolvedAddress[]) => void)(null, candidates.map((a) => ({ ...a })));
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

/** JSON-encodes the body; BigInt, cycles and other unserialisable values become INVALID_INPUT. */
function serialise(body: unknown): string {
  let payload: string | undefined;
  try {
    payload = JSON.stringify(body);
  } catch {
    throw new OutboundError('INVALID_INPUT');
  }
  if (typeof payload !== 'string') throw new OutboundError('INVALID_INPUT');
  return payload;
}

function mapTransportError(error: unknown): OutboundError {
  if (error instanceof OutboundError) return error;
  const code = typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new OutboundError('DNS_FAILED');
  if (typeof code === 'string' && TLS_CODES.test(code)) return new OutboundError('TLS_FAILED');
  return new OutboundError('CONNECTION_FAILED');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * POSTs `body` as JSON to `target` under the outbound policy.
 * Non-2xx statuses are returned (the 409 session-id handshake needs them); policy, transport,
 * 3xx, timeout and size failures throw an `OutboundError` carrying only a fixed code.
 */
export async function postJson(
  target: OutboundTarget,
  body: unknown,
  options: OutboundOptions,
): Promise<OutboundResponse> {
  const host = validateInput(target, options);
  const payload = serialise(body);
  const signal = options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (signal.aborted) throw new OutboundError('TIMEOUT');

  const addresses = await resolveAndValidate(host, options.allowPrivate, options.resolver ?? systemResolver, signal);
  options.onResolved?.(addresses);
  const destination = `${addresses.map((a) => a.address).sort().join(',')}|${target.port}`;
  const releaseDestination = (options.destinationGate ?? processDestinationGate).tryAcquire(destination);
  if (!releaseDestination) throw new OutboundError('RATE_LIMITED');
  const budget = options.byteBudget ?? processByteBudget;
  let held = 0;
  const cap = Math.min(options.maxResponseBytes ?? MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES);
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (options.authorization) headers.Authorization = options.authorization;
  if (options.sessionId) headers['X-Transmission-Session-Id'] = options.sessionId;

  return new Promise<OutboundResponse>((resolve, reject) => {
    let settled = false;
    let request: http.ClientRequest | undefined;
    const finish = (error: OutboundError | null, value?: OutboundResponse) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      budget.release(held);
      held = 0;
      releaseDestination();
      if (error) {
        request?.destroy();
        reject(error);
      } else {
        resolve(value as OutboundResponse);
      }
    };
    const onAbort = () => finish(new OutboundError('TIMEOUT'));
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const send = target.useSSL ? https.request : http.request;
      request = send({
        host,
        port: target.port,
        path: target.path,
        method: 'POST',
        headers,
        lookup: createPinnedLookup(addresses),
        agent: false,
      });
    } catch {
      finish(new OutboundError('INVALID_INPUT'));
      return;
    }

    request.on('error', (error) => finish(mapTransportError(error)));
    request.on('response', (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.resume();
        finish(new OutboundError('UNEXPECTED_REDIRECT'));
        return;
      }
      const declared = Number(response.headers['content-length']);
      if (Number.isFinite(declared) && declared > cap) {
        finish(new OutboundError('RESPONSE_TOO_LARGE'));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        if (settled) return;
        received += chunk.length;
        if (received > cap) {
          finish(new OutboundError('RESPONSE_TOO_LARGE'));
          return;
        }
        if (!budget.reserve(chunk.length)) {
          finish(new OutboundError('RATE_LIMITED'));
          return;
        }
        held += chunk.length;
        chunks.push(chunk);
      });
      response.on('error', (error) => finish(mapTransportError(error)));
      response.on('aborted', () => finish(new OutboundError('CONNECTION_FAILED')));
      response.on('end', () => {
        const header = response.headers['x-transmission-session-id'];
        finish(null, {
          status,
          sessionId: typeof header === 'string' ? header : undefined,
          json: parseJson(Buffer.concat(chunks).toString('utf8')),
        });
      });
    });
    request.end(payload);
  });
}
