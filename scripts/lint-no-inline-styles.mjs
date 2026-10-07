#!/usr/bin/env node

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['packages/runtime/src', 'packages/design-system/src'];
const EXCLUDE_REGEX = /\.(?:test|stories)\.tsx$|\.d\.ts$/;
const STRICT = process.argv.includes('--strict');

const ALLOWLIST_BLOCK_PATTERNS = [
  'width: size, height: size',
  'width: px, height: px',
  'width: `${',
  'backgroundColor: getMasteryColor(',
  'backgroundColor: color',
  'backgroundColor: slot',
  'top:',
  'left:',
  'clipPath:',
  'flex:',
  'minHeight:',
  'animationDelay:',
  'animation:',
  'transform:',
  'opacity:',
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
      } else if (s.isFile() && entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory does not exist — skip
  }
  return files;
}

function collectStyleBlock(lines, start) {
  const collected = [lines[start]];
  if (lines[start].includes('}}')) return collected.join('\n');
  for (let i = start + 1; i < lines.length; i++) {
    collected.push(lines[i]);
    if (lines[i].includes('}}')) break;
  }
  return collected.join('\n');
}

function isAllowlisted(content, block) {
  if (content.includes('RuntimeThemeProvider')) return true;
  for (const pattern of ALLOWLIST_BLOCK_PATTERNS) {
    if (block.includes(pattern)) return true;
  }
  return false;
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
      if (lines[i].includes('style={{')) {
        const block = collectStyleBlock(lines, i);
        if (!isAllowlisted(content, block)) {
          violations.push({ file: relPath, line: i + 1 });
        }
      }
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`\u274c Inline style detected in ${v.file}:${v.line}`);
    console.error(`   Use Tailwind utility classes with --oe-* tokens instead.`);
  }
  if (STRICT) process.exit(1);
} else {
  console.log('\u2705 No inline style violations found.');
}
