import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {}, dialog: { showMessageBox: vi.fn() } }));
const { describeChange, sanitizeForDialog } = await import('./script-confirm-dialog');

describe('sanitizeForDialog', () => {
  it('strips control and invisible format characters', () => {
    expect(sanitizeForDialog('a‮b​c\nd')).toBe('a b c d');
  });

  it('marks truncation with an ellipsis and leaves short text alone', () => {
    expect(sanitizeForDialog('x'.repeat(250))).toBe(`${'x'.repeat(200)}…`);
    expect(sanitizeForDialog('short')).toBe('short');
  });
});

describe('describeChange', () => {
  it('shows key and sanitised value, JSON for non-strings', () => {
    expect(describeChange({ key: 'script-torrent-done-enabled', value: true })).toBe('script-torrent-done-enabled: true');
    expect(describeChange({ key: 'k', value: '/a⁦b' })).toBe('k: /a b');
  });
});
