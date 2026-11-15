import { describe, expect, it, vi } from 'vitest';
import { RpcError } from './client';
import { toIpcError } from './to-ipc-error';

describe('toIpcError', () => {
  it('keeps the message and code of an RpcError', () => {
    expect(toIpcError(new RpcError('AUTH', 'HTTP 401: Unauthorized'))).toEqual({ success: false, error: 'HTTP 401: Unauthorized', code: 'AUTH' });
  });

  it('hides the text of any other error, which could carry credentials', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const leaky = new TypeError('connect to http://user:s3cret@proxy:3128 failed');
    const res = toIpcError(leaky);
    expect(res).toEqual({ success: false, error: 'Request failed', code: 'UNKNOWN' });
    expect(JSON.stringify(res)).not.toContain('s3cret');
  });

  it('handles non-Error throwables', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toIpcError('boom').code).toBe('UNKNOWN');
  });
});
