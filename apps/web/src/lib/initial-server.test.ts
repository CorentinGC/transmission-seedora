import { describe, expect, it } from 'vitest';
import { pickInitialServerId } from './initial-server';

const servers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('pickInitialServerId', () => {
  it('returns the stored active server when it still exists', () => {
    expect(pickInitialServerId(servers, 'b')).toBe('b');
  });

  it('falls back to the first server when the stored one was removed', () => {
    expect(pickInitialServerId(servers, 'gone')).toBe('a');
  });

  it('falls back to the first server when nothing was stored', () => {
    expect(pickInitialServerId(servers, null)).toBe('a');
  });

  it('ignores a stored value that is not a string', () => {
    expect(pickInitialServerId(servers, 42 as unknown as string)).toBe('a');
  });

  it('returns null without servers', () => {
    expect(pickInitialServerId([], 'a')).toBeNull();
  });
});
