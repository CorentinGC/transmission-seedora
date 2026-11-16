/**
 * Test helper: lets hook logic run in the node environment (no DOM, no renderer) by replacing
 * React's `useEffect` / `useRef` with a recorder. Used with `vi.mock('react', ...)` in hook tests.
 */
export interface EffectHarness {
  /** Starts a render pass: clears recorded effects. Refs persist across passes. */
  beginRender(): void;
  /** Runs the recorded effects (as React does after commit) and returns an unmount function. */
  commit(): () => void;
  useEffect(effect: () => void | (() => void)): void;
  useRef<T>(initial: T): { current: T };
}

export function createEffectHarness(): EffectHarness {
  let effects: Array<() => void | (() => void)> = [];
  const refs: Array<{ current: unknown }> = [];
  let refIndex = 0;
  return {
    beginRender() {
      effects = [];
      refIndex = 0;
    },
    commit() {
      const cleanups = effects.map((effect) => effect());
      return () => cleanups.forEach((cleanup) => typeof cleanup === 'function' && cleanup());
    },
    useEffect(effect) {
      effects.push(effect);
    },
    useRef<T>(initial: T) {
      refs[refIndex] ??= { current: initial };
      return refs[refIndex++] as { current: T };
    },
  };
}
