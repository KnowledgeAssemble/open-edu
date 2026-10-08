import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackDirectory } from '@open-edu/packs/loader';
import type { LoadedPack } from '@open-edu/packs';
import {
  buildAvailableActivities,
  detailPack,
  resolveSelection,
  summarizePacks,
} from './packApi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_ROOT = resolve(__dirname, '../../../../../examples/packs');

function fixturePacks(): LoadedPack[] {
  return [
    loadPackDirectory(join(PACKS_ROOT, 'knowledge/openedu-fractions')),
    loadPackDirectory(join(PACKS_ROOT, 'curriculum/nios-math-level-a')),
  ];
}

describe('summarizePacks / detailPack', () => {
  it('summarizes both fixtures', () => {
    const summaries = summarizePacks(fixturePacks());
    const knowledge = summaries.find((s) => s.id === 'openedu-fractions');
    expect(knowledge?.conceptCount).toBe(5);
    expect(knowledge?.unitCount).toBe(0);
    const curriculum = summaries.find((s) => s.id === 'nios-math-level-a');
    expect(curriculum?.unitCount).toBe(2);
    expect(curriculum?.objectiveCount).toBe(3);
    expect(curriculum?.conceptCount).toBe(3);
  });

  it('returns unit and concept details, undefined for an unknown id', () => {
    const packs = fixturePacks();
    const curriculum = detailPack(packs, 'nios-math-level-a', '0.1.0');
    expect(curriculum?.units.map((u) => u.id)).toEqual(['fractions', 'measurement']);
    expect(curriculum?.requires).toEqual(['openedu-fractions']);

    const knowledge = detailPack(packs, 'openedu-fractions', '0.1.0');
    expect(knowledge?.concepts.map((c) => c.id)).toContain('fraction');

    expect(detailPack(packs, 'ghost', '0.0.0')).toBeUndefined();
  });
});

describe('buildAvailableActivities', () => {
  it('skips deprecated entries and keeps catalog order', () => {
    const activities = buildAvailableActivities();
    expect(activities.length).toBeGreaterThan(25);
    expect(activities.every((a) => !a.id.startsWith('open-edu.'))).toBe(true);
  });
});

describe('resolveSelection', () => {
  it('resolves the fractions unit with a single capability gap', () => {
    const { context, warnings } = resolveSelection(fixturePacks(), {
      curriculum: 'nios-math-level-a',
      unit: 'fractions',
    });
    expect(context.curriculumUnit).toBe('fractions');
    expect(context.concepts.map((c) => c.ref.concept).sort()).toEqual([
      'denominator',
      'fraction',
      'numerator',
    ]);
    expect(context.availableActivities).toHaveLength(25);
    expect(context.budget.truncated).toContain('availableActivities');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('CAPABILITY_GAP');
    expect(warnings[0]?.message).toContain('objective-name-parts');
    expect(context.availableActivities.map((a) => a.id)).toContain('math.number-line');
  });

  it('resolves the measurement unit with a single objective-no-concepts warning', () => {
    const { warnings } = resolveSelection(fixturePacks(), {
      curriculum: 'nios-math-level-a',
      unit: 'measurement',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('OBJECTIVE_NO_CONCEPTS');
  });

  it('throws a coded error for an unknown curriculum', () => {
    expect(() => resolveSelection(fixturePacks(), { curriculum: 'ghost' })).toThrowError(
      expect.objectContaining({ code: 'PACK_REFERENCE_MISSING' }),
    );
  });
});
