import { describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();
vi.mock('node:child_process', () => ({ execFileSync }));

const { adhocSignArgs, adhocSignMacApps } = await import('./macos-adhoc-sign');

describe('adhocSignArgs', () => {
  it('forces a deep ad hoc signature of the app bundle', () => {
    expect(adhocSignArgs('/out/Seedora.app')).toEqual(['--force', '--deep', '--sign', '-', '/out/Seedora.app']);
  });
});

describe('adhocSignMacApps', () => {
  it('signs each macOS output and ignores other platforms', () => {
    adhocSignMacApps('linux', ['/out/linux'], 'Seedora');
    expect(execFileSync).not.toHaveBeenCalled();
    adhocSignMacApps('darwin', ['/out/mac'], 'Seedora');
    expect(execFileSync).toHaveBeenCalledWith('codesign', adhocSignArgs('/out/mac/Seedora.app'), { stdio: 'inherit' });
  });
});
