#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Edit | Write).
 *
 * Runs the cheap gate matching the edited file and feeds failures back to the agent:
 *   - a locale JSON file  -> i18n parity of THAT locale against en.json (scripts/i18n-check.mjs)
 *
 * Only problems in the edited file are reported, so adding a key to 23 files one by one
 * does not raise false alarms; `npm run i18n:check` is the full gate.
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
let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (typeof filePath !== 'string' || filePath === '') process.exit(0);

const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
const localeMatch = /^packages\/shared\/src\/locales\/([a-z-]+)\.json$/i.exec(relativePath);

if (localeMatch && localeMatch[1] !== 'en') {
  const locale = localeMatch[1];
  const result = spawnSync(process.execPath, ['scripts/i18n-check.mjs', '--json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    process.stderr.write(`i18n hook could not run the check: ${result.error.message}\n`);
    process.exit(2);
  }
  let entry;
  try {
    entry = JSON.parse(result.stdout).locales[locale];
  } catch {
    process.stderr.write(`i18n hook could not read the check output for ${locale}.\n`);
    process.exit(2);
  }
  const lines = [];
  if (entry?.invalidJson) lines.push(`invalid JSON: ${entry.invalidJson}`);
  for (const key of entry?.missing ?? []) lines.push(`missing      ${key}`);
  for (const key of entry?.extra ?? []) lines.push(`extra        ${key}`);
  for (const key of entry?.placeholderMismatch ?? []) lines.push(`placeholder  ${key}`);
  if (lines.length) {
    process.stderr.write(
      `i18n parity problems in ${relativePath}:\n${lines.join('\n')}\n` +
        'Every key must exist, truly translated, in all 23 locales. `npm run i18n:check` runs the full gate.\n',
    );
    process.exit(2);
  }
}

process.exit(0);
