import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WidgetCatalogEntry } from '@open-edu/schemas';
import type { WidgetDefinitionV2 } from '../types';
import { toCatalogEntry, toWidgetCatalogEntries } from '../catalog-gen';
import { BUILTIN_WIDGETS, WIDGET_LEARNING_INTENTS } from '../builtin-roster';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_JSON_PATH = resolve(__dirname, '../../../core/src/widget-catalog-data.json');

const checkedInCatalog: WidgetCatalogEntry[] = JSON.parse(readFileSync(CATALOG_JSON_PATH, 'utf-8'));

function syntheticV2(overrides: Partial<WidgetDefinitionV2> = {}): WidgetDefinitionV2 {
  return {
    id: 'synthetic.widget',
    name: 'Synthetic',
    description: 'A synthetic widget',
    domain: 'synthetic',
    learningIntents: [],
    capabilities: {},
    accessibility: {},
    analytics: {},
    reward: {},
    ai: {},
    status: 'stable',
    render: () => null,
    ...overrides,
  };
}

describe('catalog-gen', () => {
  it('derives capabilities from the boolean map, keeping only true keys', () => {
    const entry = toCatalogEntry(
      syntheticV2({ capabilities: { supportsKeyboard: true, supportsVoice: false } }),
    );
    expect(entry.capabilities).toEqual(['supportsKeyboard']);
  });

  it('emits an empty array when capabilities are absent', () => {
    const entry = toCatalogEntry(syntheticV2({ capabilities: undefined }));
    expect(entry.capabilities).toEqual([]);
  });

  it('generates one entry per roster widget, preserving order', () => {
    const entries = toWidgetCatalogEntries(BUILTIN_WIDGETS);
    expect(entries).toHaveLength(28);
    expect(entries.map((e) => e.id)).toEqual(BUILTIN_WIDGETS.map((w) => w.id));
  });

  it('matches the checked-in widget-catalog-data.json exactly', () => {
    expect(toWidgetCatalogEntries(BUILTIN_WIDGETS)).toEqual(checkedInCatalog);
  });

  it('keeps the roster, intents map, and catalog entry ids set-equal', () => {
    const rosterIds = new Set(BUILTIN_WIDGETS.map((w) => w.id));
    const intentIds = new Set(Object.keys(WIDGET_LEARNING_INTENTS));
    const catalogIds = new Set(checkedInCatalog.map((e) => e.id));
    expect(rosterIds.size).toBe(28);
    expect(intentIds).toEqual(rosterIds);
    expect(catalogIds).toEqual(rosterIds);
  });

  it('gives every entry a complete guide', () => {
    for (const entry of toWidgetCatalogEntries(BUILTIN_WIDGETS)) {
      expect(entry.guide).toBeDefined();
      expect(Object.keys(entry.guide!).sort()).toEqual(
        [
          'configFields',
          'exampleJson',
          'oneLiner',
          'relatedWidgets',
          'setupSteps',
          'sidebarPosition',
          'tips',
          'whatItDoes',
          'whenToUse',
        ].sort(),
      );
    }
  });
});
