/**
 * `prepare` script: points git at the tracked hooks directory (.beads/hooks, owned by beads,
 * which chains scripts/git-hooks/*). Never overrides an existing core.hooksPath and does
 * nothing in CI or outside a git checkout.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const HOOKS_PATH = '.beads/hooks';

/** Runs git and returns trimmed stdout, or null when the command fails. */
function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

if (process.env.CI || !existsSync('.git')) process.exit(0);

const current = git('config', '--get', 'core.hooksPath');
if (current === HOOKS_PATH) process.exit(0);
if (current) {
  console.warn(
    `core.hooksPath is "${current}", not "${HOOKS_PATH}": commit hooks (lint-staged, commitlint) are inactive.`,
  );
  process.exit(0);
}
git('config', 'core.hooksPath', HOOKS_PATH);
console.log(`core.hooksPath set to ${HOOKS_PATH}`);
