/**
 * Monotonic counter identifying the "current server session".
 *
 * An async operation captures the epoch before awaiting the platform and checks it
 * afterwards: if it changed (the user switched or dropped the server in the
 * meantime) the response belongs to a previous server and must be discarded.
 */
let epoch = 0;

/** Returns the epoch to capture before starting an async request. */
export function currentServerEpoch(): number {
  return epoch;
}

/** Starts a new server session; every request captured earlier becomes stale. */
export function bumpServerEpoch(): number {
  epoch += 1;
  return epoch;
}

/** True while no server switch happened since `captured` was read. */
export function isServerEpochCurrent(captured: number): boolean {
  return captured === epoch;
}
