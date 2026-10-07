#!/usr/bin/env node

/**
 * Lint script: detect hardcoded user-facing strings in JSX that should use
 * the i18n `t()` function from @open-edu/i18n.
 *
 * Strategy: scan .tsx files for JSX text content (text between > and <) that
 * looks like a user-facing English string (starts with uppercase, >= 3 chars,
 * not a JSX expression or HTML tag). Ignore test files, type definitions,
 * and allowlisted patterns.
 *
 * Usage:
 *   node scripts/lint-no-hardcoded-strings.mjs           # warn mode
 *   node scripts/lint-no-hardcoded-strings.mjs --strict   # fail on violations
 */

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  'packages/runtime/src/renderers',
  'packages/runtime/src/layout',
  'packages/runtime/src/components',
  'apps/learner/src',
];
const EXCLUDE_REGEX = /\.(?:test|spec|stories)\.[jt]sx$|\.d\.ts$/;
const STRICT = process.argv.includes('--strict');

/**
 * Patterns to ignore — these are known-safe hardcoded strings:
 * - Semantic HTML tags / ARIA roles
 * - CSS class fragments
 * - Test IDs
 * - Icon names / component names
 * - Numeric values
 * - Formatting placeholders
 */
const IGNORE_PATTERNS = [
  // HTML/Aria attributes and roles
  /^role=/,
  /^aria-/,
  /^data-/,
  /^type=/,
  /^name=/,
  /^id=/,
  /^href=/,
  /^tabIndex=/,
  /^className=/,
  /^alt=/,
  /^htmlFor=/,
  /^placeholder=/,

  // JSX expression wrappers (these aren't text content)
  /^\{/,
  /^\(/,

  // Single words that are likely identifiers, not user text
  /^[a-z][a-zA-Z]+$/, // camelCase identifiers
  /^[A-Z][a-zA-Z]+$/, // PascalCase component names
  /^[a-z]+$/, // lowercase single words (roles, types)

  // Numbers and short fragments
  /^\d/,
  /^\//, // paths
  /^http/,
  /^#/, // CSS selectors / hex colors
  /^\./, // relative paths
  /^@/, // package scopes

  // Known-safe UI labels that come from props, not hardcoded
  /^Next$/,
  /^Back$/,
  /^Submit$/,
  /^Loading/,
  /^Error/,
  /^Warning/,
  /^Untitled/,

  // CSS-related
  /calc\(/,
  /var\(--/,
  /px$/,
  /rem$/,
  /%$/,
];

function walkDir(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const s = statSync(fullPath);
      if (s.isDirectory()) {
        files.push(...walkDir(fullPath));
      } else if (s.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory does not exist — skip
  }
  return files;
}

/**
 * Extract JSX text content from a line.
 * Matches text between > and < that looks like user-facing content.
 */
function extractJsxText(line) {
  const results = [];
  // Match patterns like: >Some Text< or > Some Text <
  // Also match: {'Some Text'} inside JSX attributes
  const jsxTextRegex = />(\s*)([A-Z][^<{]{2,})(\s*)</g;
  let match;
  while ((match = jsxTextRegex.exec(line)) !== null) {
    const text = match[2].trim();
    if (text.length >= 3) {
      results.push({ text, column: match.index + match[1].length + 1 });
    }
  }
  return results;
}

function shouldIgnore(text) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasTFunctionUsage(lines, lineIndex) {
  // Check if the line or nearby lines use t() for content
  const surrounding = lines
    .slice(Math.max(0, lineIndex - 2), Math.min(lines.length, lineIndex + 3))
    .join('\n');
  return surrounding.includes("t('") || surrounding.includes('t("');
}

const violations = [];

for (const root of SCAN_ROOTS) {
  const absRoot = join(ROOT, root);
  for (const filePath of walkDir(absRoot)) {
    const relPath = relative(ROOT, filePath);
    if (EXCLUDE_REGEX.test(relPath)) continue;

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const texts = extractJsxText(lines[i]);
      for (const { text, column } of texts) {
        if (!shouldIgnore(text)) {
          violations.push({ file: relPath, line: i + 1, column, text });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n⚠️  i18n: Found ${violations.length} potential hardcoded string(s) in JSX:\n`);
  for (const v of violations) {
    console.error(`  ❌ ${v.file}:${v.line}:${v.column} — "${v.text}"`);
  }
  console.error(`\n  Use t('namespace.key') from @open-edu/i18n for all user-facing strings.`);
  console.error(`  Add the English translation to packages/i18n/locales/en/{namespace}.json\n`);

  if (STRICT) {
    process.exit(1);
  } else {
    console.log('  (Running in warn mode. Use --strict to fail on violations.)\n');
  }
} else {
  console.log('✅ i18n: No hardcoded user-facing strings detected in JSX.');
}
