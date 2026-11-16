import { describe, expect, it, vi } from 'vitest';
import { findScriptChanges, isSessionChangeAllowed } from './script-guard';

const deps = (current: Record<string, unknown> | 'fail', answer: boolean) => ({
  fetchCurrent: vi.fn(async () => {
    if (current === 'fail') throw new Error('down');
    return current;
  }),
  confirm: vi.fn(async () => answer),
});

describe('findScriptChanges', () => {
  it('finds script keys in both spellings and ignores other settings', () => {
    const found = findScriptChanges({
      'script-torrent-done-filename': '/x.sh',
      script_torrent_added_enabled: true,
      'speed-limit-down': 5,
    });
    expect(found).toEqual([
      { key: 'script-torrent-done-filename', value: '/x.sh' },
      { key: 'script-torrent-added-enabled', value: true },
    ]);
  });
});

describe('isSessionChangeAllowed', () => {
  it('lets calls without script settings through without asking or reading', async () => {
    const d = deps({}, false);
    expect(await isSessionChangeAllowed({ 'speed-limit-down': 5 }, d)).toBe(true);
    expect(d.fetchCurrent).not.toHaveBeenCalled();
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it('does not ask when the script settings keep their current value', async () => {
    const d = deps({ 'script-torrent-done-enabled': false, 'script-torrent-done-filename': '' }, false);
    expect(
      await isSessionChangeAllowed({ 'script-torrent-done-enabled': false, 'script-torrent-done-filename': '' }, d),
    ).toBe(true);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it('asks about the changed settings only, and refuses when declined', async () => {
    const d = deps({ 'script-torrent-done-enabled': false, 'script-torrent-done-filename': '' }, false);
    const allowed = await isSessionChangeAllowed(
      { 'script-torrent-done-enabled': true, 'script-torrent-done-filename': '' },
      d,
    );
    expect(allowed).toBe(false);
    expect(d.confirm).toHaveBeenCalledWith([
      { key: 'script-torrent-done-enabled', value: true },
      { key: 'script-torrent-done-filename', value: '' },
    ]);
  });

  it('proceeds when the user approves', async () => {
    expect(await isSessionChangeAllowed({ 'script-torrent-added-filename': '/run.sh' }, deps({}, true))).toBe(true);
  });

  it('asks when the current value cannot be read', async () => {
    const d = deps('fail', false);
    expect(await isSessionChangeAllowed({ 'script-torrent-added-enabled': false }, d)).toBe(false);
    expect(d.confirm).toHaveBeenCalled();
  });
});

describe('isSessionChangeAllowed with snake_case daemon answers', () => {
  it('does not prompt when the daemon reports the same value under a snake_case key', async () => {
    const d = deps({ script_torrent_done_filename: '/x.sh' }, false);
    expect(await isSessionChangeAllowed({ 'script-torrent-done-filename': '/x.sh' }, d)).toBe(true);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it('still prompts when the snake_case value differs', async () => {
    const d = deps({ script_torrent_done_filename: '/old.sh' }, false);
    expect(await isSessionChangeAllowed({ 'script-torrent-done-filename': '/x.sh' }, d)).toBe(false);
    expect(d.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('effective filename', () => {
  it('adds the filename that would run when a script is only switched on', async () => {
    const d = deps({ 'script-torrent-done-enabled': false, 'script-torrent-done-filename': '/stored.sh' }, true);
    await isSessionChangeAllowed({ 'script-torrent-done-enabled': true }, d);
    expect(d.confirm).toHaveBeenCalledWith([
      { key: 'script-torrent-done-enabled', value: true },
      { key: 'script-torrent-done-filename', value: '/stored.sh' },
    ]);
  });

  it('does not duplicate a filename that is already part of the change', async () => {
    const d = deps({}, true);
    await isSessionChangeAllowed({ 'script-torrent-done-enabled': true, 'script-torrent-done-filename': '/n.sh' }, d);
    expect(d.confirm).toHaveBeenCalledWith([
      { key: 'script-torrent-done-enabled', value: true },
      { key: 'script-torrent-done-filename', value: '/n.sh' },
    ]);
  });
});
