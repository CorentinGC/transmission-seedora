import { describe, expect, it, vi } from 'vitest';
import { OutboundError } from './errors';
import {
  createByteBudget,
  createConcurrencyGate,
  createLookupLimiter,
  destinationKey,
  destinationKeys,
} from './outbound-limits';
import { MAX_SLOT_WAITERS_PER_CLIENT, NEGATIVE_CACHE_TTL_MS, createSystemResolver } from './resolver';

/** A promise settled from outside. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as OutboundError).code;
  }
  return 'resolved';
};

describe('createByteBudget', () => {
  it('refuses what does not fit and takes nothing in that case', () => {
    const budget = createByteBudget(10);
    expect(budget.reserve(6)).toBe(true);
    expect(budget.reserve(5)).toBe(false);
    expect(budget.inUse()).toBe(6);
    budget.release(6);
    expect(budget.reserve(10)).toBe(true);
  });

  it('never goes negative on a double release', () => {
    const budget = createByteBudget(10);
    budget.release(5);
    expect(budget.inUse()).toBe(0);
  });
});

describe('per-destination byte budget (ick)', () => {
  const MiB = 1024 * 1024;

  it('defaults a destination to a quarter of the global budget', () => {
    const budget = createByteBudget(32 * MiB);
    expect(budget.reserve(8 * MiB, ['a'])).toBe(true);
    expect(budget.reserve(1, ['a'])).toBe(false);
    expect(budget.inUseBy('a')).toBe(8 * MiB);
  });

  it('destination A holding 4 x 8 MiB of demand does not block destination B', () => {
    const budget = createByteBudget(32 * MiB);
    const grants = [1, 2, 3, 4].map(() => budget.reserve(8 * MiB, ['a']));
    expect(grants).toEqual([true, false, false, false]);
    expect(budget.reserve(8 * MiB, ['b'])).toBe(true);
    expect(budget.reserve(8 * MiB, ['c'])).toBe(true);
    expect(budget.inUse()).toBe(24 * MiB);
  });

  it('still honours the global limit across many destinations', () => {
    const budget = createByteBudget(32 * MiB);
    for (const key of ['a', 'b', 'c', 'd']) expect(budget.reserve(8 * MiB, [key])).toBe(true);
    expect(budget.reserve(1, ['e'])).toBe(false);
  });

  it('charges every key of a multi-address call, refuses when any is full, and takes nothing then', () => {
    const budget = createByteBudget(32 * MiB);
    expect(budget.reserve(8 * MiB, ['victim'])).toBe(true);
    expect(budget.reserve(MiB, ['attacker', 'victim'])).toBe(false);
    expect(budget.inUseBy('attacker')).toBe(0);
    expect(budget.inUse()).toBe(8 * MiB);
  });

  it('releases what it reserved, per key, and forgets empty keys', () => {
    const budget = createByteBudget(32 * MiB);
    budget.reserve(5, ['a', 'b']);
    budget.release(5, ['a', 'b']);
    expect(budget.inUse()).toBe(0);
    expect(budget.inUseBy('a')).toBe(0);
  });
});

describe('destinationKey', () => {
  it('maps IPv4-mapped to IPv4 and groups IPv6 by /64', () => {
    expect(destinationKey('1.2.3.4')).toBe('1.2.3.4');
    expect(destinationKey('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(destinationKey('2606:4700:1:2:aaaa::1')).toBe(destinationKey('2606:4700:1:2:bbbb::9'));
    expect(destinationKey('2606:4700:1:2::1')).not.toBe(destinationKey('2606:4700:1:3::1'));
  });

  it('dedupes keys of a multi-address answer', () => {
    expect(destinationKeys([{ address: '2606:4700:1:2::1' }, { address: '2606:4700:1:2::2' }, { address: '1.1.1.1' }])).toHaveLength(2);
  });
});

describe('createConcurrencyGate', () => {
  it('caps holders per key, independently per key, and release is one-shot', () => {
    const gate = createConcurrencyGate(2);
    const a1 = gate.tryAcquire('a');
    const a2 = gate.tryAcquire('a');
    expect(gate.tryAcquire('a')).toBeNull();
    expect(gate.tryAcquire('b')).not.toBeNull();
    a1?.();
    a1?.();
    expect(gate.tryAcquire('a')).not.toBeNull();
    expect(gate.tryAcquire('a')).toBeNull();
    a2?.();
  });

  it('tryAcquireAll takes a slot on every key or none, and its release is one-shot', () => {
    const gate = createConcurrencyGate(1);
    const held = gate.tryAcquire('victim');
    expect(gate.tryAcquireAll(['x', 'victim'])).toBeNull();
    expect(gate.size()).toBe(1);
    held?.();
    const both = gate.tryAcquireAll(['x', 'victim', 'x']);
    expect(both).not.toBeNull();
    expect(gate.size()).toBe(2);
    both?.();
    both?.();
    expect(gate.size()).toBe(0);
  });

  it('forgets keys without holders', () => {
    const gate = createConcurrencyGate(1);
    gate.tryAcquire('a')?.();
    expect(gate.size()).toBe(0);
  });
});

describe('createLookupLimiter', () => {
  it('runs at most maxActive tasks and queues the rest in order', async () => {
    const limiter = createLookupLimiter(2, 10);
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
    const started: number[] = [];
    const runs = gates.map((gate, i) =>
      limiter.run(() => {
        started.push(i);
        return gate.promise;
      }, new AbortController().signal),
    );
    expect(started).toEqual([0, 1]);
    expect(limiter.queued()).toBe(1);
    gates[0].resolve('a');
    await runs[0];
    expect(started).toEqual([0, 1, 2]);
    gates[1].resolve('b');
    gates[2].resolve('c');
    expect(await Promise.all(runs)).toEqual(['a', 'b', 'c']);
    expect(limiter.active()).toBe(0);
  });

  it('refuses with RATE_LIMITED when the queue is full', async () => {
    const limiter = createLookupLimiter(1, 1);
    const hold = deferred();
    const signal = new AbortController().signal;
    void limiter.run(() => hold.promise, signal);
    const queued = limiter.run(async () => 'q', signal);
    expect(await codeOf(limiter.run(async () => 'x', signal))).toBe('RATE_LIMITED');
    hold.resolve();
    expect(await queued).toBe('q');
  });

  it('a queued lookup leaves the queue on abort (TIMEOUT) and never runs', async () => {
    const limiter = createLookupLimiter(1, 5);
    const hold = deferred();
    void limiter.run(() => hold.promise, new AbortController().signal);
    const controller = new AbortController();
    let ran = false;
    const queued = limiter.run(async () => {
      ran = true;
    }, controller.signal);
    controller.abort();
    expect(await codeOf(queued)).toBe('TIMEOUT');
    expect(limiter.queued()).toBe(0);
    hold.resolve();
    await Promise.resolve();
    expect(ran).toBe(false);
  });

  it('keeps the slot of a running lookup after abort until it really settles (thread cannot be cancelled)', async () => {
    const limiter = createLookupLimiter(1, 5);
    const hold = deferred();
    const controller = new AbortController();
    const running = limiter.run(() => hold.promise, controller.signal);
    controller.abort();
    expect(limiter.active()).toBe(1);
    hold.resolve();
    await running;
    expect(limiter.active()).toBe(0);
  });

  it('frees the slot when the task throws synchronously or rejects', async () => {
    const limiter = createLookupLimiter(1, 1);
    const signal = new AbortController().signal;
    await expect(limiter.run(() => { throw new Error('x'); }, signal)).rejects.toThrow('x');
    await expect(limiter.run(() => Promise.reject(new Error('y')), signal)).rejects.toThrow('y');
    expect(limiter.active()).toBe(0);
  });

  it('refuses an already aborted signal without starting', async () => {
    const limiter = createLookupLimiter(1, 1);
    let ran = false;
    expect(await codeOf(limiter.run(async () => { ran = true; }, AbortSignal.abort()))).toBe('TIMEOUT');
    expect(ran).toBe(false);
  });
});

describe('createSystemResolver', () => {
  type Answer = Array<{ address: string; family: number }>;
  const OK: Answer = [{ address: '2606:4700::1', family: 6 }, { address: '1.1.1.1', family: 4 }];
  const signal = () => new AbortController().signal;

  it('maps lookup results and bounds concurrent getaddrinfo calls', async () => {
    const holds = Array.from({ length: 5 }, () => deferred<Answer>());
    let calls = 0;
    const resolver = createSystemResolver(() => holds[calls++].promise, createLookupLimiter(3, 10));
    const results = holds.map((_, i) => resolver('h.test', signal(), `client-${i}`));
    expect(calls).toBe(3);
    holds.forEach((hold) => hold.resolve(OK));
    expect((await results[0]).map((r) => r.family)).toEqual([6, 4]);
    await Promise.all(results);
    expect(calls).toBe(5);
  });

  it('a never-settling lookup for client A does not block client B (z1o)', async () => {
    const lookup = vi.fn((host: string) => (host === 'hang.test' ? new Promise<Answer>(() => undefined) : Promise.resolve(OK)));
    const resolver = createSystemResolver(lookup, createLookupLimiter(3, 10));
    const controller = new AbortController();
    const hung = resolver('hang.test', controller.signal, 'A');
    controller.abort();
    expect(await codeOf(hung)).toBe('TIMEOUT');
    expect(await resolver('b.test', signal(), 'B')).toHaveLength(2);
    expect(await resolver('c.test', signal(), 'B')).toHaveLength(2);
  });

  it('holds one lookup slot per client: a call for another name waits for it, then resolves', async () => {
    const holds = new Map<string, ReturnType<typeof deferred<Answer>>>([['one.test', deferred<Answer>()]]);
    const lookup = vi.fn((host: string) => holds.get(host)?.promise ?? Promise.resolve(OK));
    const resolver = createSystemResolver(lookup, createLookupLimiter(3, 10));
    const first = resolver('one.test', signal(), 'A');
    const second = resolver('two.test', signal(), 'A');
    await Promise.resolve();
    expect(lookup).toHaveBeenCalledTimes(1);
    holds.get('one.test')?.resolve(OK);
    await first;
    expect(await second).toHaveLength(2);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('a waiting call for another name gets TIMEOUT at its own deadline, and the waiters are bounded', async () => {
    const hold = deferred<Answer>();
    const resolver = createSystemResolver((host) => (host === 'hang.test' ? hold.promise : Promise.resolve(OK)), createLookupLimiter(3, 10));
    void resolver('hang.test', signal(), 'A');
    const controller = new AbortController();
    const waiting = resolver('other.test', controller.signal, 'A');
    controller.abort();
    expect(await codeOf(waiting)).toBe('TIMEOUT');
    const parked = Array.from({ length: MAX_SLOT_WAITERS_PER_CLIENT }, (_, i) => resolver(`w${i}.test`, signal(), 'A'));
    expect(await codeOf(resolver('one-too-many.test', signal(), 'A'))).toBe('RATE_LIMITED');
    hold.resolve(OK);
    await Promise.all(parked);
  });

  it('with no trusted identity there is no per-client slot: a hung name does not block another', async () => {
    for (const clientKey of [undefined, 'shared']) {
      const resolver = createSystemResolver((host) => (host === 'hang.test' ? new Promise<Answer>(() => undefined) : Promise.resolve(OK)), createLookupLimiter(3, 10));
      void resolver('hang.test', signal(), clientKey);
      expect(await resolver('b.test', signal(), clientKey)).toHaveLength(2);
      expect(await resolver('c.test', signal(), clientKey)).toHaveLength(2);
    }
  });

  it('keeps A on its slot after a timeout until the lookup really returns', async () => {
    const hold = deferred<Answer>();
    const resolver = createSystemResolver((host) => (host === 'hang.test' ? hold.promise : Promise.resolve(OK)), createLookupLimiter(3, 10));
    const controller = new AbortController();
    const hung = resolver('hang.test', controller.signal, 'A');
    controller.abort();
    await codeOf(hung);
    const blocked = new AbortController();
    const other = resolver('other.test', blocked.signal, 'A');
    blocked.abort();
    expect(await codeOf(other)).toBe('TIMEOUT');
    hold.resolve(OK);
    await vi.waitFor(async () => expect(await resolver('other.test', signal(), 'A')).toHaveLength(2));
  });

  it('concurrent calls of one client for the same name share one lookup (the poll fires several at once)', async () => {
    const hold = deferred<Answer>();
    const lookup = vi.fn(() => hold.promise);
    const resolver = createSystemResolver(lookup, createLookupLimiter(3, 10));
    const calls = [resolver('same.test', signal(), 'A'), resolver('SAME.test', signal(), 'A'), resolver('same.test', signal(), 'A')];
    hold.resolve(OK);
    for (const answer of await Promise.all(calls)) expect(answer).toHaveLength(2);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('one caller timing out does not cancel the lookup the others still wait for', async () => {
    const hold = deferred<Answer>();
    const resolver = createSystemResolver(() => hold.promise, createLookupLimiter(3, 10));
    const early = new AbortController();
    const quitter = resolver('same.test', early.signal, 'A');
    const stayer = resolver('same.test', signal(), 'A');
    early.abort();
    expect(await codeOf(quitter)).toBe('TIMEOUT');
    hold.resolve(OK);
    expect(await stayer).toHaveLength(2);
  });

  it('refuses a name whose lookup timed out for a short time (negative cache), for every client, then retries', async () => {
    let now = 1_000;
    const lookup = vi.fn((host: string) => (host === 'hang.test' ? new Promise<Answer>(() => undefined) : Promise.resolve(OK)));
    const resolver = createSystemResolver(lookup, createLookupLimiter(3, 10), { now: () => now });
    const controller = new AbortController();
    const hung = resolver('hang.test', controller.signal, 'A');
    controller.abort();
    await codeOf(hung);
    expect(await codeOf(resolver('hang.test', signal(), 'B'))).toBe('DNS_FAILED');
    expect(await codeOf(resolver('HANG.test', signal(), 'C'))).toBe('DNS_FAILED');
    expect(lookup).toHaveBeenCalledTimes(1);
    now += NEGATIVE_CACHE_TTL_MS + 1;
    const again = new AbortController();
    const retry = resolver('hang.test', again.signal, 'B');
    expect(lookup).toHaveBeenCalledTimes(2);
    again.abort();
    await codeOf(retry);
  });

  it('does not put a name that never started (queued behind others) in the negative cache', async () => {
    const busy = deferred<Answer>();
    const resolver = createSystemResolver((host) => (host === 'busy.test' ? busy.promise : Promise.resolve(OK)), createLookupLimiter(1, 10));
    void resolver('busy.test', signal(), 'A');
    const controller = new AbortController();
    const queued = resolver('queued.test', controller.signal, 'B');
    controller.abort();
    expect(await codeOf(queued)).toBe('TIMEOUT');
    busy.resolve(OK);
    expect(await resolver('queued.test', signal(), 'B')).toHaveLength(2);
  });
});
