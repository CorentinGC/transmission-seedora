import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboundError, type ErrorCode } from './errors';
import { createByteBudget, createConcurrencyGate, destinationKeys } from './outbound-limits';
import { postJson, type OutboundTarget, type ResolvedAddress, type Resolver } from './outbound';

/** Per-address limits, the operator allowlist and the client key hand-over of `postJson`. */

let server: http.Server;
let port: number;
let pending: http.ServerResponse[] = [];
let respond: (res: http.ServerResponse) => void;
let requestsSeen = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    requestsSeen += 1;
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
  requestsSeen = 0;
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
  it('a name resolving to [A, B] charges the gate only to the one address it connects to (rkp)', async () => {
    const gate = createConcurrencyGate(1);
    respond = (res) => pending.push(res);
    const call = postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '127.0.0.2'), destinationGate: gate });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(gate.tryAcquire('127.0.0.1')).toBeNull();
    expect(gate.tryAcquire('127.0.0.2')).not.toBeNull();
    pending.forEach((res) => res.end('{}'));
    await call;
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

  it('hands only the pinned address to onResolved, so the rate limit charges the address actually used (rkp)', async () => {
    const onResolved = vi.fn(() => { throw new OutboundError('RATE_LIMITED'); });
    expect(await codeOf(postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '127.0.0.2'), onResolved }))).toBe('RATE_LIMITED');
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith([{ address: '127.0.0.1', family: 4 }]);
  });

  it('still refuses the whole call when any resolved address is forbidden, even one it would not connect to', async () => {
    expect(await codeOf(postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '169.254.169.254') }))).toBe('HOST_NOT_ALLOWED');
  });
});

describe('one retry on a connection error (fallback address)', () => {
  const closed: ResolvedAddress = { address: '::1', family: 6 };
  const live: ResolvedAddress = { address: '127.0.0.1', family: 4 };
  const resolving = (...addresses: ResolvedAddress[]): Resolver => async () => addresses;
  const options = (resolver: Resolver, extra: Partial<Parameters<typeof postJson>[2]> = {}) => ({
    allowPrivate: true,
    allowedHosts: null,
    resolver,
    ...extra,
  });

  it('connects to the next validated address when the first refuses the connection, and releases the first', async () => {
    const gate = createConcurrencyGate(1);
    const budget = createByteBudget(8 * 1024 * 1024);
    const onResolved = vi.fn();
    const result = await postJson(target(), {}, options(resolving(closed, live), { destinationGate: gate, byteBudget: budget, onResolved }));
    expect(result.status).toBe(200);
    expect(onResolved.mock.calls).toEqual([[[closed]], [[live]]]);
    expect(gate.tryAcquire(destinationKeys([closed])[0])).not.toBeNull();
    expect(gate.tryAcquire(destinationKeys([live])[0])).not.toBeNull();
    expect(budget.inUse()).toBe(0);
  });

  it('holds only the address in use: the first address is free while the second is being served', async () => {
    const gate = createConcurrencyGate(1);
    respond = (res) => pending.push(res);
    const call = postJson(target(), {}, options(resolving(closed, live), { destinationGate: gate }));
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(gate.tryAcquire(destinationKeys([closed])[0])).not.toBeNull();
    expect(gate.tryAcquire(destinationKeys([live])[0])).toBeNull();
    pending.forEach((res) => res.end('{}'));
    await call;
  });

  it('still refuses the whole call before any connect when the second address is forbidden', async () => {
    const onResolved = vi.fn();
    const forbidden: ResolvedAddress = { address: '169.254.169.254', family: 4 };
    expect(await codeOf(postJson(target(), {}, options(resolving(closed, forbidden), { onResolved })))).toBe('HOST_NOT_ALLOWED');
    expect(onResolved).not.toHaveBeenCalled();
    expect(requestsSeen).toBe(0);
  });

  it('retries at most once: a third address is never tried', async () => {
    const onResolved = vi.fn();
    const gate = createConcurrencyGate(1);
    expect(await codeOf(postJson(target(), {}, options(resolving(closed, closed, live), { onResolved, destinationGate: gate })))).toBe('CONNECTION_FAILED');
    expect(onResolved).toHaveBeenCalledTimes(2);
    expect(requestsSeen).toBe(0);
    expect(gate.tryAcquire(destinationKeys([closed])[0])).not.toBeNull();
  });

  it('does not retry once the request was sent (connection reset after connect)', async () => {
    const onResolved = vi.fn();
    respond = (res) => res.socket?.destroy();
    expect(await codeOf(postJson(target(), {}, options(resolving(live, live), { onResolved })))).toBe('CONNECTION_FAILED');
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(requestsSeen).toBe(1);
  });

  it('does not retry on an HTTP status', async () => {
    const onResolved = vi.fn();
    respond = (res) => {
      res.statusCode = 500;
      res.end('{}');
    };
    const result = await postJson(target(), {}, options(resolving(live, live), { onResolved }));
    expect(result.status).toBe(500);
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(requestsSeen).toBe(1);
  });

  it('reports the connection failure when the retry itself is refused by the rate limit', async () => {
    const onResolved = vi.fn().mockImplementationOnce(() => undefined).mockImplementationOnce(() => {
      throw new OutboundError('RATE_LIMITED');
    });
    expect(await codeOf(postJson(target(), {}, options(resolving(closed, live), { onResolved })))).toBe('CONNECTION_FAILED');
    expect(requestsSeen).toBe(0);
  });

  it('does not retry after the overall deadline has passed', async () => {
    const onResolved = vi.fn();
    const controller = new AbortController();
    controller.abort();
    expect(await codeOf(postJson(target(), {}, options(resolving(closed, live), { onResolved, signal: controller.signal })))).toBe('TIMEOUT');
    expect(onResolved).not.toHaveBeenCalled();
  });
});

describe('per-destination byte budget (ick)', () => {
  it('a name resolving to [A, B] with A streaming leaves B untouched (rkp)', async () => {
    const budget = createByteBudget(32 * 1024 * 1024);
    const gate = createConcurrencyGate(8);
    respond = (res) => {
      res.write(' '.repeat(2048));
      pending.push(res);
    };
    const call = postJson(target(), {}, { allowPrivate: true, allowedHosts: null, resolver: answering('127.0.0.1', '127.0.0.2'), byteBudget: budget, destinationGate: gate });
    await vi.waitFor(() => expect(budget.inUseBy('127.0.0.1')).toBeGreaterThan(0));
    expect(budget.inUseBy('127.0.0.2')).toBe(0);
    expect(gate.tryAcquire('127.0.0.2')).not.toBeNull();
    expect(budget.reserve(16 * 1024 * 1024, ['127.0.0.2'])).toBe(true);
    pending.forEach((res) => res.end('{}'));
    await call;
  });

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
