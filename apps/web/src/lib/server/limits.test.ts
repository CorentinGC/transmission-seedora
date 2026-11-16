import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboundError } from './errors';
import { resetRateLimits, takeDestinationTokens } from './limits';
import { RATE_LIMITS } from './rate-limit';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const addr = (address: string, family: 4 | 6 = 4) => ({ address, family });
const refused = (addresses: { address: string; family: 4 | 6 }[]): boolean => {
  try {
    takeDestinationTokens(addresses);
  } catch (error) {
    expect((error as OutboundError).code).toBe('RATE_LIMITED');
    return true;
  }
  return false;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  resetRateLimits();
});

describe('takeDestinationTokens', () => {
  it('draws one token per address and refuses once an address is empty', () => {
    for (let i = 0; i < RATE_LIMITS.rpcDestination.burst; i++) expect(refused([addr('93.184.216.34')])).toBe(false);
    expect(refused([addr('93.184.216.34')])).toBe(true);
    expect(refused([addr('93.184.216.35')])).toBe(false);
  });

  it('a victim address next to a fresh one is still limited by the victim bucket', () => {
    for (let i = 0; i < RATE_LIMITS.rpcDestination.burst; i++) refused([addr('93.184.216.34')]);
    expect(refused([addr('93.184.216.34'), addr('203.0.113.1')])).toBe(true);
  });

  it('keys IPv6 per /64 and IPv4-mapped as IPv4', () => {
    for (let i = 0; i < RATE_LIMITS.rpcDestination.burst; i++) refused([addr('2606:4700:1:2::1', 6)]);
    expect(refused([addr('2606:4700:1:2:ffff::9', 6)])).toBe(true);
    for (let i = 0; i < RATE_LIMITS.rpcDestination.burst; i++) refused([addr('93.184.216.40')]);
    expect(refused([addr('::ffff:93.184.216.40', 6)])).toBe(true);
  });
});
