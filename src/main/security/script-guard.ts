/** Session settings that make the Transmission daemon execute a program on its host. */
const SCRIPT_SETTING_KEYS: ReadonlySet<string> = new Set([
  'script-torrent-added-enabled',
  'script-torrent-added-filename',
  'script-torrent-done-enabled',
  'script-torrent-done-filename',
  'script-torrent-done-seeding-enabled',
  'script-torrent-done-seeding-filename',
]);

/** One script-related setting a `session-set` call wants to write. */
export interface ScriptChange {
  /** Canonical kebab-case name. */
  key: string;
  value: unknown;
}

/** Newer daemons also accept snake_case spellings: both map to the kebab-case name. */
const canonicalKey = (key: string): string => key.replace(/_/g, '-');

/** The script settings present in `session-set` params (empty when the call is harmless). */
export function findScriptChanges(params: Record<string, unknown>): ScriptChange[] {
  return Object.entries(params)
    .map(([key, value]) => ({ key: canonicalKey(key), value }))
    .filter(({ key }) => SCRIPT_SETTING_KEYS.has(key));
}

/** Whether a script setting carries the type the daemon expects: a boolean for `*-enabled`, a string for `*-filename` (undefined is dropped on the wire). */
export function hasValidScriptValue({ key, value }: ScriptChange): boolean {
  if (value === undefined) return true; // dropped by JSON serialisation: never reaches the daemon
  if (key.endsWith('-enabled')) return typeof value === 'boolean';
  return typeof value === 'string';
}

/** Canonical names of every script setting (the fields to read back from the daemon). */
export const SCRIPT_SETTING_FIELDS: readonly string[] = [...SCRIPT_SETTING_KEYS];

/** Effects the guard needs, injectable for tests. */
export interface ScriptGuardDeps {
  /** Reads the daemon's current values; may fail. */
  fetchCurrent(fields: readonly string[]): Promise<Record<string, unknown> | undefined>;
  /** Asks the user; resolves true only on an explicit approval. `changes` also lists the filename each enabled script would run. */
  confirm(changes: ScriptChange[]): Promise<boolean>;
}

/**
 * Decides whether a `session-set` may proceed. Script settings that already hold the requested value
 * (the settings dialog sends every field) pass silently; a real change needs the user's approval, and
 * so does any change whose current value cannot be read.
 */
export async function isSessionChangeAllowed(params: Record<string, unknown>, deps: ScriptGuardDeps): Promise<boolean> {
  const wanted = findScriptChanges(params);
  if (wanted.length === 0) return true;
  let current: Record<string, unknown> | undefined;
  try {
    current = await deps.fetchCurrent(SCRIPT_SETTING_FIELDS);
  } catch {
    current = undefined;
  }
  // The daemon may answer in either spelling: compare under the canonical name.
  const currentByKey =
    current && Object.fromEntries(Object.entries(current).map(([key, value]) => [canonicalKey(key), value]));
  const changed = wanted.filter(({ key, value }) => currentByKey === undefined || currentByKey[key] !== value);
  if (changed.length === 0) return true;
  return deps.confirm(withEffectiveFilenames(changed, params, currentByKey));
}

/** Pairs each enabled/filename key: whenever a script is switched on, the user sees which file would run. */
function withEffectiveFilenames(
  changed: ScriptChange[],
  params: Record<string, unknown>,
  current: Record<string, unknown> | undefined,
): ScriptChange[] {
  const requested = Object.fromEntries(Object.entries(params).map(([key, value]) => [canonicalKey(key), value]));
  const result = [...changed];
  for (const { key, value } of changed) {
    if (!key.endsWith('-enabled') || value !== true) continue;
    const filenameKey = key.replace(/-enabled$/, '-filename');
    if (result.some((c) => c.key === filenameKey)) continue;
    result.push({ key: filenameKey, value: requested[filenameKey] ?? current?.[filenameKey] ?? '' });
  }
  return result;
}
