import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const agentUse = vi.hoisted(() => ({ requests: 0, delayMs: 100 }));
vi.mock('https-proxy-agent', async () => {
  const nodeHttp = await import('node:http');
  type AddRequest = (this: http.Agent, req: http.ClientRequest, options: http.RequestOptions) => void;
  const baseAddRequest = (nodeHttp.Agent.prototype as unknown as { addRequest: AddRequest }).addRequest;
  class HttpsProxyAgent extends nodeHttp.Agent {
    constructor(readonly proxyUrl: string) {
      super();
    }
    addRequest(req: http.ClientRequest, options: http.RequestOptions): void {
      agentUse.requests++;
      baseAddRequest.call(this, req, options);
    }
  }
  return new Promise(resolve => setTimeout(() => resolve({ HttpsProxyAgent }), agentUse.delayMs));
});

const { TransmissionRpcClient, RpcError } = await import('./client');
type ServerConfig = import('@shared/types').ServerConfig;

const base: ServerConfig = { id: 's', name: 'n', host: '127.0.0.1', port: 0, path: '/transmission/rpc', useSSL: false };
const ok = JSON.stringify({ result: 'success', arguments: { hello: 'world' } });

const servers: Array<http.Server | https.Server> = [];
const listen = (server: http.Server | https.Server) =>
  new Promise<number>(resolve => {
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
afterEach(() => {
  agentUse.requests = 0;
});
afterAll(() => servers.forEach(s => s.close()));

describe('TransmissionRpcClient', () => {
  it('performs the session-id handshake and sends basic auth', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const port = await listen(
      http.createServer((req, res) => {
        seen.push({ sid: req.headers['x-transmission-session-id'], auth: req.headers.authorization });
        if (!req.headers['x-transmission-session-id']) {
          res.writeHead(409, { 'X-Transmission-Session-Id': 'abc' }).end();
          return;
        }
        res.writeHead(200).end(ok);
      }),
    );
    const client = new TransmissionRpcClient({ ...base, port, username: 'u', password: 'p' });
    expect(await client.request('session-get')).toEqual({ hello: 'world' });
    expect(seen[1].sid).toBe('abc');
    expect(seen[1].auth).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
  });

  it('times out with a clear error when the daemon never answers', async () => {
    const port = await listen(http.createServer(() => undefined));
    const client = new TransmissionRpcClient({ ...base, port }, 150);
    const error = await client.request('session-get').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect((error as InstanceType<typeof RpcError>).code).toBe('TIMEOUT');
    expect((error as Error).message).toMatch(/timed out/i);
  });

  it('reports a refused connection without credentials', async () => {
    const client = new TransmissionRpcClient({ ...base, port: 1, username: 'u', password: 'secret-pw' });
    const error = (await client.request('session-get').catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(RpcError);
    expect(error.message).not.toContain('secret-pw');
  });

  it('routes the very first request through the proxy agent even when it loads slowly', async () => {
    const port = await listen(http.createServer((_req, res) => res.writeHead(200).end(ok)));
    const client = new TransmissionRpcClient({ ...base, port, proxyType: 'http', proxyHost: 'p.example', proxyPort: 3128 });
    await client.request('session-get');
    expect(agentUse.requests).toBe(1);
  });
});

describe('TLS', () => {
  let tlsPort = 0;
  let available = true;

  beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-tls-'));
    try {
      execFileSync(
        'openssl',
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'],
        { cwd: dir, stdio: 'ignore' },
      );
    } catch {
      available = false;
      return;
    }
    const server = https.createServer(
      { key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) },
      (_req, res) => res.writeHead(200).end(ok),
    );
    tlsPort = await listen(server);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a self-signed certificate by default with an actionable message', async () => {
    if (!available) return;
    const client = new TransmissionRpcClient({ ...base, port: tlsPort, useSSL: true });
    const error = (await client.request('session-get').catch((e: unknown) => e)) as InstanceType<typeof RpcError>;
    expect(error).toBeInstanceOf(RpcError);
    expect(error.code).toBe('TLS_UNTRUSTED');
    expect(error.message).toMatch(/self-signed/i);
  });

  it('stays strict when allowSelfSigned is explicitly false', async () => {
    if (!available) return;
    const client = new TransmissionRpcClient({ ...base, port: tlsPort, useSSL: true, allowSelfSigned: false });
    const error = (await client.request('session-get').catch((e: unknown) => e)) as InstanceType<typeof RpcError>;
    expect(error.code).toBe('TLS_UNTRUSTED');
  });

  it('accepts it when the server opts in with allowSelfSigned', async () => {
    if (!available) return;
    const client = new TransmissionRpcClient({ ...base, port: tlsPort, useSSL: true, allowSelfSigned: true });
    expect(await client.request('session-get')).toEqual({ hello: 'world' });
  });

  it('rejects a response body over the size cap with TOO_LARGE and destroys the request', async () => {
    let closed = false;
    const port = await listen(
      http.createServer((req, res) => {
        res.on('close', () => {
          closed = true;
        });
        res.writeHead(200);
        const chunk = Buffer.alloc(1024 * 1024, 'a');
        const timer = setInterval(() => {
          if (res.destroyed) return clearInterval(timer);
          res.write(chunk);
        }, 1);
        req.on('close', () => clearInterval(timer));
      }),
    );
    const client = new TransmissionRpcClient({ ...base, port });
    await expect(client.request('session-get')).rejects.toMatchObject({ name: 'RpcError', code: 'TOO_LARGE' });
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  it('sanitises and truncates a control-character statusText near the parser header limit', async () => {
    const hostile = `${'A'.repeat(50)}\x07\x1b[31m${'\x01'.repeat(8000)}${'B'.repeat(500)}`;
    const server = net.createServer(socket => {
      socket.on('error', () => undefined);
      socket.once('data', () => socket.end(`HTTP/1.1 500 ${hostile}\r\nContent-Length: 0\r\n\r\n`));
    });
    servers.push(server as unknown as http.Server);
    const port = await new Promise<number>(resolve =>
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
    );
    const client = new TransmissionRpcClient({ ...base, port });
    const message = String(await client.request('x').catch((e: Error) => e.message));
    expect(message).toMatch(/^HTTP 500: [\x20-\x7e]*$/);
    expect(message.length).toBeLessThanOrEqual('HTTP 500: '.length + 120);
  });

  it('maps a timeout after the headers were received to TIMEOUT', async () => {
    const port = await listen(
      http.createServer((_req, res) => {
        res.writeHead(200);
        res.write('{');
      }),
    );
    const client = new TransmissionRpcClient({ ...base, port }, 300);
    await expect(client.request('x')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('sanitises a daemon-supplied result string and handles non-string results', async () => {
    const results: unknown[] = ['bad\u0007\u001b[31m\u00e9' + 'x'.repeat(5000), { evil: true }, null];
    const port = await listen(
      http.createServer((_req, res) => {
        res.writeHead(200).end(JSON.stringify({ result: results.shift() }));
      }),
    );
    const client = new TransmissionRpcClient({ ...base, port });
    const first = String(await client.request('x').catch((e: Error) => e.message));
    expect(first).toMatch(/^RPC error: [\x20-\x7e]+$/);
    expect(first.length).toBeLessThanOrEqual('RPC error: '.length + 120);
    expect(await client.request('x').catch((e: Error) => e.message)).toBe('RPC error: unknown error');
    expect(await client.request('x').catch((e: Error) => e.message)).toBe('RPC error: unknown error');
  });

  it('gives every failure a stable code: AUTH, HTTP_ERROR, INVALID_RESPONSE, RPC_FAILURE, SESSION', async () => {
    const replies: Array<(res: http.ServerResponse) => void> = [
      res => res.writeHead(401, 'Unauthorized').end(),
      res => res.writeHead(403, 'Forbidden').end(),
      res => res.writeHead(500, 'Oops').end(),
      res => res.writeHead(200).end('<html>'),
      res => res.writeHead(200).end(JSON.stringify({ result: 'no such method' })),
      res => res.writeHead(409).end(),
    ];
    const port = await listen(http.createServer((_req, res) => replies.shift()?.(res)));
    const client = new TransmissionRpcClient({ ...base, port });
    const codes: unknown[] = [];
    for (let i = 0; i < 6; i++) codes.push(await client.request('x').catch((e: InstanceType<typeof RpcError>) => e.code));
    expect(codes).toEqual(['AUTH', 'AUTH', 'HTTP_ERROR', 'INVALID_RESPONSE', 'RPC_FAILURE', 'SESSION']);
  });
});
