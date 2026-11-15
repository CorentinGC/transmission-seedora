import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboundError, type ErrorCode } from './errors';
import { createByteBudget, createConcurrencyGate } from './outbound-limits';
import { postJson, type OutboundTarget, type Resolver } from './outbound';

/** Per-address limits, the operator allowlist and the client key hand-over of `postJson`. */

let server: http.Server;
let port: number;
let pending: http.ServerResponse[] = [];
let respond: (res: http.ServerResponse) => void;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => respond(res));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  pending.forEach((res) => res.end('{}'));
  pending = [];
  respond = (res) => res.end('{}');
});

const target = (over: Partial<OutboundTarget> = {}): OutboundTarget => ({
  host: 'daemon.test',
  port,
  path: '/transmission/rpc',
  useSSL: false,
  ...over,
});
const answering = (...addresses: string[]): Resolver => async () => addresses.map((address) => ({ address, family: 4 as const }));
async function codeOf(promise: Promise<unknown>): Promise<ErrorCode | 'resolved'> {
  try {
    await promise;
  } catch (error) {
    return (error as OutboundError).code;
  }
  return 'resolved';
}

describe('per-address concurrency gate (bth, 9s8)', () => {
  it('a name resolving to [victim, D_i] counts against the victim each time: the 9th call is RATE_LIMITED', async () => {
    const gate = createConcurrencyGate(8);
    respond = (res) => pending.push(res);
    const calls: Promise<unknown>[] = [];
    for (let i = 1; i <= 8; i++) {
      calls.push(postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', `127.0.0.${i + 1}`), destinationGate: gate }));
    }
    await vi.waitFor(() => expect(pending).toHaveLength(8));
    const ninth = postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '127.0.0.10'), destinationGate: gate });
    expect(await codeOf(ninth)).toBe('RATE_LIMITED');
    expect(pending).toHaveLength(8);
    // The refused call took nothing: its other address is free.
    expect(gate.tryAcquire('127.0.0.10')).not.toBeNull();
    pending.forEach((res) => res.end('{}'));
    await Promise.all(calls);
    expect(gate.size()).toBe(1);
  });

  it('alias names for the same address share one cap, and a different address does not', async () => {
    const gate = createConcurrencyGate(1);
    respond = (res) => pending.push(res);
    const first = postJson(target({ host: 'a.test' }), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1'), destinationGate: gate });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(await codeOf(postJson(target({ host: 'b.test' }), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1'), destinationGate: gate }))).toBe('RATE_LIMITED');
    pending.forEach((res) => res.end('{}'));
    await first;
  });

  it('hands the validated addresses to onResolved so callers can rate limit per address', async () => {
    const onResolved = vi.fn(() => { throw new OutboundError('RATE_LIMITED'); });
    expect(await codeOf(postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '127.0.0.2'), onResolved }))).toBe('RATE_LIMITED');
    expect(onResolved).toHaveBeenCalledWith([
      { address: '127.0.0.1', family: 4 },
      { address: '127.0.0.2', family: 4 },
    ]);
  });
});

describe('per-destination byte budget (ick)', () => {
  it('charges the response to the address key and gives it back', async () => {
    const budget = createByteBudget(8 * 1024 * 1024, 1024);
    const reserve = vi.spyOn(budget, 'reserve');
    respond = (res) => res.end('{"ok":true}');
    await postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1'), byteBudget: budget });
    expect(reserve).toHaveBeenCalledWith(expect.any(Number), ['127.0.0.1']);
    expect(budget.inUse()).toBe(0);
    expect(budget.inUseBy('127.0.0.1')).toBe(0);
  });

  it('refuses a body above the destination share with RATE_LIMITED while another destination is unaffected', async () => {
    const budget = createByteBudget(8 * 1024 * 1024, 1024);
    respond = (res) => res.end(' '.repeat(4096) + '{}');
    expect(await codeOf(postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1'), byteBudget: budget }))).toBe('RATE_LIMITED');
    expect(budget.inUse()).toBe(0);
    // Another destination's share is untouched even while 127.0.0.1 is at its limit.
    expect(budget.reserve(1024, ['203.0.113.7'])).toBe(true);
  });
});

describe('operator allowlist (f3u)', () => {
  const stopBeforeSocket = () => vi.fn(() => { throw new OutboundError('RATE_LIMITED'); });
  const call = (host: string, listed: { host: string; port?: number }[] | null, address = '10.0.0.5', onResolved = stopBeforeSocket()) =>
    codeOf(postJson(target({ host }), {}, { allowPrivate: true, allowedHosts: listed, resolver: answering(address), onResolved }));

  it('without a list, the private opt-in applies to every host', async () => {
    expect(await call('nas.lan', null)).toBe('RATE_LIMITED');
  });

  it('an unlisted private host is HOST_NOT_ALLOWED, a listed one passes the address policy', async () => {
    const list = [{ host: 'nas.lan' }];
    expect(await call('other.lan', list)).toBe('HOST_NOT_ALLOWED');
    expect(await call('NAS.lan', list)).toBe('RATE_LIMITED');
  });

  it('matches host:port entries on the port', async () => {
    const list = [{ host: 'nas.lan', port }];
    expect(await call('nas.lan', list)).toBe('RATE_LIMITED');
    expect(await call('nas.lan', [{ host: 'nas.lan', port: port === 9091 ? 9092 : 9091 }])).toBe('HOST_NOT_ALLOWED');
  });

  it('applies to IP literals', async () => {
    expect(await call('10.0.0.5', [{ host: '10.0.0.5' }])).toBe('RATE_LIMITED');
    expect(await call('10.0.0.6', [{ host: '10.0.0.5' }], '10.0.0.6')).toBe('HOST_NOT_ALLOWED');
  });

  it('does not restrict public addresses, and never opens metadata addresses', async () => {
    expect(await call('public.example', [{ host: 'nas.lan' }], '93.184.216.34')).toBe('RATE_LIMITED');
    expect(await call('nas.lan', [{ host: 'nas.lan' }], '169.254.169.254')).toBe('HOST_NOT_ALLOWED');
  });

  it('an empty list denies every private host (nothing is listed)', async () => {
    expect(await call('nas.lan', [])).toBe('HOST_NOT_ALLOWED');
  });
});

describe('client key', () => {
  it('is passed to the resolver for the per-client lookup cap', async () => {
    const resolver = vi.fn(async () => [{ address: '127.0.0.1', family: 4 as const }]);
    respond = (res) => res.end('{}');
    await postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver, clientKey: '203.0.113.9' });
    expect(resolver).toHaveBeenCalledWith('daemon.test', expect.any(AbortSignal), '203.0.113.9');
  });
});
