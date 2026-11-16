import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Arguments of the `codesign` call that re-signs a packaged `.app` ad hoc, sealing its final contents. */
export function adhocSignArgs(appPath: string): string[] {
  return ['--force', '--deep', '--sign', '-', appPath];
}

/**
 * Re-signs every packaged macOS app ad hoc once packaging (including the fuse flip, which rewrites the binary)
 * is finished. Without it the bundle keeps the stale signature of the unmodified Electron binary
 * (`com.github.Electron`, Info.plist not bound), and the macOS keychain refuses `safeStorage` for it, so no
 * password can be saved. A Developer ID build replaces this signature when signing is configured.
 */
export function adhocSignMacApps(platform: string, outputPaths: string[], productName: string): void {
  if (platform !== 'darwin') return;
  for (const outputPath of outputPaths) {
    const appPath = path.join(outputPath, `${productName}.app`);
    execFileSync('codesign', adhocSignArgs(appPath), { stdio: 'inherit' });
    console.log(`[forge] Re-signed ${appPath} ad hoc`);
  }
}
