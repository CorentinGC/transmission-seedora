import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { describeFailure, errorCodeKey, isCancelled } from './error-messages';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          notification: { unknownError: 'Unknown error' },
          errors: { web: { AUTH_FAILED: 'Authentication failed' }, rpc: { NETWORK: 'Network error' } },
        },
      },
    },
  });
});

describe('errorCodeKey', () => {
  it('maps web and rpc codes to their namespace', () => {
    expect(errorCodeKey('AUTH_FAILED')).toBe('errors.web.AUTH_FAILED');
    expect(errorCodeKey('TIMEOUT')).toBe('errors.web.TIMEOUT');
    expect(errorCodeKey('NETWORK')).toBe('errors.rpc.NETWORK');
  });
  it('returns null for unknown or missing codes', () => {
    expect(errorCodeKey('NOPE')).toBeNull();
    expect(errorCodeKey(undefined)).toBeNull();
  });
});

describe('describeFailure', () => {
  it('prefers the translated code over the raw text', () => {
    expect(describeFailure('raw daemon text', 'AUTH_FAILED')).toBe('Authentication failed');
  });
  it('falls back to the raw text, then to a generic message', () => {
    expect(describeFailure('duplicate torrent')).toBe('duplicate torrent');
    expect(describeFailure(undefined, 'NOPE')).toBe('Unknown error');
  });
});

describe('new transport codes and cancellation', () => {
  it('maps the RPC client codes under errors.rpc', () => {
    for (const code of [
      'AUTH',
      'INVALID_RESPONSE',
      'SESSION',
      'RPC_FAILURE',
      'NO_CONNECTION',
      'UNKNOWN',
      'SECRET_STORE_FAILED',
      'CONFIG_UNWRITABLE',
    ]) {
      expect(errorCodeKey(code)).toBe(`errors.rpc.${code}`);
    }
    expect(errorCodeKey('HTTP_ERROR')).toBe('errors.web.HTTP_ERROR');
  });
  it('recognises a cancellation', () => {
    expect(isCancelled('CANCELLED')).toBe(true);
    expect(isCancelled('AUTH')).toBe(false);
    expect(errorCodeKey('CANCELLED')).toBeNull();
  });
});
