import type { LaunchTarget } from './launch-targets';

const MAX_PENDING = 20;

/**
 * Hands launch targets to the renderer without losing any: targets that arrive before the renderer has
 * subscribed (cold start, macOS `open-url` before `ready`) wait here until it pulls them with `take()`;
 * after that they are pushed as they arrive. `reset()` (page reload) returns to the waiting state.
 */
export class LaunchQueue {
  private pending: LaunchTarget[] = [];
  private rendererReady = false;

  /** `push` returns false when the target could not be delivered (no live window): it is then kept. */
  constructor(private readonly push: (target: LaunchTarget) => boolean) {}

  /** Delivers the target now, or keeps it (bounded; the oldest is dropped) until the renderer pulls. */
  enqueue(target: LaunchTarget): void {
    if (this.rendererReady) {
      if (this.push(target)) return;
      this.rendererReady = false; // the window went away without a reset: wait for the next pull
    }
    this.pending.push(target);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
  }

  /** The renderer is listening: returns everything that waited and switches to pushing. */
  take(): LaunchTarget[] {
    this.rendererReady = true;
    const waiting = this.pending;
    this.pending = [];
    return waiting;
  }

  /** The renderer went away (reload or crash): queue again until it pulls. */
  reset(): void {
    this.rendererReady = false;
  }
}
