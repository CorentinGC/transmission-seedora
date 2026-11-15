import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RpcError, TransmissionRpcClient } from './client';
import type { ServerConfig } from '@shared/types';

/**
 * 5pr: the self-signed opt-in (`rejectUnauthorized: false`) must still apply to the TLS session with the
 * target when the request goes through an HTTP CONNECT or SOCKS5 proxy, and a strict client must still
 * refuse the certificate through the proxy. Real proxy agents, local proxies, no external network.
 */

const ok = JSON.stringify({ result: 'success', arguments: { hello: 'world' } });
const base: ServerConfig = { id: 's', name: 'n', host: '127.0.0.1', port: 0, path: '/transmission/rpc', useSSL: true };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-proxy-tls-'));
let opensslAvailable = true;
try {
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'],
    { cwd: dir, stdio: 'ignore' },
  );
} catch {
  opensslAvailable = false;
}

const closers: Array<() => void> = [];
const listen = (server: net.Server) =>
  new Promise<number>((resolve) => {
    closers.push(() => server.close());
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

/** Pipes a client socket to a freshly opened upstream socket. */
function tunnel(client: net.Socket, host: string, port: number, onReady: () => void, onFail: () => void) {
  const upstream = net.connect(port, host, () => {
    onReady();
    client.pipe(upstream);
    upstream.pipe(client);
  });
  upstream.on('error', () => {
    onFail();
    client.destroy();
  });
  client.on('error', () => upstream.destroy());
  client.on('close', () => upstream.destroy());
}

function startHttpConnectProxy(connects: string[]) {
  const server = http.createServer();
  server.on('connect', (req, clientSocket) => {
    connects.push(req.url ?? '');
    const [host, port] = (req.url ?? '').split(':');
    tunnel(clientSocket as net.Socket, host, Number(port), () => clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n'), () => undefined);
  });
  return listen(server);
}

/** Minimal SOCKS5 (no authentication, CONNECT only, IPv4 or domain targets). */
function startSocks5Proxy(connects: string[]) {
  const server = net.createServer((client) => {
    client.once('data', () => {
      client.write(Buffer.from([5, 0]));
      client.once('data', (req: Buffer) => {
        let host: string;
        let offset: number;
        if (req[3] === 1) {
          host = Array.from(req.subarray(4, 8)).join('.');
          offset = 8;
        } else {
          const len = req[4];
          host = req.subarray(5, 5 + len).toString();
          offset = 5 + len;
        }
        const port = req.readUInt16BE(offset);
        connects.push(`${host}:${port}`);
        tunnel(client, host, port, () => client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0])), () => undefined);
      });
    });
    client.on('error', () => undefined);
  });
  return listen(server);
}

let targetPort = 0;
let targetRequests = 0;

beforeAll(async () => {
  if (!opensslAvailable) return;
  const server = https.createServer(
    { key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) },
    (_req, res) => {
      targetRequests++;
      res.writeHead(200).end(ok);
    },
  );
  targetPort = await listen(server);
});
afterAll(() => {
  closers.forEach((close) => close());
  fs.rmSync(dir, { recursive: true, force: true });
});

const proxies = [
  { type: 'http' as const, start: startHttpConnectProxy },
  { type: 'socks5' as const, start: startSocks5Proxy },
];

describe.skipIf(!opensslAvailable).each(proxies)('self-signed target through a $type proxy', ({ type, start }) => {
  const config = async (extra: Partial<ServerConfig>) => {
    const connects: string[] = [];
    const proxyPort = await start(connects);
    const client = new TransmissionRpcClient({ ...base, port: targetPort, proxyType: type, proxyHost: '127.0.0.1', proxyPort, ...extra });
    return { client, connects };
  };

  it('reaches the target through the proxy and accepts the certificate when the server opted in', async () => {
    targetRequests = 0;
    const { client, connects } = await config({ allowSelfSigned: true });
    expect(await client.request('session-get')).toEqual({ hello: 'world' });
    expect(connects).toContain(`127.0.0.1:${targetPort}`);
    expect(targetRequests).toBe(1);
  });

  it('still rejects the self-signed certificate by default, and the target sees no request', async () => {
    targetRequests = 0;
    const { client, connects } = await config({});
    const error = (await client.request('session-get').catch((e: unknown) => e)) as RpcError;
    expect(error).toBeInstanceOf(RpcError);
    expect(error.code).toBe('TLS_UNTRUSTED');
    expect(connects.length).toBeGreaterThan(0);
    expect(targetRequests).toBe(0);
  });

  it('stays strict when allowSelfSigned is explicitly false', async () => {
    const { client } = await config({ allowSelfSigned: false });
    const error = (await client.request('session-get').catch((e: unknown) => e)) as RpcError;
    expect(error.code).toBe('TLS_UNTRUSTED');
  });
});
