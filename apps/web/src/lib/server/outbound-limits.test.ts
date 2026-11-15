import { describe, expect, it } from 'vitest';
import { OutboundError } from './errors';
import { createByteBudget, createConcurrencyGate, createLookupLimiter } from './outbound-limits';
import { createSystemResolver } from './outbound';

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
  it('maps lookup results and bounds concurrent getaddrinfo calls', async () => {
    const holds = Array.from({ length: 5 }, () => deferred<Array<{ address: string; family: number }>>());
    let calls = 0;
    const resolver = createSystemResolver(() => holds[calls++].promise, createLookupLimiter(3, 10));
    const results = holds.map(() => resolver('h.test', new AbortController().signal));
    expect(calls).toBe(3);
    holds.forEach((hold) => hold.resolve([{ address: '2606:4700::1', family: 6 }, { address: '1.1.1.1', family: 4 }]));
    expect((await results[0]).map((r) => r.family)).toEqual([6, 4]);
    await Promise.all(results);
    expect(calls).toBe(5);
  });
});
