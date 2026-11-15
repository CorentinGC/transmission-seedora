import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboundError, type ErrorCode } from './errors';
import { postJson, type OutboundTarget } from './outbound';
import { callTransmission } from './transmission';

/** Self-signed TLS behaviour: verification stays on unless the server opted out (ADR 0003). */

let dir: string;
let server: https.Server;
let port: number;
let hits = 0;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'seedora-tls-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=self-signed.invalid',
      '-keyout',
      path.join(dir, 'key.pem'),
      '-out',
      path.join(dir, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  server = https.createServer(
    { key: readFileSync(path.join(dir, 'key.pem')), cert: readFileSync(path.join(dir, 'cert.pem')) },
    (_req, res) => {
      hits += 1;
      res.setHeader('content-type', 'application/json');
      res.end('{"result":"success","arguments":{"ok":true}}');
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

const target = (over: Partial<OutboundTarget> = {}): OutboundTarget => ({
  host: '127.0.0.1',
  port,
  path: '/transmission/rpc',
  useSSL: true,
  ...over,
});
const options = { allowPrivate: true, allowedHosts: null, signal: undefined as AbortSignal | undefined };

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(OutboundError);
    return (error as OutboundError).code;
  }
  throw new Error('expected a rejection');
}

describe('self-signed certificates', () => {
  it('rejects an untrusted certificate by default', async () => {
    expect(await codeOf(postJson(target(), {}, { ...options, signal: AbortSignal.timeout(5000) }))).toBe('TLS_FAILED');
  });

  it('rejects it when the flag is explicitly false', async () => {
    expect(
      await codeOf(postJson(target({ allowSelfSigned: false }), {}, { ...options, signal: AbortSignal.timeout(5000) })),
    ).toBe('TLS_FAILED');
  });

  it('accepts it only when the server opted in', async () => {
    const response = await postJson(
      target({ allowSelfSigned: true }),
      {},
      { ...options, signal: AbortSignal.timeout(5000) },
    );
    expect(response.status).toBe(200);
  });

  it('keeps the address policy: an opted-in target on a private address is still refused, with no connection', async () => {
    const before = hits;
    const code = await codeOf(
      postJson(target({ allowSelfSigned: true }), {}, { allowPrivate: false, allowedHosts: null }),
    );
    expect(code).toBe('HOST_NOT_ALLOWED');
    expect(hits).toBe(before);
  });

  it('keeps resolve-once validation: a name with a denied address among the answers is refused', async () => {
    const resolver = vi.fn(async () => [
      { address: '8.8.8.8', family: 4 as const },
      { address: '169.254.169.254', family: 4 as const },
    ]);
    const code = await codeOf(
      postJson(
        target({ host: 'mixed.example.com', allowSelfSigned: true }),
        {},
        { allowPrivate: true, allowedHosts: null, resolver },
      ),
    );
    expect(code).toBe('HOST_NOT_ALLOWED');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('connects to the pinned address, not to what the name would resolve to later', async () => {
    const resolver = vi.fn(async () => [{ address: '127.0.0.1', family: 4 as const }]);
    const response = await postJson(
      target({ host: 'pinned.example.com', allowSelfSigned: true }),
      {},
      { allowPrivate: true, allowedHosts: null, resolver, signal: AbortSignal.timeout(5000) },
    );
    expect(response.status).toBe(200);
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});

describe('callTransmission with allowSelfSigned', () => {
  const makeBase = () => ({ host: '127.0.0.1', port, path: '/transmission/rpc', useSSL: true });
  const call = { method: 'session-get' as const };
  const common = { allowPrivate: true, allowedHosts: null };

  it('fails with TLS_FAILED by default and succeeds with the opt-in', async () => {
    const base = makeBase();
    expect(await callTransmission(base, call, 5000, common)).toMatchObject({ success: false, code: 'TLS_FAILED' });
    expect(await callTransmission({ ...base, allowSelfSigned: true }, call, 5000, common)).toEqual({
      success: true,
      data: { ok: true },
    });
  });

  it('passes the flag to the outbound layer and never when absent', async () => {
    const base = makeBase();
    const post = vi.fn(async () => ({ status: 200, sessionId: undefined, json: { result: 'success' } }));
    await callTransmission(base, call, 5000, { ...common, post });
    await callTransmission({ ...base, allowSelfSigned: true }, call, 5000, { ...common, post });
    const targets = post.mock.calls.map((c) => (c as unknown as [OutboundTarget])[0].allowSelfSigned);
    expect(targets).toEqual([undefined, true]);
  });
});
