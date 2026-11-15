import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failureFromError, logActionFailure } from './action-error';
import { ConfigError } from './env';
import { OutboundError } from './errors';
import { SessionTooLargeError } from './session-cookie';

const SECRET_TEXT = 'hunter2 10.1.2.3 nas.internal';
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorLog.mockRestore());

describe('failureFromError', () => {
  it('maps known classes to fixed codes', () => {
    expect(failureFromError(new ConfigError('COOKIE_SECRET missing'))).toMatchObject({ code: 'SERVER_MISCONFIGURED' });
    expect(failureFromError(new OutboundError('TIMEOUT'))).toMatchObject({ code: 'TIMEOUT' });
    expect(failureFromError(new SessionTooLargeError())).toMatchObject({ code: 'INVALID_INPUT' });
    expect(failureFromError(new Error(SECRET_TEXT))).toMatchObject({ code: 'CONNECTION_FAILED' });
  });

  it('never puts the message in the result', () => {
    expect(JSON.stringify(failureFromError(new Error(SECRET_TEXT)))).not.toMatch(/hunter2|10\.1\.2\.3|internal/);
  });

  it('does not log expected failures', () => {
    failureFromError(new OutboundError('HOST_NOT_ALLOWED'));
    failureFromError(new SessionTooLargeError());
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('logs unexpected errors by class name and code only', () => {
    const odd = new TypeError(SECRET_TEXT, { cause: new Error(SECRET_TEXT) });
    failureFromError(odd);
    failureFromError(new ConfigError(SECRET_TEXT));
    expect(errorLog).toHaveBeenCalledTimes(2);
    expect(errorLog.mock.calls[0]).toEqual(['Server action failed', { name: 'TypeError', code: 'CONNECTION_FAILED' }]);
    expect(errorLog.mock.calls[1]).toEqual([
      'Server action failed',
      { name: 'ConfigError', code: 'SERVER_MISCONFIGURED' },
    ]);
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/hunter2|10\.1\.2\.3|internal/);
  });
});

describe('logActionFailure', () => {
  it('adds a well-formed system code, and ignores anything that could carry data', () => {
    logActionFailure(Object.assign(new Error(SECRET_TEXT), { code: 'ENOENT' }), 'SERVER_MISCONFIGURED');
    logActionFailure(Object.assign(new Error('x'), { code: 'bad code with 10.0.0.1' }), 'SERVER_MISCONFIGURED');
    expect(errorLog.mock.calls[0][1]).toEqual({ name: 'Error', code: 'SERVER_MISCONFIGURED', errno: 'ENOENT' });
    expect(errorLog.mock.calls[1][1]).toEqual({ name: 'Error', code: 'SERVER_MISCONFIGURED' });
  });

  it('handles a thrown non-Error', () => {
    logActionFailure(SECRET_TEXT, 'SERVER_MISCONFIGURED');
    expect(errorLog).toHaveBeenCalledWith('Server action failed', { name: 'NonError', code: 'SERVER_MISCONFIGURED' });
  });
});
