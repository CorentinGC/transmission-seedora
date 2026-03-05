/**
 * @file Key conversion utilities for Transmission RPC field names.
 * @author Claude
 *
 * Transmission 4.x returns kebab-case keys (e.g. "speed-limit-down")
 * with two legacy camelCase exceptions: "seedRatioLimit" and "seedRatioLimited".
 * Our TypeScript interfaces use camelCase throughout.
 */

/** Convert a kebab-case string to camelCase. Already-camelCase strings pass through unchanged. */
function kebabToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Keys that the Transmission RPC expects in camelCase (legacy exceptions). */
const CAMEL_CASE_KEYS = new Set(['seedRatioLimit', 'seedRatioLimited']);

/** Convert a camelCase string to kebab-case, preserving known camelCase exceptions. */
function camelToKebab(key: string): string {
  if (CAMEL_CASE_KEYS.has(key)) return key;
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Recursively convert all object keys from kebab-case to camelCase.
 * Used on `session-get` responses before storing in Zustand.
 */
export function keysToCarmel<T>(obj: unknown): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToCarmel(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const camelKey = kebabToCamel(key);
    result[camelKey] = typeof value === 'object' && value !== null ? keysToCarmel(value) : value;
  }
  return result as T;
}

/**
 * Recursively convert all object keys from camelCase to kebab-case.
 * Used on `session-set` requests before sending to the daemon.
 */
export function keysToKebab(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const kebabKey = camelToKebab(key);
    result[kebabKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? keysToKebab(value as Record<string, unknown>)
      : value;
  }
  return result;
}
