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

export class TransmissionRpcClient {
  private sessionId = '';
  private readonly baseUrl: string;
  private readonly authHeader?: string;
  private agent?: http.Agent;

  constructor(private readonly config: ServerConfig) {
    const protocol = config.useSSL ? 'https' : 'http';
    const rpcPath = config.path.startsWith('/') ? config.path : `/${config.path}`;
    this.baseUrl = `${protocol}://${config.host}:${config.port}${rpcPath}`;

    if (config.username) {
      const credentials = Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    }

    this.initProxy();
  }

  private initProxy(): void {
    const { proxyType, proxyHost, proxyPort, proxyUsername, proxyPassword } = this.config;
    if (!proxyType || proxyType === 'none' || !proxyHost || !proxyPort) return;

    const proxyAuth = proxyUsername ? `${proxyUsername}:${proxyPassword ?? ''}@` : '';

    if (proxyType === 'http') {
      const proxyUrl = `http://${proxyAuth}${proxyHost}:${proxyPort}`;
      // Dynamic import to avoid bundling issues
      import('https-proxy-agent').then(({ HttpsProxyAgent }) => {
        this.agent = new HttpsProxyAgent(proxyUrl);
      }).catch((err) => {
        console.error('[RPC] Failed to init HTTP proxy:', err);
      });
    } else if (proxyType === 'socks5') {
      const proxyUrl = `socks5://${proxyAuth}${proxyHost}:${proxyPort}`;
      import('socks-proxy-agent').then(({ SocksProxyAgent }) => {
        this.agent = new SocksProxyAgent(proxyUrl);
      }).catch((err) => {
        console.error('[RPC] Failed to init SOCKS5 proxy:', err);
      });
    }
  }

  async request(method: string, args?: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
    const body: RpcRequest = { method };
    if (args) body.arguments = args;

    const response = await this.doFetch(body);

    if (response.status === 409) {
      const newSessionId = response.headers.get('x-transmission-session-id');
      if (newSessionId) {
        this.sessionId = newSessionId;
        return this.doRequest(body);
      }
      throw new Error('Failed to obtain session ID from Transmission');
    }

    return this.parseResponse(response);
  }

  private async doRequest(body: RpcRequest): Promise<Record<string, unknown> | undefined> {
    const response = await this.doFetch(body);

    if (response.status === 409) {
      throw new Error('CSRF session ID rejected after retry');
    }

    return this.parseResponse(response);
  }

  private async doFetch(body: RpcRequest): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['X-Transmission-Session-Id'] = this.sessionId;
    }

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };

    // Node.js fetch supports custom agents via dispatcher (undici)
    // but for proxy agents we use the http/https agent approach
    if (this.agent) {
      // Use node:http/https request with proxy agent
      return this.doFetchWithAgent(headers, JSON.stringify(body));
    }

    return fetch(this.baseUrl, fetchOptions);
  }

  private doFetchWithAgent(headers: Record<string, string>, body: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const requestFn = isHttps ? https.request : http.request;

      const req = requestFn(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            ...headers,
            'Content-Length': Buffer.byteLength(body),
          },
          agent: this.agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value) responseHeaders.set(key, Array.isArray(value) ? value[0] : value);
            }
            resolve(new Response(responseBody, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage ?? '',
              headers: responseHeaders,
            }));
          });
        },
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private async parseResponse(response: Response): Promise<Record<string, unknown> | undefined> {
    if (!response.ok && response.status !== 409) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as RpcResponse;

    if (json.result !== 'success') {
      throw new Error(`RPC error: ${json.result}`);
    }

    return json.arguments;
  }
}
