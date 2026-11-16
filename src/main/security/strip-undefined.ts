/** Returns a copy of `patch` without keys whose value is `undefined`, so a merge cannot erase stored values. */
export function stripUndefined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}
