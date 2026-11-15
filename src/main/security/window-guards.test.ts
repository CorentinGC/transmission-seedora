import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { on: vi.fn(), isPackaged: false }, session: {} }));

import { createNavigationGuard } from './window-guards';

const guard = createNavigationGuard({ appOrigin: 'app://seedora' });
const blocked = (url: string): boolean => {
  const event = { preventDefault: vi.fn() };
  guard(event, url);
  return event.preventDefault.mock.calls.length === 1;
};

describe('createNavigationGuard', () => {
  it('lets the app origin through and cancels everything else', () => {
    expect(blocked('app://seedora/index.html')).toBe(false);
    expect(blocked('https://evil.example/')).toBe(true);
    expect(blocked('file:///etc/hosts')).toBe(true);
    expect(blocked('app://evil/index.html')).toBe(true);
    expect(blocked('not a url')).toBe(true);
  });
});
