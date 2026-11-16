import { useEffect, useRef } from 'react';
import { useApi } from '../platform/api-context';
import { guardedCall } from '../lib/guarded-call';
import { useNotificationStore } from '../stores/notification-store';
import { isLaunchTarget, resolveLaunchTarget, type AddDialogInitial } from '../lib/launch-target';
import type { LaunchTarget } from '../types';

/**
 * Receives the magnet links and `.torrent` files the OS asked the app to open: the ones that
 * arrived before the UI was ready (pulled once on start) and later ones (`launch:target` event).
 * Absent on hosts without `launchTargetsTake` (web). `onTarget` is read through a ref.
 */
export function useLaunchTargets(onTarget: (initial: AddDialogInitial) => void): void {
  const api = useApi();
  const callbackRef = useRef(onTarget);
  useEffect(() => {
    callbackRef.current = onTarget;
  });

  useEffect(() => {
    const { launchTargetsTake, readFileBase64, onMenuEvent } = api;
    if (!launchTargetsTake || !readFileBase64) return;
    const readFile = readFileBase64.bind(api);
    let cancelled = false;

    const handle = async (target: LaunchTarget) => {
      const initial = await resolveLaunchTarget(target, readFile);
      if (cancelled) return;
      if (initial) callbackRef.current(initial);
      else useNotificationStore.getState().notify('notification.fileReadFailed');
    };

    // Subscribe first so nothing sent between the pull and the subscription is lost.
    const unsubscribe = onMenuEvent?.call(api, 'launch:target', (payload) => {
      if (isLaunchTarget(payload)) void handle(payload);
    });
    void guardedCall(() => launchTargetsTake.call(api), 'notification.launchFailed').then((res) => {
      for (const target of res?.data ?? []) if (isLaunchTarget(target)) void handle(target);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [api]);
}
