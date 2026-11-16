#!/usr/bin/env node
/**
 * i18n parity gate.
 *
 * Compares every locale in packages/shared/src/locales against en.json (source of truth)
 * and reports missing keys, extra keys, and placeholder mismatches ({{var}}).
 * Exit code 1 on any missing/extra key or placeholder mismatch.
 * Plural forms (_zero|_one|_two|_few|_many|_other) are compared by base key, so each language
 * may carry the forms it needs; a locale also fails when a plural family lacks a category its
 * language requires (Intl.PluralRules, see i18n-plurals.mjs).
 *
 * Usage: node scripts/i18n-check.mjs [--json] [--untranslated]
 *   --untranslated  also list values identical to English (informational, never fails)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingPluralForms } from './i18n-plurals.mjs';

const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages/shared/src/locales');
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

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Groups flat keys by base key (plural suffix removed) with the union of their placeholders. */
function groupByBase(flat) {
  const groups = new Map();
  for (const [key, value] of Object.entries(flat)) {
    const base = key.replace(PLURAL_SUFFIX, '');
    const group = groups.get(base) ?? new Set();
    for (const name of placeholders(value).split(',').filter(Boolean)) group.add(name);
    groups.set(base, group);
  }
  return groups;
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
const sourceGroups = groupByBase(source);
const sourceKeys = [...sourceGroups.keys()];
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
  const groups = groupByBase(translations);
  const missing = sourceKeys.filter((key) => !groups.has(key));
  const extra = [...groups.keys()].filter((key) => !sourceGroups.has(key));
  const placeholderMismatch = sourceKeys.filter(
    (key) => groups.has(key) && [...sourceGroups.get(key)].sort().join() !== [...groups.get(key)].sort().join(),
  );
  const untranslated = Object.keys(source).filter(
    (key) => typeof source[key] === 'string' && source[key].length > 3 && translations[key] === source[key],
  );
  const pluralGaps = missingPluralForms(translations, locale);
  if (missing.length || extra.length || placeholderMismatch.length || pluralGaps.length) hasFailure = true;
  report[locale] = { missing, extra, placeholderMismatch, pluralGaps, untranslated };
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
    if (result.pluralGaps.length) problems.push(`${result.pluralGaps.length} incomplete plural`);
    if (showUntranslated && result.untranslated.length)
      problems.push(`${result.untranslated.length} identical to English`);
    if (!problems.length) continue;
    console.log(`  ${locale}: ${problems.join(', ')}`);
    for (const key of result.missing) console.log(`      missing      ${key}`);
    for (const key of result.extra) console.log(`      extra        ${key}`);
    for (const key of result.placeholderMismatch) console.log(`      placeholder  ${key}`);
    for (const gap of result.pluralGaps) console.log(`      plural       ${gap.base} lacks ${gap.missing.join(', ')}`);
    if (showUntranslated) for (const key of result.untranslated) console.log(`      untranslated ${key}`);
  }
  console.log(hasFailure ? 'FAIL' : 'OK — all locales in sync');
}

// exitCode (not exit()) so piped stdout is fully flushed.
process.exitCode = hasFailure ? 1 : 0;
