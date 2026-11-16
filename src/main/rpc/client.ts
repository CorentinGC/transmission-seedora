import type { ServerConfig } from '@shared/types';
import http from 'node:http';
import https from 'node:https';

interface RpcRequest {
  method: string;
  arguments?: Record<string, unknown>;
}

interface RpcResponse {
  result: string;
  arguments?: Record<string, unknown>;
}

interface RawResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Default per-request timeout (connect + response). */
export const DEFAULT_RPC_TIMEOUT_MS = 30_000;

/** Maximum accepted RPC response body (8 MiB); larger responses abort the request. */
export const MAX_RPC_RESPONSE_BYTES = 8 * 1024 * 1024;

/** Longest daemon-supplied text echoed into an error message. */
const MAX_DAEMON_TEXT_LENGTH = 120;

/** Reduces daemon-supplied text to printable ASCII, truncated; falls back when nothing is left or it is not a string. */
export function sanitizeDaemonText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  // Bound the work first: the status line can be large.
  const printable = value
    .slice(0, 4096)
    .replace(/[^\x20-\x7e]/g, '')
    .slice(0, MAX_DAEMON_TEXT_LENGTH)
    .trim();
  return printable || fallback;
}

/** Machine-readable failure kind of an RPC transport error. */
export type RpcErrorCode =
  | 'TIMEOUT'
  | 'TLS_UNTRUSTED'
  | 'TLS_EXPIRED'
  | 'TLS_HOSTNAME'
  | 'NETWORK'
  | 'TOO_LARGE'
  /** HTTP 401/403: wrong or missing credentials. */
  | 'AUTH'
  /** Any other non-2xx HTTP status. */
  | 'HTTP_ERROR'
  /** The daemon answered with something that is not a Transmission JSON reply. */
  | 'INVALID_RESPONSE'
  /** The daemon refused the CSRF session id handshake. */
  | 'SESSION'
  /** The daemon replied `result` other than `success`. */
  | 'RPC_FAILURE'
  /** No server is active. */
  | 'NO_CONNECTION';

/** Transport error with a stable `code` and a message that never contains credentials. */
export class RpcError extends Error {
  constructor(
    readonly code: RpcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

const UNTRUSTED_CERT_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

/** Maps a low-level socket/TLS error to an `RpcError` with an actionable message. */
function toRpcError(err: unknown, timeoutMs: number): RpcError {
  if (err instanceof RpcError) return err;
  const code = (err as NodeJS.ErrnoException | undefined)?.code ?? '';
  const name = (err as Error | undefined)?.name ?? '';
  if (name === 'TimeoutError' || name === 'AbortError' || code === 'ETIMEDOUT' || code === 'ABORT_ERR') {
    return new RpcError('TIMEOUT', `Request timed out after ${Math.round(timeoutMs / 1000)}s`);
  }
  if (UNTRUSTED_CERT_CODES.has(code)) {
    return new RpcError(
      'TLS_UNTRUSTED',
      'The server certificate is not trusted (self-signed or unknown issuer). Enable "Accept self-signed certificate" for this server to connect anyway.',
    );
  }
  if (code === 'CERT_HAS_EXPIRED') {
    return new RpcError('TLS_EXPIRED', 'The server certificate has expired.');
  }
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return new RpcError('TLS_HOSTNAME', 'The server certificate does not match the host name.');
  }
  return new RpcError('NETWORK', code ? `Connection failed (${code})` : 'Connection failed');
}

/** Transmission RPC client: session-id handshake, basic auth, optional proxy, timeout, opt-in self-signed TLS. */
export class TransmissionRpcClient {
  private sessionId = '';
  private readonly url: URL;
  private readonly authHeader?: string;
  /** Resolves once the proxy agent (if any) is built; every request awaits it, so none can bypass the proxy. */
  private readonly agentReady: Promise<http.Agent | undefined>;

  constructor(
    private readonly config: ServerConfig,
    private readonly timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
  ) {
    const protocol = config.useSSL ? 'https' : 'http';
    const rpcPath = config.path.startsWith('/') ? config.path : `/${config.path}`;
    this.url = new URL(`${protocol}://${config.host}:${config.port}${rpcPath}`);

    if (config.username) {
      const credentials = Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    }

    this.agentReady = this.initProxy();
    // Surfaced by the first request; keeps an unused client from raising an unhandled rejection.
    this.agentReady.catch(() => undefined);
  }

  private async initProxy(): Promise<http.Agent | undefined> {
    const { proxyType, proxyHost, proxyPort, proxyUsername, proxyPassword } = this.config;
    if (!proxyType || proxyType === 'none' || !proxyHost || !proxyPort) return undefined;

    const proxyAuth = proxyUsername
      ? `${encodeURIComponent(proxyUsername)}:${encodeURIComponent(proxyPassword ?? '')}@`
      : '';
    try {
      if (proxyType === 'http') {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        return new HttpsProxyAgent(`http://${proxyAuth}${proxyHost}:${proxyPort}`);
      }
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      return new SocksProxyAgent(`socks5://${proxyAuth}${proxyHost}:${proxyPort}`);
    } catch {
      // Fail closed: a configured proxy that cannot be built must never be silently bypassed.
      throw new RpcError('NETWORK', `Failed to initialise the ${proxyType} proxy`);
    }
  }

  async request(method: string, args?: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
    const body: RpcRequest = { method };
    if (args) body.arguments = args;

    const response = await this.send(body);

    if (response.status === 409) {
      const newSessionId = response.headers['x-transmission-session-id'];
      if (typeof newSessionId === 'string' && newSessionId) {
        this.sessionId = newSessionId;
        return this.retryOnce(body);
      }
      throw new RpcError('SESSION', 'Failed to obtain session ID from Transmission');
    }

    return this.parseResponse(response);
  }

  private async retryOnce(body: RpcRequest): Promise<Record<string, unknown> | undefined> {
    const response = await this.send(body);

    if (response.status === 409) {
      throw new RpcError('SESSION', 'CSRF session ID rejected after retry');
    }

    return this.parseResponse(response);
  }

  private async send(body: RpcRequest): Promise<RawResponse> {
    const agent = await this.agentReady;
    const payload = JSON.stringify(body);
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (this.sessionId) headers['X-Transmission-Session-Id'] = this.sessionId;
    if (this.authHeader) headers['Authorization'] = this.authHeader;

    const isHttps = this.url.protocol === 'https:';
    const options: https.RequestOptions = {
      hostname: this.url.hostname.replace(/^\[|\]$/g, ''),
      port: this.url.port || (isHttps ? 443 : 80),
      path: this.url.pathname,
      method: 'POST',
      headers,
      agent,
      signal: AbortSignal.timeout(this.timeoutMs),
      ...(isHttps && this.config.allowSelfSigned === true && { rejectUnauthorized: false }),
    };

    const timedOut = () => options.signal?.aborted === true;
    const timeoutError = () => Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    return new Promise<RawResponse>((resolve, reject) => {
      const req = (isHttps ? https : http).request(options, (res) => {
        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RPC_RESPONSE_BYTES) {
            chunks.length = 0;
            reject(new RpcError('TOO_LARGE', 'The daemon response is too large.'));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('error', (err) => reject(toRpcError(timedOut() ? timeoutError() : err, this.timeoutMs)));
        res.on('aborted', () => reject(toRpcError(timedOut() ? timeoutError() : new Error('aborted'), this.timeoutMs)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? '',
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      });
      req.on('error', (err) => reject(toRpcError(err, this.timeoutMs)));
      req.end(payload);
    });
  }

  private parseResponse(response: RawResponse): Record<string, unknown> | undefined {
    if (response.status < 200 || response.status >= 300) {
      const code = response.status === 401 || response.status === 403 ? 'AUTH' : 'HTTP_ERROR';
      throw new RpcError(code, `HTTP ${response.status}: ${sanitizeDaemonText(response.statusText, 'error')}`);
    }

    let json: RpcResponse;
    try {
      json = JSON.parse(response.body) as RpcResponse;
    } catch {
      throw new RpcError('INVALID_RESPONSE', 'Invalid response from Transmission (not JSON)');
    }

    if (json.result !== 'success') {
      throw new RpcError('RPC_FAILURE', `RPC error: ${sanitizeDaemonText(json.result, 'unknown error')}`);
    }

    return json.arguments;
  }
}
