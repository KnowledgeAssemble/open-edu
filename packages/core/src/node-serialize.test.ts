import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'node:path';
import { serializeResolvedNodes, hasUnresolvedGeoSources } from './node-serialize.js';
import { loadPackage } from './loader.js';
import { loadNodes } from './nodes-fs.js';
import { ContentNodeSchema } from '@open-edu/schemas';
import type { LoadedNode } from './types.js';

const fixturesDir = resolve(__dirname, '__fixtures__');
const geoAssetsFixtureDir = join(fixturesDir, 'geo-assets');
const geoPackageDir = join(fixturesDir, 'geo-package');

const savedEnvDir = process.env.OPEN_EDU_GEO_ASSETS_DIR;

beforeAll(() => {
  delete process.env.OPEN_EDU_GEO_ASSETS_DIR;
});

afterAll(() => {
  if (savedEnvDir !== undefined) process.env.OPEN_EDU_GEO_ASSETS_DIR = savedEnvDir;
});

describe('serializeResolvedNodes', () => {
  it('yields exactly one entry for the geo-package (nodes/geomap.json)', async () => {
    const pkg = await loadPackage(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    const result = serializeResolvedNodes(pkg.nodes);

    expect(result.size).toBe(1);
    expect(result.has('nodes/geomap.json')).toBe(true);
  });

  it('inlines geo data — states source has data and no uri', async () => {
    const pkg = await loadPackage(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    const result = serializeResolvedNodes(pkg.nodes);
    const bytes = result.get('nodes/geomap.json');
    expect(bytes).toBeDefined();
    if (!bytes) return;

    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const sources = parsed.spec.content.geography.sources as Record<string, unknown>[];

    const states = sources.find((s) => s.id === 'india-states');
    expect(states).toBeDefined();
    expect(states!.uri).toBeUndefined();
    expect(states!.data).toBeDefined();
    expect((states!.data as { features?: unknown[] }).features).toHaveLength(2);

    const cities = sources.find((s) => s.id === 'india-cities');
    expect(cities).toBeDefined();
    expect(cities!.asset).toBeUndefined();
    expect(cities!.data).toBeDefined();
    expect((cities!.data as { features?: unknown[] }).features).toHaveLength(1);

    // Non-geo URI left untouched
    const runtime = sources.find((s) => s.id === 'runtime-resolved');
    expect(runtime).toBeDefined();
    expect(runtime!.uri).toBe('openedu://custom/local');
    expect(runtime!.data).toBeUndefined();

    // Already-inline source left untouched
    const inline = sources.find((s) => s.id === 'already-inline');
    expect(inline).toBeDefined();
    expect(inline!.data).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('serialized output passes ContentNodeSchema', async () => {
    const pkg = await loadPackage(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    const result = serializeResolvedNodes(pkg.nodes);
    const bytes = result.get('nodes/geomap.json');
    expect(bytes).toBeDefined();
    if (!bytes) return;

    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const zodResult = ContentNodeSchema.safeParse(parsed);
    expect(zodResult.success).toBe(true);
  });

  it('returns an empty map when no nodes have geo refs', async () => {
    const minimalPkg = await loadPackage(join(fixturesDir, 'valid-package'));
    const result = serializeResolvedNodes(minimalPkg.nodes);
    expect(result.size).toBe(0);
  });

  it('skips markdown nodes', async () => {
    const nodes = await loadNodes(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    // Ensure we have only .json geo nodes; add a markdown one to verify it's skipped
    const mdNode = {
      path: 'nodes/lesson.md',
      relativePath: 'nodes/lesson.md',
      content: '# Hello',
      node: { type: 'lesson' as const, title: 'Hello' },
    };
    const result = serializeResolvedNodes([...nodes, mdNode]);
    for (const key of result.keys()) {
      expect(key.endsWith('.json')).toBe(true);
    }
  });

  it('serializes composed nodes with resolved engine specs matched by instanceId', async () => {
    const rawEngines = [
      {
        instanceId: 'g1',
        engine: 'geomap',
        spec: {
          content: { geography: { sources: [{ id: 'a', uri: 'openedu://geo/demo/states' }] } },
        },
      },
      { instanceId: 'v1', engine: 'visual', spec: { content: { components: [] } } },
    ];
    const composed: LoadedNode = {
      path: 'nodes/composed.json',
      relativePath: 'nodes/composed.json',
      content: JSON.stringify({ type: 'interactive', engines: rawEngines, bindings: [] }),
      node: {
        type: 'interactive',
        engines: [
          {
            instanceId: 'g1',
            engine: 'geomap',
            spec: {
              content: {
                geography: {
                  sources: [
                    {
                      id: 'a',
                      type: 'geojson',
                      data: { type: 'FeatureCollection', features: [{ id: 'IN-OD' }] },
                    },
                  ],
                },
              },
            },
          },
          {
            instanceId: 'v1',
            engine: 'visual',
            spec: { content: { components: [{ type: 'text' }] } },
          },
        ],
        bindings: [],
      },
    };

    const result = serializeResolvedNodes([composed]);
    expect(result.size).toBe(1);

    const bytes = result.get('nodes/composed.json');
    expect(bytes).toBeDefined();
    if (!bytes) return;

    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    expect(parsed.type).toBe('interactive');
    expect(parsed.engines).toHaveLength(2);

    // g1 spec was resolved (no uri, has data)
    const g1 = parsed.engines.find((e: Record<string, unknown>) => e.instanceId === 'g1');
    expect(g1.spec.content.geography.sources[0].uri).toBeUndefined();
    expect(g1.spec.content.geography.sources[0].data).toBeDefined();

    // v1 spec was resolved too (engine without geo refs gets overlay)
    const v1 = parsed.engines.find((e: Record<string, unknown>) => e.instanceId === 'v1');
    expect(v1.spec.content.components).toHaveLength(1);
    expect(v1.spec.content.components[0].type).toBe('text');
  });
});

describe('hasUnresolvedGeoSources', () => {
  it('returns false after geo resolution with a catalog', async () => {
    const pkg = await loadPackage(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    expect(hasUnresolvedGeoSources(pkg.nodes)).toBe(false);
  });

  it('returns true when geo URIs are left unresolved (no catalog)', async () => {
    const pkg = await loadPackage(geoPackageDir, { resolveGeoAssets: false });
    expect(hasUnresolvedGeoSources(pkg.nodes)).toBe(true);
  });

  it('works with pre-resolved and unresolved nodes together', async () => {
    const pkg = await loadPackage(geoPackageDir, { geoAssetsDir: geoAssetsFixtureDir });
    // After resolution should be clean
    expect(hasUnresolvedGeoSources(pkg.nodes)).toBe(false);

    // Add a fresh unresolved node
    const unresolvedNode = {
      path: 'nodes/composed.json',
      relativePath: 'nodes/composed.json',
      content: JSON.stringify({
        type: 'interactive' as const,
        engines: [
          {
            instanceId: 'g1',
            engine: 'geomap',
            spec: {
              content: {
                geography: {
                  sources: [{ id: 'a', type: 'geojson', uri: 'openedu://geo/demo/states' }],
                },
              },
            },
          },
        ],
        bindings: [],
      }),
      node: {
        type: 'interactive' as const,
        engines: [
          {
            instanceId: 'g1',
            engine: 'geomap' as const,
            spec: {
              content: {
                geography: {
                  sources: [{ id: 'a', type: 'geojson', uri: 'openedu://geo/demo/states' }],
                },
              },
            },
          },
        ],
        bindings: [],
      },
    };
    expect(hasUnresolvedGeoSources([...pkg.nodes, unresolvedNode])).toBe(true);
  });
});
