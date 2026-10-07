import { access, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { feature as topojsonFeature } from 'topojson-client';
import { NodeLoadError } from './errors.js';
import { coreLoaderLogger } from './logger.js';
import type { LoadedNode } from './types.js';

/**
 * Geo-asset resolution for interactive `geomap` sources.
 *
 * Authored node files reference shared geography as `openedu://geo/{asset-id}`
 * URIs instead of embedding raw TopoJSON/GeoJSON. This module resolves those
 * URIs against a geo-assets dist directory (its `catalog.json` + versioned
 * data files) and inlines a GeoJSON `FeatureCollection` into the node's
 * `geography.sources[].data` field — the shape the geomap engine consumes
 * synchronously at instantiate time.
 *
 * The dist directory is located via (in order): an explicit `geoAssetsDir`
 * option, a `geo-assets/` directory vendored inside the course package
 * (`packageDir/geo-assets`), `OPEN_EDU_GEO_ASSETS_DIR`, or a
 * `<ancestor>/openedu-geo-assets/dist` sibling checkout walking up from the
 * working directory.
 *
 * Resolution is Node-load-time only — `loadPackage` (Node) and `loadNodes`.
 * The browser bundle never imports this module, and `loadPackageFromFiles` /
 * `oep:build` keep authored URIs as-is.
 *
 * The pure helpers (`collectGeoSourceRefs`, `inlineGeoSources`) are framework
 * agnostic; the `*Node`/`*Nodes` helpers are the Node-side entry points wired
 * into `@open-edu/core` loaders. The browser bundle never imports this module.
 */

export const GEO_URI_PREFIX = 'openedu://geo/';

/** A geo-asset catalog entry, mirrored from `geo-assets` `dist/catalog.json`. */
interface CatalogEntry {
  id: string;
  version: string;
  format?: string;
  uri?: string;
  manifest: string;
}

export interface GeoSourceRef {
  index: number;
  source: Record<string, unknown>;
  uri: string;
  version?: string;
}

export interface GeoResolveOptions {
  /** Geo-assets dist directory containing `catalog.json`; authoritative (no discovery fallback). */
  geoAssetsDir?: string;
  /** Course package directory whose optional `geo-assets/` subdir can vendor its own catalog. */
  packageDir?: string;
}

export interface GeoSourceDataLoader {
  (assetId: string, version?: string): Promise<Record<string, unknown> | undefined>;
}

/** Extract the asset id from an `openedu://geo/...` URI, or `undefined`. */
export function parseGeoUri(uri: string): string | undefined {
  if (!uri.startsWith(GEO_URI_PREFIX)) return undefined;
  const assetId = uri.slice(GEO_URI_PREFIX.length);
  return assetId.length > 0 ? assetId : undefined;
}

/**
 * Find `geography.sources[]` entries in a geomap spec that reference a geo
 * asset (either the engine-native `uri` field or the geo-assets
 * `asset: { uri, version }` convention). Sources with inline `data` are
 * skipped.
 */
export function collectGeoSourceRefs(spec: Record<string, unknown>): GeoSourceRef[] {
  const content = spec.content as Record<string, unknown> | undefined;
  const geography = content?.geography as Record<string, unknown> | undefined;
  const sources = geography?.sources;
  if (!Array.isArray(sources)) return [];

  const refs: GeoSourceRef[] = [];
  for (let index = 0; index < sources.length; index++) {
    const raw = sources[index];
    if (typeof raw !== 'object' || raw === null) continue;
    const source = raw as Record<string, unknown>;
    if (source.data !== undefined) continue;

    const directUri = typeof source.uri === 'string' ? source.uri : undefined;
    const asset =
      typeof source.asset === 'object' && source.asset !== null
        ? (source.asset as Record<string, unknown>)
        : undefined;
    const assetUri = typeof asset?.uri === 'string' ? asset.uri : undefined;
    const uri = directUri ?? assetUri;
    if (!uri || !parseGeoUri(uri)) continue;

    refs.push({
      index,
      source,
      uri,
      version: typeof asset?.version === 'string' ? asset.version : undefined,
    });
  }
  return refs;
}

/**
 * Resolve every `openedu://geo/*` source ref in a geomap spec to inline
 * `data` (a GeoJSON FeatureCollection), deleting the `uri`/`asset` reference
 * so the shipped spec is self-contained and offline-first. Mutates `spec` in
 * place and returns it. Non-geo URIs are left untouched for the bridge's own
 * `resolveAsset` handling.
 */
export async function inlineGeoSources(
  spec: Record<string, unknown>,
  load: GeoSourceDataLoader,
): Promise<Record<string, unknown>> {
  for (const ref of collectGeoSourceRefs(spec)) {
    const assetId = parseGeoUri(ref.uri);
    if (!assetId) continue;

    let data: Record<string, unknown> | undefined;
    try {
      data = await load(assetId, ref.version);
    } catch (error) {
      if (error instanceof NodeLoadError) throw error;
      throw new NodeLoadError(
        `Failed to resolve geo source "${ref.uri}": ${(error as Error).message}`,
        { suggestion: 'Check the geo-assets catalog and data files' },
      );
    }

    if (data === undefined) {
      throw new NodeLoadError(
        `Cannot resolve geo source "${ref.uri}" — the data loader returned no data`,
        {
          suggestion:
            `Check the geo-assets catalog for "${ref.uri.slice(GEO_URI_PREFIX.length)}" ` +
            `(Set OPEN_EDU_GEO_ASSETS_DIR to the catalog's dist directory if it was not located)`,
        },
      );
    }

    ref.source.data = data;
    delete ref.source.uri;
    delete ref.source.asset;
    // The inlined data is always a GeoJSON FeatureCollection.
    ref.source.type = 'geojson';
  }
  return spec;
}

/**
 * Locate a usable geo-assets dist directory (one containing `catalog.json`).
 * When an explicit dir is given it is authoritative (no discovery fallback):
 * the directory either has a catalog or resolution fails. Otherwise the
 * candidates are the course package's own `geo-assets/` directory,
 * `OPEN_EDU_GEO_ASSETS_DIR`, then `<ancestor>/openedu-geo-assets/dist` walking
 * up from the working directory.
 */
export async function findGeoAssetsDir(
  extra?: string,
  packageDir?: string,
): Promise<string | undefined> {
  if (extra) {
    return (await hasCatalog(extra)) ? extra : undefined;
  }

  const candidates: string[] = [];
  if (packageDir) candidates.push(join(resolve(packageDir), 'geo-assets'));

  const envDir = process.env.OPEN_EDU_GEO_ASSETS_DIR;
  if (envDir) candidates.push(envDir);

  let ancestor: string | undefined = resolve(process.cwd());
  for (let depth = 0; depth < 12 && ancestor; depth++) {
    candidates.push(join(ancestor, 'openedu-geo-assets', 'dist'));
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }

  for (const candidate of candidates) {
    if (await hasCatalog(candidate)) return candidate;
  }
  return undefined;
}

async function hasCatalog(dir: string): Promise<boolean> {
  try {
    await access(join(dir, 'catalog.json'));
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw new NodeLoadError(
      `Geo-assets directory is not accessible: ${dir} (${(error as Error).message})`,
      {
        file: dir,
      },
    );
  }
}

/**
 * Ensure a resolved path stays inside an expected root so paths taken from
 * catalog/manifest JSON cannot escape the geo-assets directory (mirrors
 * `resolveAssetPath` in `assets.ts`).
 */
function assertWithinRoot(root: string, target: string, what: string): void {
  const rel = relative(resolve(root), resolve(target));
  if (rel.startsWith('..') || /^[A-Za-z]:[\\/]/.test(rel) || rel === '') {
    throw new NodeLoadError(`${what} escapes the geo-assets directory: ${target}`, {
      path: target,
      suggestion: 'Keep catalog manifest and files.data paths inside the geo-assets directory',
    });
  }
}

async function readGeoJsonFile(what: string, file: string): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new NodeLoadError(`${what} not found: ${file}`, { file });
    }
    throw new NodeLoadError(
      `${what} exists but could not be read: ${file} (${(error as Error).message})`,
      {
        file,
      },
    );
  }
  return raw;
}

/**
 * Load a geo asset from a geo-assets dist directory and return it as a
 * GeoJSON FeatureCollection (converting TopoJSON via `topojson-client`).
 * Point/line/polygon GeoJSON assets are passed through as-is.
 */
export async function loadGeoAssetFeatures(
  assetId: string,
  baseDir: string,
  version?: string,
): Promise<Record<string, unknown>> {
  const base = resolve(baseDir);
  const catalogPath = join(base, 'catalog.json');

  let rawCatalog: string;
  try {
    rawCatalog = await readFile(catalogPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new NodeLoadError(`Geo-asset catalog not found: ${catalogPath}`, {
        file: catalogPath,
        suggestion:
          'Set OPEN_EDU_GEO_ASSETS_DIR to the geo-assets dist directory (containing catalog.json)',
      });
    }
    throw new NodeLoadError(
      `Geo-asset catalog exists but could not be read: ${catalogPath} (${(error as Error).message})`,
      { file: catalogPath },
    );
  }

  let catalog: { assets?: CatalogEntry[] };
  try {
    catalog = JSON.parse(rawCatalog) as { assets?: CatalogEntry[] };
  } catch {
    throw new NodeLoadError(`Geo-asset catalog is not valid JSON: ${catalogPath}`, {
      file: catalogPath,
    });
  }

  const entries = Array.isArray(catalog.assets) ? catalog.assets : [];
  const entry = entries.find((e) => e.id === assetId);
  if (!entry) {
    const available = entries.map((e) => e.id).join(', ') || '(none)';
    throw new NodeLoadError(
      `Geo asset not found in catalog: "openedu://geo/${assetId}". Available assets: ${available}`,
      { path: assetId, suggestion: 'Reference an asset id listed in the geo-assets catalog' },
    );
  }

  if (version && entry.version !== version) {
    throw new NodeLoadError(
      `Geo asset version mismatch for "openedu://geo/${assetId}": requested ${version}, catalog has ${entry.version}`,
      { path: assetId, suggestion: 'Drop the version constraint or align it with the catalog' },
    );
  }

  const manifestPath = resolve(base, entry.manifest);
  assertWithinRoot(base, manifestPath, 'Geo-asset manifest path');

  let manifest: { version?: string; format?: string; files?: { data?: string } };
  try {
    manifest = JSON.parse(await readGeoJsonFile('Geo-asset manifest', manifestPath)) as {
      version?: string;
      format?: string;
      files?: { data?: string };
    };
  } catch (error) {
    if (error instanceof NodeLoadError) throw error;
    throw new NodeLoadError(`Geo-asset manifest "${assetId}" is not valid JSON: ${manifestPath}`, {
      file: manifestPath,
    });
  }

  const dataRel = manifest.files?.data;
  if (!dataRel) {
    throw new NodeLoadError(`Geo-asset manifest "${assetId}" has no files.data entry`, {
      file: manifestPath,
    });
  }

  // files.data is relative to the manifest directory (the geo-assets layout).
  const dataRoot = resolve(base, dirname(entry.manifest));
  const dataPath = resolve(dataRoot, dataRel);
  assertWithinRoot(dataRoot, dataPath, 'Geo-asset files.data path');

  let parsed: { type?: string; objects?: Record<string, unknown> };
  try {
    parsed = JSON.parse(await readGeoJsonFile('Geo-asset data', dataPath)) as {
      type?: string;
      objects?: Record<string, unknown>;
    };
  } catch (error) {
    if (error instanceof NodeLoadError) throw error;
    throw new NodeLoadError(`Geo-asset data is not valid JSON: ${dataPath}`, { file: dataPath });
  }

  const format = entry.format ?? manifest.format ?? 'geojson';
  if (format === 'topojson') {
    const objects = (parsed.objects ?? {}) as Record<string, unknown>;
    const objectNames = Object.keys(objects);
    if (objectNames.length === 0) {
      throw new NodeLoadError(`TopoJSON asset "${assetId}" has no objects`, {
        file: dataPath,
      });
    }
    const topology = parsed as unknown as Parameters<typeof topojsonFeature>[0];
    const features: unknown[] = [];
    for (const name of objectNames) {
      const result = topojsonFeature(
        topology,
        objects[name] as unknown as Parameters<typeof topojsonFeature>[1],
      );
      if (result && Array.isArray((result as { features?: unknown }).features)) {
        features.push(...(result as unknown as { features: unknown[] }).features);
      } else {
        features.push(result);
      }
    }
    return { type: 'FeatureCollection', features } as unknown as Record<string, unknown>;
  }

  return parsed as unknown as Record<string, unknown>;
}

/**
 * Resolve `openedu://geo/*` sources in a single spec (single-engine or
 * composed lesson). Best-effort: when no geo-assets catalog is discoverable
 * the URIs are left in place (the package still loads), but once a catalog is
 * found, missing/unknown assets fail fast with authoring guidance.
 */
export async function resolveGeoUrisInSpec(
  spec: Record<string, unknown>,
  options?: GeoResolveOptions,
): Promise<void> {
  if (collectGeoSourceRefs(spec).length === 0) return;
  const baseDir = await findGeoAssetsDir(options?.geoAssetsDir, options?.packageDir);
  if (!baseDir) {
    if (options?.geoAssetsDir) {
      throw new NodeLoadError(
        `geoAssetsDir does not contain a geo-assets catalog: ${options.geoAssetsDir}`,
        {
          file: options.geoAssetsDir,
          suggestion:
            'Point geoAssetsDir at the geo-assets dist directory (containing catalog.json)',
        },
      );
    }
    coreLoaderLogger.warn(
      'openedu://geo/* sources left unresolved — no geo-assets catalog found. ' +
        'Vendor a geo-assets/ catalog in the course package, set OPEN_EDU_GEO_ASSETS_DIR ' +
        'to the geo-assets dist directory, or pass { geoAssetsDir }.',
    );
    return;
  }
  await inlineGeoSources(spec, async (assetId, version) =>
    loadGeoAssetFeatures(assetId, baseDir, version),
  );
}

/** Walk a node's spec (and each engine's spec) and call visit for each. Mirrors resolveGeoUrisInNode traversal. */
export function forEachInteractiveSpec(
  node: { spec?: unknown; engines?: Array<{ spec?: unknown }> | undefined },
  visit: (spec: Record<string, unknown>) => void,
): void {
  if (node.spec) {
    visit(node.spec as Record<string, unknown>);
  }
  for (const engine of node.engines ?? []) {
    if (engine.spec) {
      visit(engine.spec as Record<string, unknown>);
    }
  }
}

/** Resolve geo sources on a single interactive node (spec + composed engines). */
export async function resolveGeoUrisInNode(
  node: LoadedNode,
  options?: GeoResolveOptions,
): Promise<void> {
  if (node.node.type !== 'interactive') return;
  if (node.node.spec) {
    await resolveGeoUrisInSpec(node.node.spec as Record<string, unknown>, options);
  }
  for (const engine of node.node.engines ?? []) {
    if (engine.spec) {
      await resolveGeoUrisInSpec(engine.spec as Record<string, unknown>, options);
    }
  }
}

/** Resolve geo sources across many loaded nodes (no-op when none reference geo URIs). */
export async function resolveGeoUrisInNodes(
  nodes: LoadedNode[],
  options?: GeoResolveOptions,
): Promise<void> {
  for (const node of nodes) {
    await resolveGeoUrisInNode(node, options);
  }
}
