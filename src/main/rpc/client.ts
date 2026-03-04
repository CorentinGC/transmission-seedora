import type { ServerConfig } from '@shared/types';

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

  constructor(private readonly config: ServerConfig) {
    const protocol = config.useSSL ? 'https' : 'http';
    const rpcPath = config.path.startsWith('/') ? config.path : `/${config.path}`;
    this.baseUrl = `${protocol}://${config.host}:${config.port}${rpcPath}`;

    if (config.username) {
      const credentials = Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
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

    return fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
