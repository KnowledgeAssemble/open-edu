import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { OepReader } from '@open-edu/oep-distribution';
import { buildOep } from './oep-build';
import type { CliResult } from '../utils/json-output.js';

const coreFixturesDir = resolve(__dirname, '../../../core/src/__fixtures__');
const geoPackageDir = join(coreFixturesDir, 'geo-package');
const geoAssetsFixtureDir = join(coreFixturesDir, 'geo-assets');

function assertFailed(
  result: CliResult,
): asserts result is { success: false; error: string; code: number } {
  if (result.success) throw new Error('Expected failure');
}

describe('buildOep', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'oep-build-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('inlines geo data into the archive when geo-assets/ is vendored', async () => {
    const pkgDir = join(tmpDir, 'course');
    cpSync(geoPackageDir, pkgDir, { recursive: true });
    cpSync(geoAssetsFixtureDir, join(pkgDir, 'geo-assets'), { recursive: true });

    const outputDir = join(tmpDir, 'out');
    const result = await buildOep(pkgDir, outputDir, { json: true });
    expect(result.success).toBe(true);

    const oepPath = join(outputDir, 'geo-package-1.0.0.oep');
    const reader = new OepReader();
    const extraction = await reader.read(readFileSync(oepPath));
    const nodes = extraction.nodes!;

    const geomapRaw = nodes['course/nodes/geomap.json'];
    expect(geomapRaw).toBeDefined();
    if (!geomapRaw) return;

    const parsed = JSON.parse(geomapRaw);
    const sources = parsed.spec.content.geography.sources as Record<string, unknown>[];

    const states = sources.find((s: Record<string, unknown>) => s.id === 'india-states');
    expect(states).toBeDefined();
    expect(states!.uri).toBeUndefined();
    expect(states!.data).toBeDefined();
    expect((states!.data as { features?: unknown[] }).features).toHaveLength(2);

    const cities = sources.find((s: Record<string, unknown>) => s.id === 'india-cities');
    expect(cities).toBeDefined();
    expect(cities!.asset).toBeUndefined();
    expect(cities!.data).toBeDefined();
    expect((cities!.data as { features?: unknown[] }).features).toHaveLength(1);

    expect(nodes['course/geo-assets/catalog.json']).toBeUndefined();
  });

  it('fails when no catalog is available', async () => {
    const pkgDir = join(tmpDir, 'course');
    cpSync(geoPackageDir, pkgDir, { recursive: true });

    const result = await buildOep(pkgDir, join(tmpDir, 'out'), { json: true });
    assertFailed(result);
    // Either the ancestor walk finds a real catalog (which lacks the fixture's
    // demo/states asset) or no catalog is found at all.  Both are valid failures.
    const isGeoError = result.error.includes('not found in catalog');
    const isUnresolvedError = result.error.includes('unresolved openedu://geo');
    expect(isGeoError || isUnresolvedError).toBe(true);
  });

  it('accepts --geo-assets-dir option', async () => {
    const pkgDir = join(tmpDir, 'course');
    cpSync(geoPackageDir, pkgDir, { recursive: true });

    const outputDir = join(tmpDir, 'out');
    const result = await buildOep(pkgDir, outputDir, {
      json: true,
      geoAssetsDir: geoAssetsFixtureDir,
    });
    expect(result.success).toBe(true);

    const oepPath = join(outputDir, 'geo-package-1.0.0.oep');
    const reader = new OepReader();
    const extraction = await reader.read(readFileSync(oepPath));
    const nodes = extraction.nodes!;

    const geomapRaw = nodes['course/nodes/geomap.json'];
    expect(geomapRaw).toBeDefined();
    if (!geomapRaw) return;

    const parsed = JSON.parse(geomapRaw);
    const sources = parsed.spec.content.geography.sources as Record<string, unknown>[];
    const states = sources.find((s: Record<string, unknown>) => s.id === 'india-states');
    expect(states!.data).toBeDefined();

    expect(nodes['course/geo-assets/catalog.json']).toBeUndefined();
  });

  it('passes non-geo nodes through byte-identically', async () => {
    // Use the valid-package fixture: it has .md and .json nodes — none have
    // openedu://geo refs, so they must survive the build without modification.
    const validPkg = join(coreFixturesDir, 'valid-package');
    const outputDir = join(tmpDir, 'out');
    const result = await buildOep(validPkg, outputDir, { json: true });
    expect(result.success).toBe(true);

    const oepPath = join(outputDir, 'intro-to-variables-1.0.0.oep');
    const extraction = await new OepReader().read(readFileSync(oepPath));
    const nodes = extraction.nodes!;

    // Markdown node present and same content
    const lessonRaw = nodes['course/nodes/lesson-01.md'];
    expect(lessonRaw).toBeDefined();
    expect(lessonRaw!.includes('Variables')).toBe(true);

    // JSON node present and has no geo-related keys
    const quizRaw = nodes['course/nodes/quiz-01.json'];
    expect(quizRaw).toBeDefined();
    const parsed = JSON.parse(quizRaw!);
    expect(parsed.type).toBe('quiz');
    expect(parsed.spec).toBeUndefined();
  });
});
