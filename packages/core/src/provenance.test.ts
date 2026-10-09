import { describe, it, expect } from 'vitest';
import { loadPackageFromFiles } from './file-loader.js';
import { parseProvenance } from './provenance.js';
import type { PackageFileSource } from './types.js';

function makeSource(files: Record<string, string>): PackageFileSource {
  const map = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(files)) {
    map.set(path, new TextEncoder().encode(data));
  }
  return {
    get: (path) => map.get(path),
    list: (prefix) =>
      Array.from(map.keys())
        .filter((p) => !prefix || p.startsWith(prefix))
        .sort(),
  };
}

const BASE_PKG: Record<string, string> = {
  'package.json': JSON.stringify({
    id: 'pkg',
    title: 'Package',
    version: '1.0.0',
    author: 'Open-Edu',
    entry: 'nodes/lesson.md',
  }),
  'nodes/lesson.md': '# Lesson\n\nSome text.',
};

const VALID_RECORD = {
  schemaVersion: 1,
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  generatedAt: '2026-10-08T00:00:00.000Z',
  contextFingerprint: 'sha256:abc',
  nodes: [
    {
      path: 'nodes/lesson.md',
      objectives: ['represent-fraction'],
      concepts: [],
      widgets: [],
      capabilityGaps: [],
    },
  ],
};

describe('parseProvenance', () => {
  it('parses a valid record', () => {
    expect(parseProvenance(JSON.stringify(VALID_RECORD))?.schemaVersion).toBe(1);
  });

  it('returns null for invalid JSON and invalid schema', () => {
    expect(parseProvenance('not json')).toBeNull();
    expect(parseProvenance(JSON.stringify({ ...VALID_RECORD, schemaVersion: 2 }))).toBeNull();
  });
});

describe('loadPackageFromFiles provenance', () => {
  it('attaches a valid provenance record', async () => {
    const source = makeSource({
      ...BASE_PKG,
      'provenance.json': JSON.stringify(VALID_RECORD),
    });
    const pkg = await loadPackageFromFiles(source, 'browser://pkg');
    expect(pkg.provenance?.contextFingerprint).toBe('sha256:abc');
  });

  it('is lenient: invalid JSON never fails the load', async () => {
    const source = makeSource({ ...BASE_PKG, 'provenance.json': '{ broken' });
    const pkg = await loadPackageFromFiles(source, 'browser://pkg');
    expect(pkg.provenance).toBeUndefined();
  });

  it('is lenient: bad schema never fails the load', async () => {
    const source = makeSource({
      ...BASE_PKG,
      'provenance.json': JSON.stringify({ schemaVersion: 99 }),
    });
    const pkg = await loadPackageFromFiles(source, 'browser://pkg');
    expect(pkg.provenance).toBeUndefined();
  });

  it('leaves provenance undefined when the file is missing', async () => {
    const pkg = await loadPackageFromFiles(makeSource(BASE_PKG), 'browser://pkg');
    expect(pkg.provenance).toBeUndefined();
  });
});
