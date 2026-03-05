import { useEffect, useRef } from 'react';

export function usePolling(
  callback: () => Promise<void>,
  intervalMs: number,
  enabled: boolean,
) {
  const inFlight = useRef(false);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await callbackRef.current();
      } finally {
        inFlight.current = false;
      }
    };

    // Initial fetch
    tick();

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
