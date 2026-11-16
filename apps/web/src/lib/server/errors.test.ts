import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_MESSAGES, OutboundError, failure } from './errors';

describe('errors', () => {
  it('has a fixed message for every code', () => {
    for (const code of ERROR_CODES) expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
  });
  it('builds an action failure and an error carrying only the code', () => {
    expect(failure('TIMEOUT')).toEqual({ success: false, error: ERROR_MESSAGES.TIMEOUT, code: 'TIMEOUT' });
    const error = new OutboundError('HOST_NOT_ALLOWED');
    expect(error.code).toBe('HOST_NOT_ALLOWED');
    expect(error.message).toBe(ERROR_MESSAGES.HOST_NOT_ALLOWED);
  });
});
