import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackDirectory, loadPacksDir, PackValidationError } from './loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const KNOWLEDGE_FIXTURE = join(REPO_ROOT, 'examples/packs/knowledge/openedu-fractions');
const CURRICULUM_FIXTURE = join(REPO_ROOT, 'examples/packs/curriculum/nios-math-level-a');

const tempDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'openedu-pack-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function writeManifest(dir: string, overrides: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      format: 'openedu-pack',
      formatVersion: 1,
      type: 'knowledge',
      id: 'sample-pack',
      version: '1.0.0',
      name: 'Sample Pack',
      author: 'OpenEdu',
      language: 'en',
      requires: [],
      ...overrides,
    }),
  );
}

function expectDiagnostic(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('expected PackValidationError');
  } catch (err) {
    expect(err).toBeInstanceOf(PackValidationError);
    const diagnostics = (err as PackValidationError).diagnostics;
    expect(diagnostics.map((d) => d.code)).toContain(code);
  }
}

describe('loadPackDirectory', () => {
  it('loads the knowledge fixture', () => {
    const pack = loadPackDirectory(KNOWLEDGE_FIXTURE);
    expect(pack.manifest.id).toBe('openedu-fractions');
    expect(pack.manifest.version).toBe('0.1.0');
    expect(pack.concepts).toHaveLength(5);
    expect(pack.concepts?.filter((c) => c.source)).toHaveLength(2);
    expect(pack.sources?.['nios-math-ch1']?.title).toBe('NIOS Mathematics Chapter 1');
  });

  it('loads the curriculum fixture', () => {
    const pack = loadPackDirectory(CURRICULUM_FIXTURE);
    expect(pack.curriculum?.units).toHaveLength(2);
    expect(pack.curriculum?.units.reduce((n, u) => n + u.objectives.length, 0)).toBe(3);
  });

  it('reports a missing manifest', () => {
    const dir = makeTmpDir();
    expectDiagnostic(() => loadPackDirectory(dir), 'PACK_MANIFEST_MISSING');
  });

  it('reports an invalid version', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { version: 'v1' });
    expectDiagnostic(() => loadPackDirectory(dir), 'PACK_VERSION_INVALID');
  });

  it('reports an unknown manifest key', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { extra: true });
    expectDiagnostic(() => loadPackDirectory(dir), 'PACK_MANIFEST_INVALID');
  });

  it('reports a missing concepts.json for a knowledge pack', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'knowledge' });
    expectDiagnostic(() => loadPackDirectory(dir), 'KNOWLEDGE_CONCEPT_INVALID');
  });

  it('reports a sourceless concept in a derivedFrom document pack', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'knowledge', derivedFrom: 'document' });
    writeFileSync(
      join(dir, 'concepts.json'),
      JSON.stringify([
        { id: 'a', title: 'A', summary: 'A.', domainTags: ['math'] },
      ]),
    );
    expectDiagnostic(() => loadPackDirectory(dir), 'KNOWLEDGE_SOURCE_MISSING');
  });

  it('reports a concept prerequisite cycle', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'knowledge' });
    writeFileSync(
      join(dir, 'concepts.json'),
      JSON.stringify([
        { id: 'a', title: 'A', summary: 'A.', domainTags: ['math'], prerequisites: ['b'] },
        { id: 'b', title: 'B', summary: 'B.', domainTags: ['math'], prerequisites: ['a'] },
      ]),
    );
    expectDiagnostic(() => loadPackDirectory(dir), 'KNOWLEDGE_PREREQ_CYCLE');
  });

  it('reports an unknown unit prerequisite', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'curriculum' });
    writeFileSync(
      join(dir, 'curriculum.json'),
      JSON.stringify({
        id: 'sample-pack',
        title: 'Sample',
        subject: 'math',
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            prerequisites: ['ghost'],
            objectives: [{ id: 'o1', description: 'Do.', requiresIntents: ['practice'] }],
          },
        ],
      }),
    );
    expectDiagnostic(() => loadPackDirectory(dir), 'CURRICULUM_PREREQ_UNKNOWN');
  });

  it('reports an unknown requiresIntents value', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'curriculum' });
    writeFileSync(
      join(dir, 'curriculum.json'),
      JSON.stringify({
        id: 'sample-pack',
        title: 'Sample',
        subject: 'math',
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            objectives: [{ id: 'o1', description: 'Do.', requiresIntents: ['not-an-intent'] }],
          },
        ],
      }),
    );
    expectDiagnostic(() => loadPackDirectory(dir), 'OBJECTIVE_INTENT_UNKNOWN');
  });

  it('reports a non-array concepts.json', () => {
    const dir = makeTmpDir();
    writeManifest(dir, { type: 'knowledge' });
    writeFileSync(join(dir, 'concepts.json'), JSON.stringify({ nope: true }));
    expectDiagnostic(() => loadPackDirectory(dir), 'KNOWLEDGE_CONCEPT_INVALID');
  });
});

describe('loadPacksDir', () => {
  it('loads the example packs root', () => {
    const { packs, diagnostics } = loadPacksDir(join(REPO_ROOT, 'examples/packs'));
    expect(diagnostics).toEqual([]);
    expect([...packs.keys()].sort()).toEqual(['nios-math-level-a', 'openedu-fractions']);
  });

  it('skips a bad pack and collects its diagnostics without crashing', () => {
    const root = makeTmpDir();
    writeManifest(join(root, 'knowledge', 'good'));
    writeFileSync(
      join(root, 'knowledge', 'good', 'concepts.json'),
      JSON.stringify([{ id: 'a', title: 'A', summary: 'A.', domainTags: ['math'] }]),
    );
    const badDir = join(root, 'knowledge', 'bad');
    writeManifest(badDir, { id: 'bad-pack' });
    writeFileSync(join(badDir, 'concepts.json'), '{ not json');

    const { packs, diagnostics } = loadPacksDir(root);
    expect(packs.has('sample-pack')).toBe(true);
    expect(packs.has('bad-pack')).toBe(false);
    expect(diagnostics.map((d) => d.code)).toContain('PACK_MANIFEST_INVALID');
  });
});
