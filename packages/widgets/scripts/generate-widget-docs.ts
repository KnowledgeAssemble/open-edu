#!/usr/bin/env node
/**
 * Generates per-widget documentation pages from the guide field on the built-in
 * widget roster (builtin-roster.ts → catalog-gen.ts). Writes markdown to
 * apps/docs/docs/widget-library/.
 *
 * Run: pnpm --filter @open-edu/widgets generate:widget-docs
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWidgetGuideMarkdown } from '../src/guide-markdown.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { BUILTIN_WIDGETS } = await import('../src/builtin-roster.ts');
const { toWidgetCatalogEntries } = await import('../src/catalog-gen.ts');

const entriesWithGuide = toWidgetCatalogEntries(BUILTIN_WIDGETS).filter(
  (e) => !e.deprecated && e.guide,
);

const outputBaseDir = resolve(__dirname, '../../../apps/docs/docs/widget-library');

const domains = [...new Set(entriesWithGuide.map((e) => e.domain!))];

for (const domain of domains) {
  const domainDir = join(outputBaseDir, domain);
  if (existsSync(domainDir)) {
    const staleFiles = readdirSync(domainDir).filter((f) => f.endsWith('.md'));
    for (const file of staleFiles) {
      unlinkSync(join(domainDir, file));
    }
  }
  mkdirSync(domainDir, { recursive: true });
}

for (const entry of entriesWithGuide) {
  const g = entry.guide!;
  const body = renderWidgetGuideMarkdown(entry);
  const md = `---\nsidebar_position: ${g.sidebarPosition}\n---\n\n` + body;
  const filename = entry.id.split('.').slice(1).join('-') + '.md';
  const filePath = join(outputBaseDir, entry.domain!, filename);
  writeFileSync(filePath, md, 'utf-8');
}

console.log(`Generated ${entriesWithGuide.length} widget doc pages → ${outputBaseDir}`);
