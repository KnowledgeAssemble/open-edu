import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { OepReader } from '@open-edu/oep-distribution';
import { buildOepBundle } from './oep-build-bundle';

const coreFixturesDir = resolve(__dirname, '../../../core/src/__fixtures__');
const geoAssetsFixtureDir = join(coreFixturesDir, 'geo-assets');

const validBundleManifest = {
  id: 'test-bundle',
  title: 'Test Bundle',
  version: '1.0.0',
  author: 'Test',
  modules: [{ id: 'mod-a', title: 'Module A', path: './modules/mod-a', dependsOn: [] }],
};

const validPackageManifest = {
  id: 'mod-a',
  title: 'Module A',
  version: '1.0.0',
  author: 'Test',
  entry: 'nodes/lesson.md',
};

const geoPackageManifest = {
  id: 'mod-geo',
  title: 'Geo Module',
  version: '1.0.0',
  author: 'Test',
  entry: 'nodes/geomap.json',
};

describe('buildOepBundle', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'oep-bundle-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('includes bundle-root rewards.json and cards.json in the output', async () => {
    const dir = join(tmpDir, 'bundle');
    mkdirSync(join(dir, 'modules', 'mod-a', 'nodes'), { recursive: true });
    writeFileSync(
      join(dir, 'bundle.json'),
      JSON.stringify({ ...validBundleManifest, rewards: './rewards.json', cards: './cards.json' }),
    );
    writeFileSync(join(dir, 'rewards.json'), JSON.stringify({ triggers: [] }));
    writeFileSync(join(dir, 'cards.json'), JSON.stringify({ cards: [] }));
    writeFileSync(
      join(dir, 'modules', 'mod-a', 'package.json'),
      JSON.stringify(validPackageManifest),
    );
    writeFileSync(join(dir, 'modules', 'mod-a', 'nodes', 'lesson.md'), '# Lesson');

    const outputDir = join(tmpDir, 'out');
    const result = await buildOepBundle(dir, outputDir, { json: true });
    expect(result.success).toBe(true);

    const oepPath = join(outputDir, 'test-bundle-1.0.0.oep');
    const extraction = await new OepReader().read(readFileSync(oepPath));
    expect(extraction.rewards).toEqual({ triggers: [] });
    expect(extraction.cards).toEqual({ cards: [] });
  });

  it('inlines geo data in a module with vendored geo-assets/', async () => {
    const dir = join(tmpDir, 'bundle');
    mkdirSync(join(dir, 'modules', 'mod-geo', 'nodes'), { recursive: true });
    writeFileSync(
      join(dir, 'bundle.json'),
      JSON.stringify({
        ...validBundleManifest,
        id: 'geo-bundle-test',
        modules: [{ id: 'mod-geo', title: 'Geo Module', path: './modules/mod-geo', dependsOn: [] }],
      }),
    );
    writeFileSync(
      join(dir, 'modules', 'mod-geo', 'package.json'),
      JSON.stringify(geoPackageManifest),
    );

    // Copy geo-package fixture's node and vendor geo-assets/
    const geoNodeDir = resolve(__dirname, '../../../core/src/__fixtures__/geo-package/nodes');
    cpSync(
      join(geoNodeDir, 'geomap.json'),
      join(dir, 'modules', 'mod-geo', 'nodes', 'geomap.json'),
    );
    cpSync(geoAssetsFixtureDir, join(dir, 'modules', 'mod-geo', 'geo-assets'), { recursive: true });

    const outputDir = join(tmpDir, 'out');
    const result = await buildOepBundle(dir, outputDir, { json: true });
    expect(result.success).toBe(true);

    const oepPath = join(outputDir, 'geo-bundle-test-1.0.0.oep');
    const extraction = await new OepReader().read(readFileSync(oepPath));
    expect(extraction.modules).toBeDefined();
    expect(extraction.modules).toHaveLength(1);
    const geoModule = extraction.modules![0];
    expect(geoModule).toBeDefined();
    if (!geoModule) return;

    const geomapRaw = geoModule.nodes['bundle/modules/mod-geo/nodes/geomap.json'];
    expect(geomapRaw).toBeDefined();
    if (!geomapRaw) return;

    const parsed = JSON.parse(geomapRaw);
    const sources = parsed.spec.content.geography.sources as Record<string, unknown>[];

    const states = sources.find((s: Record<string, unknown>) => s.id === 'india-states');
    expect(states).toBeDefined();
    expect(states!.uri).toBeUndefined();
    expect(states!.data).toBeDefined();
    expect((states!.data as { features?: unknown[] }).features).toHaveLength(2);

    // geo-assets/ should not appear in any module's nodes
    expect(geoModule.nodes['bundle/modules/mod-geo/geo-assets/catalog.json']).toBeUndefined();
  });
});
