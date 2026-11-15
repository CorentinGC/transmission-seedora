#!/usr/bin/env node
/**
 * i18n parity gate.
 *
 * Compares every locale in packages/shared/src/locales against en.json (source of truth)
 * and reports missing keys, extra keys, and placeholder mismatches ({{var}}).
 * Exit code 1 on any missing/extra key or placeholder mismatch.
 *
 * Usage: node scripts/i18n-check.mjs [--json] [--untranslated]
 *   --untranslated  also list values identical to English (informational, never fails)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages/shared/src/locales',
);
const SOURCE_LOCALE = 'en';
const asJson = process.argv.includes('--json');
const showUntranslated = process.argv.includes('--untranslated');

/** Flattens nested translation objects into dot-separated keys. */
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, out);
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

/** Returns the sorted list of {{placeholders}} used in a translation value. */
function placeholders(value) {
  if (typeof value !== 'string') return '';
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

function load(locale) {
  const raw = readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8');
  return flatten(JSON.parse(raw));
}

const locales = readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

const source = load(SOURCE_LOCALE);
const sourceKeys = Object.keys(source);
const report = {};
let hasFailure = false;

for (const locale of locales) {
  if (locale === SOURCE_LOCALE) continue;
  let translations;
  try {
    translations = load(locale);
  } catch (error) {
    report[locale] = { invalidJson: error.message };
    hasFailure = true;
    continue;
  }
  const missing = sourceKeys.filter((key) => !(key in translations));
  const extra = Object.keys(translations).filter((key) => !(key in source));
  const placeholderMismatch = sourceKeys.filter(
    (key) => key in translations && placeholders(source[key]) !== placeholders(translations[key]),
  );
  const untranslated = sourceKeys.filter(
    (key) => typeof source[key] === 'string' && source[key].length > 3 && translations[key] === source[key],
  );
  if (missing.length || extra.length || placeholderMismatch.length) hasFailure = true;
  report[locale] = { missing, extra, placeholderMismatch, untranslated };
}

if (asJson) {
  console.log(JSON.stringify({ sourceKeys: sourceKeys.length, locales: report }, null, 2));
} else {
  console.log(`i18n check — ${locales.length} locales, ${sourceKeys.length} keys in ${SOURCE_LOCALE}.json`);
  for (const [locale, result] of Object.entries(report)) {
    if (result.invalidJson) {
      console.log(`  ${locale}: INVALID JSON — ${result.invalidJson}`);
      continue;
    }
    const problems = [];
    if (result.missing.length) problems.push(`${result.missing.length} missing`);
    if (result.extra.length) problems.push(`${result.extra.length} extra`);
    if (result.placeholderMismatch.length) problems.push(`${result.placeholderMismatch.length} placeholder mismatch`);
    if (showUntranslated && result.untranslated.length) problems.push(`${result.untranslated.length} identical to English`);
    if (!problems.length) continue;
    console.log(`  ${locale}: ${problems.join(', ')}`);
    for (const key of result.missing) console.log(`      missing      ${key}`);
    for (const key of result.extra) console.log(`      extra        ${key}`);
    for (const key of result.placeholderMismatch) console.log(`      placeholder  ${key}`);
    if (showUntranslated) for (const key of result.untranslated) console.log(`      untranslated ${key}`);
  }
  console.log(hasFailure ? 'FAIL' : 'OK — all locales in sync');
}

process.exit(hasFailure ? 1 : 0);
