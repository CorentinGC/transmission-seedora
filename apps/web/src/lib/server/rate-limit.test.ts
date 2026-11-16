import { describe, expect, it } from 'vitest';
import { RATE_LIMITS, SHARED_CLIENT_KEY, clientKey, createTokenBucket } from './rate-limit';

/** Controllable clock. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const headers = (init: Record<string, string>) => ({
  get: (name: string) => init[name.toLowerCase()] ?? null,
});

describe('createTokenBucket', () => {
  it('allows a burst, then rejects', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ perMinute: 60, burst: 5, now: clock.now });
    for (let i = 0; i < 5; i++) expect(bucket.take('a')).toBe(true);
    expect(bucket.take('a')).toBe(false);
  });

  it('refills at the sustained rate', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ perMinute: 60, burst: 2, now: clock.now });
    bucket.take('a');
    bucket.take('a');
    expect(bucket.take('a')).toBe(false);
    clock.advance(999);
    expect(bucket.take('a')).toBe(false);
    clock.advance(1);
    expect(bucket.take('a')).toBe(true);
    expect(bucket.take('a')).toBe(false);
  });

  it('never refills beyond the burst', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ perMinute: 60, burst: 3, now: clock.now });
    bucket.take('a');
    clock.advance(10 * 60_000);
    for (let i = 0; i < 3; i++) expect(bucket.take('a')).toBe(true);
    expect(bucket.take('a')).toBe(false);
  });

  it('keeps keys independent', () => {
    const bucket = createTokenBucket({ perMinute: 60, burst: 1, now: fakeClock().now });
    expect(bucket.take('a')).toBe(true);
    expect(bucket.take('a')).toBe(false);
    expect(bucket.take('b')).toBe(true);
  });

  it('survives a clock that goes backwards', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ perMinute: 60, burst: 1, now: clock.now });
    bucket.take('a');
    clock.advance(-5_000);
    expect(bucket.take('a')).toBe(false);
    clock.advance(6_000);
    expect(bucket.take('a')).toBe(true);
  });

  it('bounds memory with LRU eviction', () => {
    const bucket = createTokenBucket({ perMinute: 60, burst: 1, maxKeys: 3, now: fakeClock().now });
    for (const k of ['a', 'b', 'c', 'd']) bucket.take(k);
    expect(bucket.size()).toBe(3);
    // 'a' was the least recently used and is forgotten: it gets a fresh bucket.
    expect(bucket.take('a')).toBe(true);
    expect(bucket.size()).toBe(3);
  });

  it('keeps a recently used key when evicting', () => {
    const bucket = createTokenBucket({ perMinute: 60, burst: 1, maxKeys: 2, now: fakeClock().now });
    bucket.take('a');
    bucket.take('b');
    bucket.take('a'); // refresh a (rejected, but still recently used)
    bucket.take('c'); // evicts b
    expect(bucket.take('a')).toBe(false);
  });

  it('never exceeds maxKeys under a key flood', () => {
    const bucket = createTokenBucket({ perMinute: 60, burst: 1, maxKeys: 100, now: fakeClock().now });
    for (let i = 0; i < 10_000; i++) bucket.take(`k${i}`);
    expect(bucket.size()).toBe(100);
  });

  it('rejects invalid configuration', () => {
    expect(() => createTokenBucket({ perMinute: 0, burst: 1 })).toThrow();
    expect(() => createTokenBucket({ perMinute: 1, burst: 0 })).toThrow();
    expect(() => createTokenBucket({ perMinute: 1, burst: 1, maxKeys: 0 })).toThrow();
  });
});

describe('RATE_LIMITS', () => {
  it('matches ADR 0004', () => {
    expect(RATE_LIMITS).toEqual({
      rpcClient: { perMinute: 900, burst: 150 },
      rpcDestination: { perMinute: 1800, burst: 300 },
      testConnection: { perMinute: 10, burst: 5 },
      setActiveServer: { perMinute: 30, burst: 10 },
      geoip: { perMinute: 60, burst: 20 },
    });
  });
});

describe('clientKey', () => {
  const vercel = { onVercel: true, trustProxy: false };
  const trusted = { onVercel: false, trustProxy: true };
  const untrusted = { onVercel: false, trustProxy: false };

  it('uses x-vercel-forwarded-for on Vercel', () => {
    expect(clientKey(headers({ 'x-vercel-forwarded-for': '203.0.113.7' }), vercel)).toBe('203.0.113.7');
  });

  it('prefers x-vercel-forwarded-for over a spoofable x-forwarded-for on Vercel', () => {
    const h = headers({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' });
    expect(clientKey(h, vercel)).toBe('203.0.113.7');
  });

  it('falls back to x-forwarded-for on Vercel when the vercel header is absent', () => {
    expect(clientKey(headers({ 'x-forwarded-for': '203.0.113.7' }), vercel)).toBe('203.0.113.7');
  });

  it('ignores forwarding headers off Vercel unless the proxy is trusted', () => {
    const h = headers({ 'x-forwarded-for': '203.0.113.7', 'x-vercel-forwarded-for': '203.0.113.7' });
    expect(clientKey(h, untrusted)).toBeNull();
  });

  it('uses the entry appended by the trusted proxy (rightmost), not the spoofable leftmost', () => {
    const h = headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' });
    expect(clientKey(h, trusted)).toBe('203.0.113.7');
  });

  it('falls back to the shared key, never null, when trusted but the header is missing', () => {
    expect(clientKey(headers({}), trusted)).toBe(SHARED_CLIENT_KEY);
    expect(clientKey(headers({}), vercel)).toBe(SHARED_CLIENT_KEY);
  });

  it('falls back to the shared key for garbage instead of keying on attacker text', () => {
    for (const bad of ['', ' ', 'not-an-ip', '<script>', 'a'.repeat(5000), '999.1.1.1', '[::1', '1.2.3.4:99999x']) {
      expect(clientKey(headers({ 'x-forwarded-for': bad }), trusted)).toBe(SHARED_CLIENT_KEY);
    }
  });

  it('still reads the proxy-appended entry after a very long caller-supplied prefix', () => {
    const h = headers({ 'x-forwarded-for': `${'6.6.6.6, '.repeat(500)}203.0.113.7` });
    expect(clientKey(h, trusted)).toBe('203.0.113.7');
  });

  it('strips a port from the last hop', () => {
    expect(clientKey(headers({ 'x-forwarded-for': '203.0.113.7:51234' }), trusted)).toBe('203.0.113.7');
    expect(clientKey(headers({ 'x-forwarded-for': '[2001:db8:1:2::9]:443' }), trusted)).toBe(
      clientKey(headers({ 'x-forwarded-for': '2001:db8:1:2::1' }), trusted),
    );
    expect(clientKey(headers({ 'x-forwarded-for': '[2001:db8:1:2::9]' }), trusted)).toMatch(/\/64$/);
  });

  it('shares one key per IPv6 /64 and separates different /64s', () => {
    const key = (ip: string) => clientKey(headers({ 'x-forwarded-for': ip }), trusted);
    expect(key('2001:db8:1:2::1')).toBe(key('2001:DB8:1:2:ffff:ffff:ffff:ffff'));
    expect(key('2001:db8:1:2::1')).not.toBe(key('2001:db8:1:3::1'));
  });

  it('rotating the interface id inside a /64 cannot refill a bucket', () => {
    const bucket = createTokenBucket(RATE_LIMITS.testConnection);
    let allowed = 0;
    for (let i = 0; i < 200; i++) {
      const k = clientKey(headers({ 'x-vercel-forwarded-for': `2001:db8:1:2::${i.toString(16)}` }), vercel);
      if (bucket.take(k ?? 'x')) allowed++;
    }
    expect(allowed).toBe(RATE_LIMITS.testConnection.burst);
  });

  it('canonicalises case, zero forms and IPv4-mapped addresses', () => {
    const key = (ip: string) => clientKey(headers({ 'x-forwarded-for': ip }), trusted);
    expect(key('2001:DB8::1')).toBe(key('2001:db8:0:0::1'));
    expect(key('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(key('::FFFF:102:304')).toBe('1.2.3.4');
    expect(key('fe80::1%eth0')).toBe(key('fe80::2'));
  });

  it('exposes a shared key for buckets that cannot identify the client', () => {
    expect(SHARED_CLIENT_KEY).toBe('shared');
  });
});
