import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getEngineSkillsData,
  loadEngineSkillDoc,
  loadEngineExample,
  validateSpec,
  validateSkillExample,
} from '../engine-skills.js';
import { readDataFile } from '../dataPath.js';
import { INTERACTIVE_ENGINE_TYPES } from '@open-edu/schemas';
import { resolveRepoRoot } from '../generate.js';

describe('engine-skills domain guidance', () => {
  it('getEngineSkillsData parses manifest with schemaVersion 1 and 6 engines', () => {
    const data = getEngineSkillsData();
    expect(data.schemaVersion).toBe(1);
    expect(data.package).toBe('engine-skills');
    expect(data.engines).toHaveLength(6);
    expect(data.engines.map((e) => e.type).sort()).toEqual([
      'chart',
      'composition',
      'diagram',
      'geomap',
      'timeline',
      'visual',
    ]);
  });

  it('engine types include all INTERACTIVE_ENGINE_TYPES plus composition', () => {
    const data = getEngineSkillsData();
    const manifestTypes = data.engines.map((e) => e.type);
    for (const t of INTERACTIVE_ENGINE_TYPES) {
      expect(manifestTypes).toContain(t);
    }
    expect(manifestTypes).toContain('composition');
    expect(INTERACTIVE_ENGINE_TYPES).not.toContain('composition');
  });

  it('derived view matches committed engine-skills.json', () => {
    const generated = getEngineSkillsData();
    const committed = JSON.parse(readDataFile('engine-skills.json'));
    expect(generated).toEqual(committed);
  });

  it('generated engine-skills.md reference contains a section per engine', () => {
    const repoRoot = resolveRepoRoot();
    const refPath = join(
      repoRoot,
      'skills',
      'openedu-course-authoring',
      'references',
      'engine-skills.md',
    );
    expect(existsSync(refPath)).toBe(true);
    const content = readFileSync(refPath, 'utf-8');
    const data = getEngineSkillsData();
    for (const engine of data.engines) {
      expect(content).toContain(`### ${engine.type}`);
    }
  });

  it('generated reference contains no packages/ or docs/ path fragment', () => {
    const repoRoot = resolveRepoRoot();
    const refPath = join(
      repoRoot,
      'skills',
      'openedu-course-authoring',
      'references',
      'engine-skills.md',
    );
    const content = readFileSync(refPath, 'utf-8');
    expect(content).not.toContain('packages/');
    expect(content).not.toContain('docs/');
  });

  it('every loadEngineSkillDoc is non-empty and contains no packages/ or docs/ fragment', () => {
    const data = getEngineSkillsData();
    for (const engine of data.engines) {
      const doc = loadEngineSkillDoc(engine.type);
      expect(doc).toBeTruthy();
      expect(doc.length).toBeGreaterThan(0);
      expect(doc).not.toContain('packages/');
      expect(doc).not.toContain('docs/');
    }
  });

  it('every engine validates its shipped skill-example.json against its schema.json', () => {
    const data = getEngineSkillsData();
    for (const engine of data.engines) {
      const result = validateSkillExample(engine.type);
      expect(result.valid).toBe(true);
    }
  });

  it('validateSpec round-trips for composition', () => {
    const example = loadEngineExample('composition') as Record<string, unknown>;
    const result = validateSpec('composition', example);
    expect(result.valid).toBe(true);
  });
});
