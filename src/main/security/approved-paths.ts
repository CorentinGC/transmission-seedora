import fs from 'node:fs';
import path from 'node:path';

/** What a native dialog was opened for; an approval is only valid for the same kind. */
export type ApprovalKind = 'torrent' | 'json' | 'directory' | 'watch-folder';

/** Constraints applied when a previously approved file is read. */
export interface ReadRules {
  kind: ApprovalKind;
  /** Allowed lower-case extensions, including the dot. */
  extensions: readonly string[];
  maxBytes: number;
}

const MAX_APPROVALS = 256;

/** Raised when a path was not approved, has the wrong type or is too large. Messages are safe to show. */
export class ApprovedPathError extends Error {}

const NO_FOLLOW: number = (fs.constants as Record<string, number | undefined>).O_NOFOLLOW ?? 0;

/**
 * Reads a regular file through a single descriptor: opened read-only without following a final symlink,
 * checked with `fstat` on that descriptor, then read in a bounded way. A swap between a path check and
 * this call therefore cannot redirect the read.
 * @throws ApprovedPathError when the file cannot be opened, is not a regular file or exceeds `maxBytes`
 */
export function readRegularFile(filePath: string, maxBytes: number): Buffer {
  let fd: number;
  try {
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | NO_FOLLOW);
  } catch {
    throw new ApprovedPathError('Cannot open file');
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new ApprovedPathError('Not a regular file');
    if (stat.size > maxBytes) throw new ApprovedPathError('File is too large');
    const buffer = Buffer.allocUnsafe(Math.min(stat.size, maxBytes) + 1);
    let total = 0;
    while (total < buffer.length) {
      const read = fs.readSync(fd, buffer, total, buffer.length - total, null);
      if (read === 0) break;
      total += read;
    }
    if (total > maxBytes) throw new ApprovedPathError('File is too large');
    return buffer.subarray(0, total);
  } finally {
    fs.closeSync(fd);
  }
}

function canonical(filePath: string): string {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

/**
 * Registry of file system paths the user picked in a native dialog opened by main.
 * The renderer can only ask to use a path; it can never add one.
 */
export class ApprovedPaths {
  private readonly approved = new Map<string, ApprovalKind>();

  /** Records paths returned by a dialog of the given kind (bounded; oldest entries are evicted). */
  approve(paths: readonly string[], kind: ApprovalKind): void {
    for (const p of paths) {
      const key = `${kind}:${canonical(p)}`;
      this.approved.delete(key);
      this.approved.set(key, kind);
      if (this.approved.size > MAX_APPROVALS) {
        const oldest = this.approved.keys().next().value;
        if (oldest !== undefined) this.approved.delete(oldest);
      }
    }
  }

  /** True when `filePath` was approved for `kind`. */
  isApproved(filePath: string, kind: ApprovalKind): boolean {
    return this.approved.has(`${kind}:${canonical(filePath)}`);
  }

  /** Reads an approved regular file with the expected extension and a size bound. */
  read(filePath: string, rules: ReadRules): Buffer {
    const real = canonical(filePath);
    if (!this.approved.has(`${rules.kind}:${real}`)) {
      throw new ApprovedPathError('File was not selected through a file dialog');
    }
    if (!rules.extensions.includes(path.extname(real).toLowerCase())) {
      throw new ApprovedPathError('Unexpected file type');
    }
    return readRegularFile(real, rules.maxBytes);
  }
}

/** Process-wide registry used by the IPC handlers. */
export const approvedPaths = new ApprovedPaths();
