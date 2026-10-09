import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackDirectory } from './loader.js';
import { packDetailFrom, summarizePack } from './pack-info.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const KNOWLEDGE_FIXTURE = join(REPO_ROOT, 'examples/packs/knowledge/openedu-fractions');
const CURRICULUM_FIXTURE = join(REPO_ROOT, 'examples/packs/curriculum/nios-math-level-a');

describe('summarizePack', () => {
  it('summarizes the knowledge fixture', () => {
    const summary = summarizePack(loadPackDirectory(KNOWLEDGE_FIXTURE));
    expect(summary.conceptCount).toBe(5);
    expect(summary.unitCount).toBe(0);
    expect(summary.objectiveCount).toBe(0);
  });

  it('summarizes the curriculum fixture', () => {
    const summary = summarizePack(loadPackDirectory(CURRICULUM_FIXTURE));
    expect(summary.unitCount).toBe(2);
    expect(summary.objectiveCount).toBe(3);
    expect(summary.conceptCount).toBe(3);
  });
});

describe('packDetailFrom', () => {
  it('lists concepts for a knowledge pack', () => {
    const detail = packDetailFrom(loadPackDirectory(KNOWLEDGE_FIXTURE));
    expect(detail.requires).toEqual([]);
    expect(detail.units).toEqual([]);
    expect(detail.concepts.map((c) => c.id)).toContain('numerator');
    expect(detail.concepts[0]?.domainTags).toContain('fractions');
  });

  it('lists units for a curriculum pack', () => {
    const detail = packDetailFrom(loadPackDirectory(CURRICULUM_FIXTURE));
    expect(detail.requires).toEqual(['openedu-fractions']);
    expect(detail.units.map((u) => u.title)).toEqual(['Fractions', 'Measurement']);
    expect(detail.units.map((u) => u.objectiveCount)).toEqual([2, 1]);
    expect(detail.concepts).toEqual([]);
  });
});
