import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import type { IpcResponse } from '@shared/types';
import type { SenderEventLike } from './sender';

/** Predicate deciding whether an IPC event comes from the app's own page. */
export type SenderValidator = (event: SenderEventLike) => boolean;

const INVALID: IpcResponse = { success: false, error: 'Invalid request' };
const UNTRUSTED: IpcResponse = { success: false, error: 'Untrusted sender' };

/**
 * Wraps an invoke handler: sender check, then argument validation against `schema`
 * (a tuple of the channel's arguments), then the handler with the parsed values.
 * Validation failures return an error response and run no handler code.
 */
export function guardHandler<S extends z.ZodType<unknown[]>, R>(
  isTrustedSender: SenderValidator,
  schema: S,
  handler: (event: SenderEventLike, args: z.output<S>) => R | Promise<R>,
): (event: SenderEventLike, ...args: unknown[]) => Promise<R | IpcResponse> {
  return async (event, ...args) => {
    if (!isTrustedSender(event)) return UNTRUSTED;
    const parsed = schema.safeParse(args);
    if (!parsed.success) return INVALID;
    try {
      return await handler(event, parsed.data);
    } catch (err) {
      console.error('[IPC] Handler failed:', err instanceof Error ? err.name : 'unknown error');
      return { success: false, error: 'Request failed' };
    }
  };
}

/** Wraps a fire-and-forget listener with the same checks; invalid messages are dropped. */
export function guardListener<S extends z.ZodType<unknown[]>>(
  isTrustedSender: SenderValidator,
  schema: S,
  handler: (args: z.output<S>) => void,
): (event: SenderEventLike, ...args: unknown[]) => void {
  return (event, ...args) => {
    if (!isTrustedSender(event)) return;
    const parsed = schema.safeParse(args);
    if (!parsed.success) return;
    try {
      handler(parsed.data);
    } catch (err) {
      console.error('[IPC] Listener failed:', err instanceof Error ? err.name : 'unknown error');
    }
  };
}

/** Registers a guarded `ipcMain.handle` channel. */
export function handleGuarded<S extends z.ZodType<unknown[]>, R>(
  isTrustedSender: SenderValidator,
  channel: string,
  schema: S,
  handler: (event: IpcMainInvokeEvent, args: z.output<S>) => R | Promise<R>,
): void {
  const wrapped = guardHandler(isTrustedSender, schema, (event, args) => handler(event as IpcMainInvokeEvent, args));
  ipcMain.handle(channel, (event, ...args) => wrapped(event, ...args));
}

/** Registers a guarded `ipcMain.on` channel. */
export function listenGuarded<S extends z.ZodType<unknown[]>>(
  isTrustedSender: SenderValidator,
  channel: string,
  schema: S,
  handler: (event: IpcMainEvent, args: z.output<S>) => void,
): void {
  ipcMain.on(channel, (event, ...args) => {
    const wrapped = guardListener(isTrustedSender, schema, (parsed) => handler(event, parsed));
    wrapped(event, ...args);
  });
}
