'use server';

import { getActiveServerFromCookie } from './session';

interface RpcRequest {
  method: string;
  arguments?: Record<string, unknown>;
}

interface RpcResponse {
  result: string;
  arguments?: Record<string, unknown>;
}

// Per-server session IDs (in-memory, per serverless instance)
const sessionIds = new Map<string, string>();

function getServerKey(config: { host?: string; port?: number; path?: string }): string {
  return `${config.host}:${config.port}${config.path}`;
}

async function doFetch(
  baseUrl: string,
  body: RpcRequest,
  sessionId: string,
  authHeader?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['X-Transmission-Session-Id'] = sessionId;
  if (authHeader) headers['Authorization'] = authHeader;

  return fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

export async function rpcRequest(
  method: string,
  args?: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const config = await getActiveServerFromCookie();
  if (!config || !config.host || !config.port) {
    return { success: false, error: 'No active server configured' };
  }

  const protocol = config.useSSL ? 'https' : 'http';
  const rpcPath = config.path?.startsWith('/') ? config.path : `/${config.path ?? 'transmission/rpc'}`;
  const baseUrl = `${protocol}://${config.host}:${config.port}${rpcPath}`;

  const authHeader = config.username
    ? `Basic ${Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64')}`
    : undefined;

  const serverKey = getServerKey(config);
  const body: RpcRequest = { method };
  if (args) body.arguments = args;

  try {
    let response = await doFetch(baseUrl, body, sessionIds.get(serverKey) ?? '', authHeader);

    // CSRF 409 retry
    if (response.status === 409) {
      const newSessionId = response.headers.get('x-transmission-session-id');
      if (newSessionId) {
        sessionIds.set(serverKey, newSessionId);
        response = await doFetch(baseUrl, body, newSessionId, authHeader);
        if (response.status === 409) {
          return { success: false, error: 'CSRF session ID rejected after retry' };
        }
      } else {
        return { success: false, error: 'Failed to obtain session ID from Transmission' };
      }
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const json = (await response.json()) as RpcResponse;
    if (json.result !== 'success') {
      return { success: false, error: `RPC error: ${json.result}` };
    }

    return { success: true, data: json.arguments };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Test connection to a server without saving it
export async function testServerConnection(config: {
  host: string;
  port: number;
  path: string;
  useSSL: boolean;
  username?: string;
  password?: string;
}): Promise<{ success: boolean; error?: string }> {
  const protocol = config.useSSL ? 'https' : 'http';
  const rpcPath = config.path.startsWith('/') ? config.path : `/${config.path}`;
  const baseUrl = `${protocol}://${config.host}:${config.port}${rpcPath}`;

  const authHeader = config.username
    ? `Basic ${Buffer.from(`${config.username}:${config.password ?? ''}`).toString('base64')}`
    : undefined;

  const body: RpcRequest = { method: 'session-get', arguments: { fields: ['version'] } };

  try {
    let response = await doFetch(baseUrl, body, '', authHeader);

    if (response.status === 409) {
      const sessionId = response.headers.get('x-transmission-session-id');
      if (sessionId) {
        response = await doFetch(baseUrl, body, sessionId, authHeader);
      }
    }

    if (response.status === 401) {
      return { success: false, error: 'Authentication failed' };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const json = (await response.json()) as RpcResponse;
    return json.result === 'success'
      ? { success: true }
      : { success: false, error: json.result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}
