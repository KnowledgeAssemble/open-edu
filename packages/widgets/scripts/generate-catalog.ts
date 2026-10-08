#!/usr/bin/env node
/**
 * Generates widget-catalog-data.json in @open-edu/core from the built-in
 * widget roster (single source of truth).
 *
 * Run: pnpm --filter @open-edu/widgets generate:catalog
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { BUILTIN_WIDGETS } = await import('../src/builtin-roster.ts');
const { toWidgetCatalogEntries } = await import('../src/catalog-gen.ts');

const entries = toWidgetCatalogEntries(BUILTIN_WIDGETS);
const outputPath = resolve(__dirname, '../../core/src/widget-catalog-data.json');

writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
console.log(`Generated ${entries.length} widget entries → ${outputPath}`);
