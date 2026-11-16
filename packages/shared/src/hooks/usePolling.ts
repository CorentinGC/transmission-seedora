import { useEffect, useRef } from 'react';
import { notifyFailure } from '../stores/notification-store';

/**
 * Runs `callback` immediately and then every `intervalMs`, never overlapping two runs.
 * `onError` is called once per outage (first failure after a success), so a daemon
 * that stays down does not flood the user. Returns a cleanup that stops the timer and
 * silences any run still in flight. Each call owns its in-flight state, so a restarted
 * poller is never blocked by its predecessor.
 */
export function startPolling(
  callback: () => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let inFlight = false;
  let stopped = false;
  let failing = false;

  const tick = async () => {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      await callback();
      failing = false;
    } catch (error) {
      if (!stopped && !failing) onError(error);
      failing = true;
    } finally {
      inFlight = false;
    }
  };

  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}

function reportPollError(error: unknown): void {
  notifyFailure('notification.refreshFailed', error instanceof Error ? error.message : undefined);
}

/** Polls `callback` while `enabled`, stopping cleanly on unmount or when disabled. */
export function usePolling(
  callback: () => Promise<void>,
  intervalMs: number,
  enabled: boolean,
  onError: (error: unknown) => void = reportPollError,
) {
  const callbackRef = useRef(callback);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    callbackRef.current = callback;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!enabled) return;
    return startPolling(
      () => callbackRef.current(),
      intervalMs,
      (error) => onErrorRef.current(error),
    );
  }, [intervalMs, enabled]);
}
