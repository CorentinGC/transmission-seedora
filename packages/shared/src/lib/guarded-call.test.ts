import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStore } from '../stores/notification-store';
import { guardedCall } from './guarded-call';

const keys = () => useNotificationStore.getState().notifications.map((n) => n.messageKey);

describe('guardedCall', () => {
  beforeEach(() => useNotificationStore.setState({ notifications: [] }));

  it('returns the response and stays silent on success', async () => {
    const res = { success: true, data: 'x' };
    expect(await guardedCall(vi.fn().mockResolvedValue(res), 'notification.exportFailed')).toBe(res);
    expect(keys()).toEqual([]);
  });

  it('notifies and resolves null on success:false, without leaking the raw error', async () => {
    const out = await guardedCall(
      vi.fn().mockResolvedValue({ success: false, error: 'EACCES /secret/path' }),
      'notification.exportFailed',
    );
    expect(out).toBeNull();
    expect(keys()).toEqual(['notification.exportFailed']);
    expect(useNotificationStore.getState().notifications[0]?.params).toEqual({});
  });

  it('notifies and resolves null when the call throws', async () => {
    const out = await guardedCall(vi.fn().mockRejectedValue(new Error('ipc closed')), 'notification.exportFailed');
    expect(out).toBeNull();
    expect(keys()).toEqual(['notification.exportFailed']);
  });
});

describe('guardedCall with a failure code', () => {
  beforeEach(() => useNotificationStore.setState({ notifications: [] }));

  it('adds the translated reason for a known code', async () => {
    await guardedCall(
      vi.fn().mockResolvedValue({ success: false, error: 'raw', code: 'AUTH_FAILED' }),
      'notification.exportFailed',
    );
    const [notification] = useNotificationStore.getState().notifications;
    expect(notification?.messageKey).toBe('notification.withReason');
    expect(notification?.params).toHaveProperty('reason');
  });
});

describe('guardedCall with a cancelled action', () => {
  beforeEach(() => useNotificationStore.setState({ notifications: [] }));

  it('resolves null without any notification', async () => {
    const out = await guardedCall(
      vi.fn().mockResolvedValue({ success: false, error: 'declined', code: 'CANCELLED' }),
      'notification.exportFailed',
    );
    expect(out).toBeNull();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
