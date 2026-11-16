import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), on: vi.fn() } }));

const { guardHandler, guardListener } = await import('./ipc-guard');
const { ConfigStoreError } = await import('../store/config-store-error');

const event = { senderFrame: { url: 'http://localhost:5173/', parent: null } };
const schema = z.tuple([z.strictObject({ a: z.number() })]);

describe('guardHandler', () => {
  it('runs the handler with parsed arguments', async () => {
    const run = vi.fn((_arg: unknown) => ({ success: true }));
    const result = await guardHandler(
      () => true,
      schema,
      (_e, [arg]) => run(arg),
    )(event, { a: 1 });
    expect(result).toEqual({ success: true });
    expect(run).toHaveBeenCalledWith({ a: 1 });
  });

  it('rejects an untrusted sender without running the handler', async () => {
    const run = vi.fn();
    const result = await guardHandler(() => false, schema, run)(event, { a: 1 });
    expect(result).toEqual({ success: false, error: 'Untrusted sender', code: 'UNTRUSTED_SENDER' });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects malformed, extra and unknown-key arguments without side effects', async () => {
    const run = vi.fn();
    const guarded = guardHandler(() => true, schema, run);
    for (const args of [[], [{ a: 'x' }], [{ a: 1, b: 2 }], [{ a: 1 }, 'extra'], [null]]) {
      expect(await guarded(event, ...args)).toEqual({
        success: false,
        error: 'Invalid request',
        code: 'INVALID_INPUT',
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('does not leak the error message of a failing handler', async () => {
    const result = await guardHandler(
      () => true,
      schema,
      () => {
        throw new Error('password=hunter2');
      },
    )(event, { a: 1 });
    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(result).toEqual({ success: false, error: 'Request failed', code: 'UNKNOWN' });
  });

  it('forwards the code of a ConfigStoreError', async () => {
    const result = await guardHandler(
      () => true,
      schema,
      () => {
        throw new ConfigStoreError('unreadable', 'CONFIG_UNWRITABLE');
      },
    )(event, { a: 1 });
    expect(result).toEqual({ success: false, error: 'Request failed', code: 'CONFIG_UNWRITABLE' });
  });
});

describe('guardListener', () => {
  it('drops untrusted or invalid messages', () => {
    const run = vi.fn();
    guardListener(() => false, schema, run)(event, { a: 1 });
    guardListener(() => true, schema, run)(event, { a: 'no' });
    expect(run).not.toHaveBeenCalled();
    guardListener(() => true, schema, run)(event, { a: 1 });
    expect(run).toHaveBeenCalledOnce();
  });

  it('does not let a throwing handler escape or leak its message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = guardListener(
      () => true,
      schema,
      () => {
        throw new Error('password=hunter2');
      },
    );
    expect(() => throwing(event, { a: 1 })).not.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toContain('hunter2');
    log.mockRestore();
  });
});

describe('guardHandler config store failures', () => {
  it('reports the stable code of a rejected configuration write, never the raw text', async () => {
    const { ConfigStoreError } = await import('../store/config-store-error');
    const result = await guardHandler(
      () => true,
      schema,
      () => {
        throw new ConfigStoreError('Encrypting a credential failed', 'SECRET_STORE_FAILED');
      },
    )(event, { a: 1 });
    expect(result).toEqual({ success: false, error: 'Request failed', code: 'SECRET_STORE_FAILED' });
  });
});
