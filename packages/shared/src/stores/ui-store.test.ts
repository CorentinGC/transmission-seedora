import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { useNotificationStore } from './notification-store';
import { useUiStore } from './ui-store';

const api = { prefsSet: vi.fn() };
const keys = () => useNotificationStore.getState().notifications.map((n) => n.messageKey);

describe('ui store column persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useNotificationStore.setState({ notifications: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('persists the column layout after the debounce', async () => {
    api.prefsSet.mockResolvedValue({ success: true });
    useUiStore.getState().setColumnOrder(['name']);
    await vi.advanceTimersByTimeAsync(600);
    expect(api.prefsSet).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual([]);
  });

  it('notifies when prefsSet returns success:false', async () => {
    api.prefsSet.mockResolvedValue({ success: false, error: 'disk full' });
    useUiStore.getState().setColumnOrder(['name']);
    await vi.advanceTimersByTimeAsync(600);
    expect(keys()).toEqual(['notification.columnsSaveFailed']);
  });

  it('notifies when prefsSet rejects instead of leaving an unhandled rejection', async () => {
    api.prefsSet.mockRejectedValue(new Error('ipc closed'));
    useUiStore.getState().setColumnOrder(['name']);
    await vi.advanceTimersByTimeAsync(600);
    expect(keys()).toEqual(['notification.columnsSaveFailed']);
  });
});
