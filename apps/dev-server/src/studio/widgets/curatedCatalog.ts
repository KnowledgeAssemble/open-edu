import type { WidgetCatalogEntry } from '@open-edu/core';
import widgetCatalogData from '@open-edu/core/widget-catalog-data';
import { loadStaticCatalog } from '@open-edu/widgets/catalog';
import { renderWidgetGuideMarkdown } from '@open-edu/widgets/guide';
import * as nodeFs from 'node:fs';

const CATALOG_ENTRIES: WidgetCatalogEntry[] = widgetCatalogData;

export interface CuratedWidget {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  status?: string;
  deprecated?: boolean;
  source: 'builtin' | 'registry';
  registryId?: string;
  trustTier: 'native' | 'sandboxed';
  version: string;
  integrity?: string;
  offline?: boolean;
  experimental?: boolean;
  configSchema?: Record<string, unknown>;
  guide?: Partial<NonNullable<WidgetCatalogEntry['guide']>>;
  guideMarkdown?: string;
}

export function loadCatalogWidgets(
  catalogFiles: unknown[] = getConfiguredCatalogFiles(),
): Map<string, CuratedWidget> {
  const widgets = new Map<string, CuratedWidget>();
  for (const entry of CATALOG_ENTRIES) {
    widgets.set(entry.id, {
      id: entry.id,
      name: entry.name ?? entry.id,
      description: entry.description,
      domain: entry.domain,
      status: entry.status,
      deprecated: entry.deprecated,
      source: 'builtin',
      trustTier: 'native',
      version: '0.1.0',
      experimental: entry.status === 'experimental',
      guide: entry.guide,
      guideMarkdown: entry.guide ? renderWidgetGuideMarkdown(entry) : undefined,
    });
  }
  for (const catalog of catalogFiles) {
    let staticCatalog;
    try {
      staticCatalog = loadStaticCatalog(catalog);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('skipping unparseable widget catalog', err);
      continue;
    }
    for (const entry of staticCatalog.widgets.values()) {
      if (entry.status === 'revoked') continue;
      if (widgets.has(entry.id)) continue;
      widgets.set(entry.id, {
        id: entry.id,
        name: entry.id,
        source: 'registry',
        registryId: staticCatalog.registryId,
        trustTier: entry.trustTier,
        version: entry.version,
        integrity: entry.integrity,
        offline: entry.offline,
        experimental: entry.status === 'experimental',
        status: entry.status,
      });
    }
  }
  return widgets;
}

/**
 * Decide whether to read `OPEN_EDU_STUDIO_CATALOGS` files from the server
 * filesystem. Vite injects `import.meta.env` into browser-bundled code and
 * into SSR-transformed server code, but the Vite middleware executes modules in
 * plain Node ESM where `import.meta.env` is `undefined` — which is still the
 * server, so catalog files should be read there.
 *
 * @param env The value of `import.meta.env`, or `undefined` when it is absent.
 * @returns `true` when running on the server (SSR or plain Node).
 */
export function shouldReadConfiguredCatalogFiles(env?: { SSR?: unknown }): boolean {
  if (env === undefined) return true;
  return env.SSR === true;
}

function getConfiguredCatalogFiles(): unknown[] {
  const globalCatalogs = (globalThis as Record<string, unknown>).__OPEN_EDU_STUDIO_CATALOGS__;
  if (Array.isArray(globalCatalogs)) return globalCatalogs;
  const env = (import.meta as { env?: { SSR?: unknown } }).env;
  if (!shouldReadConfiguredCatalogFiles(env)) return [];
  const envPaths = process.env.OPEN_EDU_STUDIO_CATALOGS;
  if (!envPaths) return [];
  return envPaths
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((filePath) => {
      try {
        return JSON.parse(nodeFs.readFileSync(filePath, 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter((catalog): catalog is unknown => catalog !== null);
}

let _cache: Map<string, CuratedWidget> | null = null;

function getCatalogMap(): Map<string, CuratedWidget> {
  if (!_cache) _cache = loadCatalogWidgets();
  return _cache;
}

export function __resetCatalogCache(): void {
  _cache = null;
}

export function listCuratedWidgets(): CuratedWidget[] {
  return [...getCatalogMap().values()].filter(
    (widget) => widget.status !== 'deprecated' && widget.deprecated !== true,
  );
}

export function getCuratedWidget(id: string): CuratedWidget | undefined {
  const widget = getCatalogMap().get(id);
  if (!widget || widget.status === 'deprecated' || widget.deprecated === true) return undefined;
  return widget;
}

export function listConfiguredRegistryIds(): string[] {
  return [
    ...new Set(
      [...getCatalogMap().values()]
        .filter((w) => w.source === 'registry' && w.registryId)
        .map((w) => w.registryId as string),
    ),
  ];
}
