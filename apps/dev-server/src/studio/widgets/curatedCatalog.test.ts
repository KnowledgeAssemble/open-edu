import { describe, it, expect, beforeEach } from 'vitest';
import widgetCatalogData from '@open-edu/core/widget-catalog-data';
import { renderWidgetGuideMarkdown } from '@open-edu/widgets/guide';
import {
  listCuratedWidgets,
  getCuratedWidget,
  loadCatalogWidgets,
  listConfiguredRegistryIds,
  shouldReadConfiguredCatalogFiles,
  __resetCatalogCache,
} from './curatedCatalog';

describe('curatedCatalog', () => {
  beforeEach(() => {
    __resetCatalogCache();
  });

  it('returns only non-deprecated widgets', () => {
    const list = listCuratedWidgets();
    expect(list.length).toBeGreaterThanOrEqual(20);
    expect(list.every((w) => w.id && w.name && !w.deprecated && w.status !== 'deprecated')).toBe(
      true,
    );
    expect(getCuratedWidget('core.multiple-choice')?.id).toBe('core.multiple-choice');
  });

  it('excludes unknown ids', () => {
    expect(getCuratedWidget('not.a.widget')).toBeUndefined();
  });

  it('excludes deprecated widgets from the list', () => {
    const ids = listCuratedWidgets().map((w) => w.id);
    expect(ids).not.toContain('open-edu.multiple-choice-practice');
  });

  it('sources guide config fields from the real catalog data', () => {
    const widget = getCuratedWidget('core.multiple-choice');
    expect(widget?.guide?.configFields?.length ?? 0).toBeGreaterThan(0);
    const names = widget?.guide?.configFields?.map((field) => field.name) ?? [];
    expect(names).toContain('questions');
  });

  it('exposes a guideMarkdown string for widgets with a guide', () => {
    const markdown = getCuratedWidget('core.multiple-choice')?.guideMarkdown ?? '';
    expect(markdown.length).toBeGreaterThan(0);
    expect(markdown).toContain('Multiple Choice');
  });

  it('renders guideMarkdown through the shared @open-edu/widgets/guide renderer', () => {
    const entry = widgetCatalogData.find((w) => w.id === 'core.multiple-choice');
    expect(entry).toBeDefined();
    expect(getCuratedWidget('core.multiple-choice')?.guideMarkdown).toBe(
      renderWidgetGuideMarkdown(entry!),
    );
  });

  it('marks built-in widgets as source builtin, native trustTier, version 0.1.0', () => {
    const matching = getCuratedWidget('core.matching');
    expect(matching?.source).toBe('builtin');
    expect(matching?.trustTier).toBe('native');
    expect(matching?.version).toBe('0.1.0');
  });

  it('merges registry widgets, skipping revoked and flagging experimental/sandboxed', () => {
    const catalog = {
      registryId: 'community-registry',
      origin: 'https://widgets.example.edu',
      widgets: [
        {
          id: 'community.example.counter',
          version: '1.0.0',
          manifestUrl: 'https://widgets.example.edu/community.example.counter/1.0.0/manifest.json',
          status: 'experimental',
          trustTier: 'sandboxed',
          offline: true,
        },
        {
          id: 'community.example.revoked',
          version: '1.0.0',
          manifestUrl: 'https://widgets.example.edu/community.example.revoked/1.0.0/manifest.json',
          status: 'revoked',
          trustTier: 'sandboxed',
          offline: false,
        },
      ],
    };
    const map = loadCatalogWidgets([catalog]);
    const experiment = map.get('community.example.counter');
    expect(experiment?.source).toBe('registry');
    expect(experiment?.trustTier).toBe('sandboxed');
    expect(experiment?.experimental).toBe(true);
    expect(experiment?.version).toBe('1.0.0');
    expect(experiment?.offline).toBe(true);
    expect(experiment?.registryId).toBe('community-registry');
    expect(map.get('community.example.revoked')).toBeUndefined();
  });

  it('passes through manifest integrity from the catalog', () => {
    const integrity = 'sha256-' + 'ab'.repeat(32);
    const catalog = {
      registryId: 'community-registry',
      origin: 'https://widgets.example.edu',
      widgets: [
        {
          id: 'community.example.counter',
          version: '1.0.0',
          manifestUrl: 'https://widgets.example.edu/community.example.counter/1.0.0/manifest.json',
          integrity,
          status: 'verified',
          trustTier: 'sandboxed',
          offline: true,
        },
      ],
    };
    const map = loadCatalogWidgets([catalog]);
    const widget = map.get('community.example.counter');
    expect(widget?.integrity).toBe(integrity);
  });

  it('lets a built-in win when a registry entry collides with the same id', () => {
    const catalog = {
      registryId: 'collision-registry',
      origin: 'https://widgets.example.edu',
      widgets: [
        {
          id: 'core.matching',
          version: '9.9.9',
          manifestUrl: 'https://widgets.example.edu/core.matching/9.9.9/manifest.json',
          status: 'verified',
          trustTier: 'sandboxed',
          offline: false,
        },
      ],
    };
    const map = loadCatalogWidgets([catalog]);
    const widget = map.get('core.matching');
    expect(widget?.source).toBe('builtin');
    expect(widget?.trustTier).toBe('native');
    expect(widget?.version).toBe('0.1.0');
  });

  it('lists configured registry ids, excluding builtins and deduplicating', () => {
    const original = (globalThis as Record<string, unknown>).__OPEN_EDU_STUDIO_CATALOGS__;
    (globalThis as Record<string, unknown>).__OPEN_EDU_STUDIO_CATALOGS__ = [
      {
        registryId: 'community-registry',
        origin: 'https://widgets.example.edu',
        widgets: [
          {
            id: 'community.example.counter',
            version: '1.0.0',
            manifestUrl:
              'https://widgets.example.edu/community.example.counter/1.0.0/manifest.json',
            status: 'experimental',
            trustTier: 'sandboxed',
            offline: true,
          },
          {
            id: 'community.example.clock',
            version: '1.0.0',
            manifestUrl: 'https://widgets.example.edu/community.example.clock/1.0.0/manifest.json',
            status: 'verified',
            trustTier: 'sandboxed',
            offline: false,
          },
        ],
      },
    ];
    __resetCatalogCache();
    loadCatalogWidgets();
    const ids = listConfiguredRegistryIds();
    expect(ids).toContain('community-registry');
    expect(ids.filter((id) => id === 'community-registry')).toHaveLength(1);
    expect(ids).not.toContain('core.matching');
    (globalThis as Record<string, unknown>).__OPEN_EDU_STUDIO_CATALOGS__ = original;
  });

  it('reads catalog files when import.meta.env is undefined (SSR regression)', () => {
    // The Vite middleware executes modules in plain Node ESM, where Vite's
    // `import.meta.env` injection is absent (env === undefined). Regression:
    // this used to throw "Cannot read properties of undefined (reading 'SSR')".
    expect(shouldReadConfiguredCatalogFiles(undefined)).toBe(true);
  });

  it('skips catalog files in a browser bundle (non-SSR)', () => {
    expect(shouldReadConfiguredCatalogFiles({})).toBe(false);
    expect(shouldReadConfiguredCatalogFiles({ SSR: false })).toBe(false);
  });

  it('reads catalog files in SSR mode', () => {
    expect(shouldReadConfiguredCatalogFiles({ SSR: true })).toBe(true);
  });
});
