/**
 * i18n key validation test.
 *
 * Scans runtime renderers and learner components for t('namespace.key') calls
 * and verifies every key exists in the corresponding English locale file.
 * This catches typos, missing translations, and namespace mismatches.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(import.meta.dirname, '../locales/en');

const SCAN_DIRS = [
  join(import.meta.dirname, '../../../packages/runtime/src/renderers'),
  join(import.meta.dirname, '../../../packages/runtime/src/layout'),
  join(import.meta.dirname, '../../../packages/runtime/src/components'),
  join(import.meta.dirname, '../../../apps/learner/src'),
];

function loadAllDictionaries(): Record<string, Record<string, string>> {
  const dictionaries: Record<string, Record<string, string>> = {};
  try {
    const entries = readdirSync(LOCALES_DIR);
    for (const entry of entries) {
      const filePath = join(LOCALES_DIR, entry);
      const stat = statSync(filePath);
      if (stat.isFile() && entry.endsWith('.json')) {
        const namespace = entry.replace('.json', '');
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        dictionaries[namespace] = data;
      }
    }
  } catch {
    // locales dir doesn't exist
  }
  return dictionaries;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const s = statSync(fullPath);
      if (s.isDirectory()) {
        files.push(...walkDir(fullPath));
      } else if (
        s.isFile() &&
        (entry.endsWith('.tsx') || entry.endsWith('.ts')) &&
        !entry.endsWith('.test.tsx') &&
        !entry.endsWith('.test.ts') &&
        !entry.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

/**
 * Extract t() call keys from source code.
 * Matches patterns like: t('runtime.quiz.submit') or t("learner.settings.theme")
 */
function extractTranslationKeys(source: string): string[] {
  const keys: string[] = [];
  const regex = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*?)['"]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    if (match[1]) keys.push(match[1]);
  }
  return keys;
}

describe('i18n key validation', () => {
  const dictionaries = loadAllDictionaries();
  const allKeys: string[] = [];

  for (const dir of SCAN_DIRS) {
    for (const filePath of walkDir(dir)) {
      const source = readFileSync(filePath, 'utf-8');
      const keys = extractTranslationKeys(source);
      for (const key of keys) {
        allKeys.push(key);
      }
    }
  }

  const uniqueKeys = [...new Set(allKeys)];

  it('discovers locale dictionaries and scanned t() keys (non-vacuous)', () => {
    expect(Object.keys(dictionaries).length).toBeGreaterThan(0);
    expect(uniqueKeys.length).toBeGreaterThan(0);
  });

  it('all t() keys have a namespace prefix (namespace.key format)', () => {
    const invalidKeys = uniqueKeys.filter((key) => {
      const dotIndex = key.indexOf('.');
      if (dotIndex <= 0) return true;
      const namespace = key.slice(0, dotIndex);
      return !['runtime', 'learner', 'widgets', 'schemas', 'notes'].includes(namespace);
    });

    if (invalidKeys.length > 0) {
      console.error('Keys without valid namespace:', invalidKeys);
    }
    expect(invalidKeys).toEqual([]);
  });

  it('all t() keys resolve to a value in the English locale files', () => {
    const missingKeys: Array<{ key: string; namespace: string }> = [];

    for (const key of uniqueKeys) {
      const dotIndex = key.indexOf('.');
      if (dotIndex <= 0) continue;

      const namespace = key.slice(0, dotIndex);
      const dictKey = key.slice(dotIndex + 1);

      const dict = dictionaries[namespace];
      if (!dict || !(dictKey in dict)) {
        missingKeys.push({ key, namespace });
      }
    }

    if (missingKeys.length > 0) {
      console.error(
        'Missing i18n keys in locale files:',
        missingKeys.map((m) => `  ${m.key} (namespace: ${m.namespace})`).join('\n'),
      );
    }
    expect(missingKeys).toEqual([]);
  });
});
