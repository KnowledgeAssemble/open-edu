import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WidgetCatalogEntry } from '@open-edu/schemas';
import type { WidgetDefinitionV2 } from '../types';
import { toCatalogEntry, toWidgetCatalogEntries } from '../catalog-gen';
import { BUILTIN_WIDGETS, WIDGET_LEARNING_INTENTS } from '../builtin-roster';
import { LearningIntent } from '../metadata/learning-intents';
import type { WidgetCapabilities } from '../metadata/capabilities';
import type { AccessibilityMetadata } from '../metadata/accessibility';
import type { AnalyticsMetadata } from '../metadata/analytics';

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

describe('catalog learning intents', () => {
  const validIntents = new Set<string>(Object.values(LearningIntent));

  it('only emits known LearningIntent values and never the reserved `create`', () => {
    for (const entry of toWidgetCatalogEntries(BUILTIN_WIDGETS)) {
      for (const intent of entry.learningIntents ?? []) {
        expect(validIntents.has(intent)).toBe(true);
        expect(intent).not.toBe(LearningIntent.Create);
      }
    }
  });

  it('keeps the union of catalog intents a strict subset of the enum, excluding `create`', () => {
    const union = new Set(
      toWidgetCatalogEntries(BUILTIN_WIDGETS).flatMap((e) => e.learningIntents ?? []),
    );
    expect(union.size).toBeLessThan(Object.values(LearningIntent).length);
    expect(union.has(LearningIntent.Create)).toBe(false);
    for (const intent of union) {
      expect(validIntents.has(intent)).toBe(true);
    }
  });
});

const CAPABILITY_KEYS: (keyof WidgetCapabilities)[] = [
  'supportsObserveMode',
  'supportsKeyboard',
  'supportsScreenReader',
  'supportsHints',
  'supportsRetry',
  'supportsScoring',
  'supportsVoice',
  'supportsOffline',
  'supportsPrinting',
  'supportsTouch',
  'supportsMouse',
  'supportsAnalytics',
  'supportsRewards',
  'supportsAccessibility',
  'supportsAnimation',
  'supportsLocalization',
];

const ACCESSIBILITY_KEYS: (keyof AccessibilityMetadata)[] = [
  'highContrast',
  'keyboardOnly',
  'screenReader',
  'tts',
  'captions',
  'signLanguageReady',
  'easyLanguage',
  'reducedMotion',
  'audioDescription',
  'focusManagement',
  'ariaSupport',
];

const ANALYTICS_KEYS: (keyof AnalyticsMetadata)[] = [
  'trackAttempts',
  'trackHints',
  'trackRetries',
  'trackMistakes',
  'trackCompletionTime',
  'trackSuccessRate',
  'trackConfidence',
  'trackInteractions',
];

describe('catalog boolean flag maps', () => {
  it('emits only known capability/accessibility/analytics keys', () => {
    for (const entry of toWidgetCatalogEntries(BUILTIN_WIDGETS)) {
      for (const key of entry.capabilities ?? []) {
        expect(CAPABILITY_KEYS).toContain(key as keyof WidgetCapabilities);
      }
      for (const key of entry.accessibility ?? []) {
        expect(ACCESSIBILITY_KEYS).toContain(key as keyof AccessibilityMetadata);
      }
      for (const key of entry.analytics ?? []) {
        expect(ANALYTICS_KEYS).toContain(key as keyof AnalyticsMetadata);
      }
    }
  });

  it('only lists supportsVoice on widgets that declare it true', () => {
    const v2ById = new Map(BUILTIN_WIDGETS.map((w) => [w.id, w]));
    for (const entry of toWidgetCatalogEntries(BUILTIN_WIDGETS)) {
      const declaredTrue = v2ById.get(entry.id)?.capabilities?.supportsVoice === true;
      expect((entry.capabilities ?? []).includes('supportsVoice')).toBe(declaredTrue);
    }
  });
});
