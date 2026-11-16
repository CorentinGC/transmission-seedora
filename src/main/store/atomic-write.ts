import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes `content` to `filePath` atomically with mode 0600: the data goes to a fresh temp file created
 * with that mode (the mode of an existing file is never reused), is flushed, then renamed over the target.
 * A crash leaves either the old or the new file, never a truncated one.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.rmSync(tmp, { force: true });
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try {
    try {
      fs.writeFileSync(fd, content, 'utf-8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}
