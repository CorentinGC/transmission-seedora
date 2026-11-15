import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isAddressAllowed, isPortAllowed, isValidPort } from './address-policy';
import { OutboundError } from './errors';
import { getAllowedHosts, isListedHost, type AllowedHost } from './env';
import {
  MAX_CONCURRENT_LOOKUPS,
  MAX_CONCURRENT_PER_DESTINATION,
  MAX_IN_FLIGHT_BYTES,
  MAX_QUEUED_LOOKUPS,
  createByteBudget,
  createConcurrencyGate,
  createLookupLimiter,
  destinationKeys,
  type ByteBudget,
  type ConcurrencyGate,
} from './outbound-limits';
import { createSystemResolver, type ResolvedAddress, type Resolver } from './resolver';

export type { ResolvedAddress, Resolver } from './resolver';

/**
 * The only module allowed to contact a caller-influenced destination (ADR 0003).
 * Resolve once, validate every address, then connect to what was validated.
 */

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
  /**
   * Operator allowlist (`SEEDORA_ALLOWED_HOSTS`). When set, `allowPrivate` only applies to the
   * listed hosts: any other host resolving to a private address is HOST_NOT_ALLOWED. Public
   * addresses are never affected. Defaults to the environment.
   */
  allowedHosts?: readonly AllowedHost[] | null;
  /** Identity of the caller, for the per-client DNS lookup cap. */
  clientKey?: string;
  /** One deadline covering DNS, connect and body read. Defaults to 15 s. */
  signal?: AbortSignal;
  authorization?: string;
  sessionId?: string;
  resolver?: Resolver;
  /** Can only lower the 8 MiB cap (the daemon's answer to most methods is a few KB). */
  maxResponseBytes?: number;
  /**
   * Called with the one address the call is about to connect to, after policy passed for all
   * resolved addresses and before each connection: once, or twice when a connection error makes
   * the call retry with the next address (used for the per-address rate limit, so alias names
   * gain nothing and addresses never connected to are not charged). It may
   * throw an `OutboundError` (e.g. RATE_LIMITED) to refuse the call; that error propagates as is.
   */
  onResolved?: (addresses: readonly ResolvedAddress[]) => void;
  /** Process-wide buffered-bytes budget, with a share per destination address. Injectable for tests. */
  byteBudget?: ByteBudget;
  /** Per-address concurrency cap. Injectable for tests. */
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
  clientKey?: string,
): Promise<ResolvedAddress[]> {
  const family = isIP(host);
  let addresses: ResolvedAddress[];
  if (family !== 0) {
    addresses = [{ address: host, family: family === 6 ? 6 : 4 }];
  } else {
    try {
      addresses = await abortable(resolver(host, signal, clientKey), signal);
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

  // The private opt-in holds for this host only if the operator allowlist (when set) lists it.
  const allowedHosts = options.allowedHosts === undefined ? getAllowedHosts() : options.allowedHosts;
  const allowPrivate = options.allowPrivate && (allowedHosts === null || isListedHost(allowedHosts, host, target.port));
  const addresses = await resolveAndValidate(host, allowPrivate, options.resolver ?? systemResolver, signal, options.clientKey);
  const exchange: Exchange = {
    target,
    host,
    payload,
    signal,
    options,
    cap: Math.min(options.maxResponseBytes ?? MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES),
    headers: buildHeaders(payload, options),
  };
  // Every resolved address was validated above. The call connects to one address at a time and all
  // limits are charged to the address actually used: a name listing [attacker, victim] cannot
  // drain the victim's gate, byte budget or rate tokens with calls that never reach the victim.
  const first: Progress = { admitted: false, connected: false };
  try {
    return await sendTo(addresses[0], exchange, first);
  } catch (error) {
    // One retry with the next validated address, only when the TCP connection never came up
    // (nothing was sent) and the shared deadline still runs.
    const next = addresses[1];
    const retryable = error instanceof OutboundError && error.code === 'CONNECTION_FAILED' && first.admitted && !first.connected;
    if (!retryable || next === undefined || signal.aborted) throw error;
    const second: Progress = { admitted: false, connected: false };
    try {
      return await sendTo(next, exchange, second);
    } catch (retryError) {
      // A retry refused before it was admitted (rate limit, gate) leaves the original failure.
      throw second.admitted ? retryError : error;
    }
  }
}

/** Everything one attempt needs besides the address. */
interface Exchange {
  target: OutboundTarget;
  host: string;
  payload: string;
  signal: AbortSignal;
  options: OutboundOptions;
  cap: number;
  headers: Record<string, string | number>;
}

/** What an attempt reached: past the limits, past the TCP handshake. */
interface Progress {
  admitted: boolean;
  connected: boolean;
}

function buildHeaders(payload: string, options: OutboundOptions): Record<string, string | number> {
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (options.authorization) headers.Authorization = options.authorization;
  if (options.sessionId) headers['X-Transmission-Session-Id'] = options.sessionId;
  return headers;
}

/**
 * One exchange pinned to `address`: charges the rate limit, gate and byte budget to that address
 * only, and gives them back when it ends. `progress` tells the caller how far it got.
 */
async function sendTo(address: ResolvedAddress, exchange: Exchange, progress: Progress): Promise<OutboundResponse> {
  const { target, host, payload, signal, options, cap, headers } = exchange;
  const pinned = [address];
  options.onResolved?.(pinned);
  const keys = destinationKeys(pinned);
  const releaseDestination = (options.destinationGate ?? processDestinationGate).tryAcquireAll(keys);
  if (!releaseDestination) throw new OutboundError('RATE_LIMITED');
  progress.admitted = true;
  const budget = options.byteBudget ?? processByteBudget;
  let held = 0;

  return new Promise<OutboundResponse>((resolve, reject) => {
    let settled = false;
    let request: http.ClientRequest | undefined;
    const finish = (error: OutboundError | null, value?: OutboundResponse) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      budget.release(held, keys);
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
        lookup: createPinnedLookup(pinned),
        agent: false,
      });
    } catch {
      finish(new OutboundError('INVALID_INPUT'));
      return;
    }

    request.on('socket', (socket) => {
      if (!socket.connecting) progress.connected = true;
      else {
        socket.once('connect', () => {
          progress.connected = true;
        });
      }
    });
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
        if (!budget.reserve(chunk.length, keys)) {
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
