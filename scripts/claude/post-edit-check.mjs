#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Edit | Write).
 *
 * Runs the cheap gate matching the edited file and feeds failures back to the agent:
 *   - a locale JSON file  -> i18n parity check (scripts/i18n-check.mjs)
 *
 * Exit code 2 sends stderr back to the agent; any other outcome is silent.
 * Keep this fast: it runs after every edit.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

const raw = await readStdin();
let filePath = '';
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path ?? '';
} catch {
  process.exit(0);
}

const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');

if (/^packages\/shared\/src\/locales\/[a-z-]+\.json$/i.test(relativePath)) {
  const result = spawnSync('node', ['scripts/i18n-check.mjs'], { cwd: repoRoot, encoding: 'utf-8' });
  if (result.status !== 0) {
    const lines = (result.stdout || '').split('\n');
    const summary = lines.filter((line) => /^\s{2}\S/.test(line) || /^(FAIL|i18n check)/.test(line));
    process.stderr.write(
      `i18n parity check failed after editing ${relativePath}:\n${summary.join('\n')}\n` +
        'Every key must exist, truly translated, in all 23 locales. Run `npm run i18n:check` for the key list.\n',
    );
    process.exit(2);
  }
}

process.exit(0);
