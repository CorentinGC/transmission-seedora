/**
 * Choice of the server to reconnect to at startup (bead asj).
 */

/**
 * The previously active server when it still exists, else the first one, else null.
 * `storedId` comes from `localStorage`, so its type is checked, not assumed.
 */
export function pickInitialServerId(servers: readonly { id: string }[], storedId: unknown): string | null {
  if (typeof storedId === 'string' && servers.some((s) => s.id === storedId)) return storedId;
  return servers[0]?.id ?? null;
}
