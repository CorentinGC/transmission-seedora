import { createHmac, randomBytes } from 'node:crypto';
import { getAllowPrivateHosts, getAllowedHosts } from './env';
import { failureFromError } from './action-error';
import { ERROR_MESSAGES, failure, type ErrorCode } from './errors';
import { postJson, type OutboundOptions, type OutboundResponse, type OutboundTarget } from './outbound';
import type { RpcMethod, ServerTarget } from './schemas';

/**
 * The single place that talks to a Transmission daemon (ADR 0004 section 1). Every call goes
 * through `postJson`, so the outbound policy (ADR 0003) always applies. No error, return value
 * or log line carries a credential, a resolved address or `err.message`.
 */

/** Deadline of `testServerConnection`. */
export const TEST_TIMEOUT_MS = 8_000;
/** Deadline of methods where the daemon may itself fetch a remote resource. */
export const LONG_TIMEOUT_MS = 30_000;
/** Deadline of every other method. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Response cap of every method except `torrent-get` (whose answer grows with the torrent list).
 * Their answers are a few KB, so a hostile daemon cannot make them hold much memory.
 */
export const SMALL_RESPONSE_MAX_BYTES = 1024 * 1024;

/** Response cap for an RPC method: the outbound default for `torrent-get`, a small one for the rest. */
export function maxResponseBytesForMethod(method: RpcMethod): number | undefined {
  return method === 'torrent-get' ? undefined : SMALL_RESPONSE_MAX_BYTES;
}

const LONG_METHODS: ReadonlySet<RpcMethod> = new Set(['blocklist-update', 'port-test', 'torrent-add']);

/** Deadline for an RPC method (ADR 0004 section 4). Constants, never caller-supplied. */
export function timeoutForMethod(method: RpcMethod): number {
  return LONG_METHODS.has(method) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/** Number of daemons whose session id is remembered per process. */
export const MAX_CACHED_SESSION_IDS = 256;
const SESSION_ID_PATTERN = /^[\x21-\x7e]{1,256}$/;
const MAX_RPC_ERROR_LENGTH = 200;

/** Result of an action: success with data, or a fixed code and message. */
export type ActionResult<T = unknown> =
  { success: true; data?: T } | { success: false; error: string; code: ErrorCode };

/** Injection points, used by tests. */
export interface TransmissionOptions {
  /** Defaults to `SEEDORA_ALLOW_PRIVATE_HOSTS`. */
  allowPrivate?: boolean;
  /** Defaults to the outbound layer. */
  post?: (target: OutboundTarget, body: unknown, options: OutboundOptions) => Promise<OutboundResponse>;
  /** Defaults to `SEEDORA_ALLOWED_HOSTS`. */
  allowedHosts?: OutboundOptions['allowedHosts'];
  resolver?: OutboundOptions['resolver'];
  /** Identity of the caller, for the per-client DNS lookup cap. */
  clientKey?: string;
  /** Called with the validated addresses before each connection; may throw `OutboundError('RATE_LIMITED')`. */
  onResolved?: OutboundOptions['onResolved'];
  /** Extra abort signal, combined with the deadline. */
  signal?: AbortSignal;
}

// Session ids per daemon. Keys are digests, so neither host nor password is held as a map key.
// Per-process and best effort: a miss only costs one extra 409 round trip.
const sessionIds = new Map<string, string>();
// Per-process random key: the cache key is a keyed digest that is never stored or compared across
// processes, so it cannot be used to test password guesses offline.
const cacheKeySecret = randomBytes(32);

function cacheKey(target: ServerTarget): string {
  const parts = [
    target.useSSL,
    target.allowSelfSigned === true,
    target.host.toLowerCase(),
    target.port,
    target.path,
    target.username ?? '',
    target.password ?? '',
  ];
  return createHmac('sha256', cacheKeySecret).update(JSON.stringify(parts)).digest('hex');
}

function rememberSessionId(key: string, id: string): void {
  sessionIds.delete(key);
  sessionIds.set(key, id);
  while (sessionIds.size > MAX_CACHED_SESSION_IDS) {
    const oldest = sessionIds.keys().next();
    if (oldest.done) break;
    sessionIds.delete(oldest.value);
  }
}

/** Empties the session-id cache. Test helper. */
export function clearSessionIdCache(): void {
  sessionIds.clear();
}

/** Number of cached session ids. Test helper. */
export function sessionIdCacheSize(): number {
  return sessionIds.size;
}

function basicAuth(target: ServerTarget): string | undefined {
  if (!target.username) return undefined;
  return `Basic ${Buffer.from(`${target.username}:${target.password ?? ''}`, 'utf8').toString('base64')}`;
}

function daemonResult(value: unknown): string {
  if (typeof value !== 'string') return ERROR_MESSAGES.RPC_ERROR;
  const printable = value.replace(/[^\x20-\x7e]/g, '').slice(0, MAX_RPC_ERROR_LENGTH);
  return printable || ERROR_MESSAGES.RPC_ERROR;
}

function interpret(response: OutboundResponse): ActionResult {
  if (response.status === 401) return failure('AUTH_FAILED');
  if (response.status < 200 || response.status >= 300) return failure('HTTP_ERROR');
  const json = response.json;
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return failure('HTTP_ERROR');
  const { result, arguments: data } = json as { result?: unknown; arguments?: unknown };
  if (result !== 'success') return { success: false, error: daemonResult(result), code: 'RPC_ERROR' };
  return { success: true, data };
}

/**
 * Sends one RPC call to `target` and maps the outcome to an `ActionResult`.
 * The 409 session-id handshake is retried once, inside the same deadline. Never throws.
 */
export async function callTransmission(
  target: ServerTarget,
  call: { method: RpcMethod; args?: Record<string, unknown> },
  timeoutMs: number,
  options: TransmissionOptions = {},
): Promise<ActionResult> {
  const post = options.post ?? postJson;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const outboundTarget: OutboundTarget = {
    host: target.host,
    port: target.port,
    path: target.path,
    useSSL: target.useSSL,
    allowSelfSigned: target.allowSelfSigned,
  };
  const body: { method: RpcMethod; arguments?: Record<string, unknown> } = { method: call.method };
  if (call.args) body.arguments = call.args;
  const key = cacheKey(target);
  const send = (sessionId: string | undefined) =>
    post(outboundTarget, body, {
      allowPrivate: options.allowPrivate ?? getAllowPrivateHosts(),
      allowedHosts: options.allowedHosts === undefined ? getAllowedHosts() : options.allowedHosts,
      clientKey: options.clientKey,
      onResolved: options.onResolved,
      maxResponseBytes: maxResponseBytesForMethod(call.method),
      signal,
      authorization: basicAuth(target),
      sessionId,
      resolver: options.resolver,
    });

  try {
    let response = await send(sessionIds.get(key));
    if (response.status === 409) {
      const fresh = response.sessionId;
      if (!fresh || !SESSION_ID_PATTERN.test(fresh)) return failure('SESSION_ID_REJECTED');
      rememberSessionId(key, fresh);
      response = await send(fresh);
      if (response.status === 409) {
        sessionIds.delete(key);
        return failure('SESSION_ID_REJECTED');
      }
    }
    return interpret(response);
  } catch (error) {
    return failureFromError(error);
  }
}
