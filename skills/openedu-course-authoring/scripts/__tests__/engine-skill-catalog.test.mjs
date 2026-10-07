import { describe, it } from 'node:test';
import { ok, strictEqual, deepStrictEqual } from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadEngineSkillsCatalog,
  getEngineEntry,
  isKnownEngineType,
  getEngineKinds,
  loadEngineSkillDoc,
  loadEngineSchema,
  loadEngineSkillExample,
} from '../engine-skill-catalog.mjs';

function createTempDir() {
  const base = join(
    tmpdir(),
    `engine-skill-catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(base, { recursive: true });
  return base;
}

function makeFixtureManifest() {
  return {
    package: 'engine-skills',
    version: '0.1.0',
    schemaVersion: 1,
    engines: [
      {
        type: 'visual',
        skill: 'educational-visual',
        kinds: ['number-line', 'graph'],
        skillDoc: 'skills/visual/SKILL.md',
        schema: 'skills/visual/schema.json',
        example: 'skills/visual/skill-example.json',
        validationContract: { package: 'engine-skills', symbol: 'validateSpec', method: 'visual' },
        namespacedEvents: ['visual:render', 'visual:select'],
      },
      {
        type: 'chart',
        skill: 'quantitative-chart',
        kinds: ['bar', 'line', 'pie'],
        skillDoc: 'skills/chart/SKILL.md',
        schema: 'skills/chart/schema.json',
        example: 'skills/chart/skill-example.json',
        validationContract: { package: 'engine-skills', symbol: 'validateSpec', method: 'chart' },
        namespacedEvents: ['chart:render'],
      },
      {
        type: 'geomap',
        skill: 'geographic-map',
        kinds: [],
        skillDoc: 'skills/geomap/SKILL.md',
        schema: 'skills/geomap/schema.json',
        example: 'skills/geomap/skill-example.json',
        validationContract: { package: 'engine-skills', symbol: 'validateSpec', method: 'geomap' },
        namespacedEvents: [],
      },
      {
        type: 'composition',
        skill: 'composition',
        kinds: [],
        skillDoc: 'skills/composition/SKILL.md',
        schema: 'skills/composition/schema.json',
        example: 'skills/composition/skill-example.json',
        validationContract: {
          package: 'engine-skills',
          symbol: 'validateSpec',
          method: 'composition',
        },
        namespacedEvents: [],
      },
    ],
  };
}

describe('engine-skill-catalog loadEngineSkillsCatalog', () => {
  it('loads a valid manifest', () => {
    const dir = createTempDir();
    try {
      const manifestPath = join(dir, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(makeFixtureManifest()));
      const result = loadEngineSkillsCatalog(manifestPath);
      strictEqual(result.available, true);
      strictEqual(result.reason, null);
      strictEqual(result.engines.length, 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns unavailable for missing file', () => {
    const dir = createTempDir();
    try {
      const result = loadEngineSkillsCatalog(join(dir, 'nonexistent.json'));
      strictEqual(result.available, false);
      strictEqual(result.reason, 'catalog-not-found');
      deepStrictEqual(result.engines, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns unavailable for null path', () => {
    const result = loadEngineSkillsCatalog(null);
    strictEqual(result.available, false);
    strictEqual(result.reason, 'catalog-not-found');
  });

  it('returns unavailable for malformed JSON', () => {
    const dir = createTempDir();
    try {
      const manifestPath = join(dir, 'manifest.json');
      writeFileSync(manifestPath, '{ invalid json }');
      const result = loadEngineSkillsCatalog(manifestPath);
      strictEqual(result.available, false);
      strictEqual(result.reason, 'catalog-parse-error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns unavailable when engines is missing', () => {
    const dir = createTempDir();
    try {
      const manifestPath = join(dir, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify({ package: 'engine-skills', version: '0.1.0' }));
      const result = loadEngineSkillsCatalog(manifestPath);
      strictEqual(result.available, false);
      strictEqual(result.reason, 'catalog-missing-engines');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('engine-skill-catalog lookup helpers', () => {
  it('getEngineEntry finds engine by type', () => {
    const { engines } = loadEngineSkillsCatalog(null);
    const eng = [{ type: 'visual', skill: 'educational-visual' }];
    const entry = getEngineEntry(eng, 'visual');
    ok(entry);
    strictEqual(entry.skill, 'educational-visual');
  });

  it('getEngineEntry returns undefined for unknown type', () => {
    const eng = [{ type: 'visual', skill: 'educational-visual' }];
    strictEqual(getEngineEntry(eng, 'chart'), undefined);
  });

  it('isKnownEngineType returns true for known type', () => {
    const eng = [{ type: 'visual' }, { type: 'chart' }];
    strictEqual(isKnownEngineType(eng, 'chart'), true);
  });

  it('isKnownEngineType returns false for unknown type', () => {
    const eng = [{ type: 'visual' }];
    strictEqual(isKnownEngineType(eng, 'chart'), false);
  });

  it('getEngineKinds returns empty array for engines without kinds', () => {
    const eng = [{ type: 'geomap', skill: 'geographic-map' }];
    deepStrictEqual(getEngineKinds(eng, 'geomap'), []);
  });

  it('getEngineKinds returns kinds array for engines with kinds', () => {
    const eng = [{ type: 'visual', skill: 'educational-visual', kinds: ['number-line'] }];
    deepStrictEqual(getEngineKinds(eng, 'visual'), ['number-line']);
  });
});

describe('engine-skill-catalog doc/schema/example loading', () => {
  it('loads files relative to the manifest directory', () => {
    const dir = createTempDir();
    try {
      const skillsDir = join(dir, 'skills', 'visual');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'SKILL.md'), '# Visual Engine\nAuthoring rules.');
      writeFileSync(join(skillsDir, 'schema.json'), JSON.stringify({ type: 'object' }));
      writeFileSync(
        join(skillsDir, 'skill-example.json'),
        JSON.stringify({ type: 'visual', spec: {} }),
      );

      const manifestPath = join(dir, 'manifest.json');
      writeFileSync(
        manifestPath,
        JSON.stringify({
          package: 'engine-skills',
          version: '0.1.0',
          schemaVersion: 1,
          engines: [
            {
              type: 'visual',
              skill: 'educational-visual',
              skillDoc: 'skills/visual/SKILL.md',
              schema: 'skills/visual/schema.json',
              example: 'skills/visual/skill-example.json',
              validationContract: { package: 'engine-skills', symbol: 'validateSpec', method: 'visual' },
              namespacedEvents: [],
            },
          ],
        }),
      );

      const doc = loadEngineSkillDoc(manifestPath, 'visual');
      ok(doc.includes('Visual Engine'));
      const schema = loadEngineSchema(manifestPath, 'visual');
      ok(schema.includes('"type":"object"'));
      const example = loadEngineSkillExample(manifestPath, 'visual');
      ok(example.includes('"type":"visual"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty string for missing doc/schema/example', () => {
    const dir = createTempDir();
    try {
      const manifestPath = join(dir, 'manifest.json');
      writeFileSync(
        manifestPath,
        JSON.stringify({
          package: 'engine-skills',
          version: '0.1.0',
          schemaVersion: 1,
          engines: [
            {
              type: 'visual',
              skill: 'educational-visual',
              skillDoc: 'skills/visual/SKILL.md',
              schema: 'skills/visual/schema.json',
              example: 'skills/visual/skill-example.json',
              validationContract: { package: 'engine-skills', symbol: 'validateSpec', method: 'visual' },
              namespacedEvents: [],
            },
          ],
        }),
      );
      strictEqual(loadEngineSkillDoc(manifestPath, 'visual'), '');
      strictEqual(loadEngineSchema(manifestPath, 'visual'), '');
      strictEqual(loadEngineSkillExample(manifestPath, 'visual'), '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('engine-skill-catalog real-manifest smoke', () => {
  it('loads the installed engine-skills manifest when present', () => {
    const manifestPath = join(
      process.cwd(),
      'node_modules',
      '@knowledgeassemble',
      'engine-skills',
      'manifest.json',
    );
    if (!existsSync(manifestPath)) return;
    const result = loadEngineSkillsCatalog(manifestPath);
    if (result.available) {
      ok(result.engines.length > 0, 'real manifest should have engines');
      for (const entry of result.engines) {
        ok(entry.type, 'each engine should have a type');
        ok(entry.skillDoc, 'each engine should have a skillDoc path');
        const doc = loadEngineSkillDoc(manifestPath, entry.type);
        ok(doc.length > 0, `SKILL.md should exist for ${entry.type}`);
      }
    }
  });
});