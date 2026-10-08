import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LearningIntent } from '@open-edu/widgets/intents';
import { loadPacksDir } from './loader.js';
import { resolveAuthoringContext, resolveConcept } from './resolve.js';
import { fingerprintAuthoringContext } from './fingerprint.js';
import type { AvailableActivity } from './context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PACKS_ROOT = join(REPO_ROOT, 'examples/packs');

function load(): ReturnType<typeof loadPacksDir>['packs'] {
  return loadPacksDir(PACKS_ROOT).packs;
}

const activities: AvailableActivity[] = [
  {
    id: 'math.number-line',
    name: 'Number Line',
    domain: 'math',
    intents: [LearningIntent.Observe, LearningIntent.Practice, LearningIntent.Compare],
    subjectTags: ['math', 'fractions'],
  },
  {
    id: 'core.visual-counting',
    name: 'Visual Counting',
    domain: 'core',
    intents: [LearningIntent.Observe, LearningIntent.Practice],
    subjectTags: ['math'],
  },
];

describe('resolveConcept', () => {
  it('resolves a concept and returns undefined for missing', () => {
    const packs = load();
    expect(resolveConcept({ pack: 'openedu-fractions', concept: 'fraction' }, packs)?.id).toBe(
      'fraction',
    );
    expect(resolveConcept({ pack: 'openedu-fractions', concept: 'ghost' }, packs)).toBeUndefined();
  });
});

describe('resolveAuthoringContext', () => {
  it('resolves the fractions unit across the curriculum and knowledge closure', () => {
    const packs = load();
    const { context, diagnostics } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities, learner: 'neurotypical' },
    );

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(context.packs.map((p) => p.id).sort()).toEqual([
      'nios-math-level-a',
      'openedu-fractions',
    ]);
    expect(context.curriculumUnit).toBe('fractions');
    expect(context.learner).toBe('neurotypical');
    expect(context.locale).toBeUndefined();
    expect(context.concepts.map((c) => c.ref.concept).sort()).toEqual([
      'denominator',
      'fraction',
      'numerator',
    ]);
    expect(context.objectives.map((o) => o.id)).toEqual(['represent-fraction', 'name-parts']);

    const knowledgeProvenance = context.provenance.find((p) => p.pack === 'openedu-fractions');
    expect(knowledgeProvenance?.documents).toEqual(['nios-math-ch1']);
    const curriculumProvenance = context.provenance.find((p) => p.pack === 'nios-math-level-a');
    expect(curriculumProvenance?.documents).toEqual([]);
  });

  it('emits a CAPABILITY_GAP warning when an objective has no candidate', () => {
    const packs = load();
    const { diagnostics } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities },
    );
    const gaps = diagnostics.filter((d) => d.code === 'CAPABILITY_GAP');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.message).toBe('objective-name-parts: no activity matched intents [recall]');
  });

  it('reports a missing dependency', () => {
    const packs = new Map([...load()].filter(([id]) => id !== 'openedu-fractions'));
    const { diagnostics } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      {},
    );
    expect(diagnostics.map((d) => d.code)).toContain('PACK_DEPENDENCY_MISSING');
    expect(diagnostics.map((d) => d.code)).toContain('PACK_REFERENCE_MISSING');
  });

  it('reports a missing curriculum', () => {
    const { context, diagnostics } = resolveAuthoringContext(load(), { curriculum: 'ghost' }, {});
    expect(diagnostics.map((d) => d.code)).toContain('PACK_REFERENCE_MISSING');
    expect(context.packs).toEqual([]);
  });

  it('caps available activities at 25 and records truncation', () => {
    const packs = load();
    const many: AvailableActivity[] = Array.from({ length: 28 }, (_, i) => ({
      id: `w${i}`,
      name: `w${i}`,
      intents: [],
      subjectTags: [],
    }));
    const { context } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: many, maxChars: 1 },
    );
    expect(context.availableActivities).toHaveLength(25);
    expect(context.budget.truncated).toEqual([
      'objectives',
      'concepts',
      'unitTitle',
      'availableActivities',
    ]);
  });

  it('drops truncated entries and stops at the first overflow', () => {
    const packs = load();
    const { context } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities, maxChars: 1 },
    );
    expect(context.objectives).toEqual([]);
    expect(context.concepts).toEqual([]);
    expect(context.budget.truncated).toEqual(['objectives', 'concepts', 'unitTitle']);
    expect(context.budget.usedChars).toBe(0);
  });

  it('keeps everything and sums usedChars when the budget is large', () => {
    const packs = load();
    const { context } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities, maxChars: 100000 },
    );
    const expected =
      context.objectives.reduce((n, o) => n + o.description.length, 0) +
      context.concepts.reduce((n, c) => n + c.summary.length, 0) +
      'Fractions'.length;
    expect(context.budget.truncated).toEqual([]);
    expect(context.budget.usedChars).toBe(expected);
  });

  it('is deterministic and fingerprint-stable for identical inputs', () => {
    const packs = load();
    const first = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities, learner: 'neurotypical' },
    );
    const second = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities, learner: 'neurotypical' },
    );
    expect(first.context).toEqual(second.context);
    expect(fingerprintAuthoringContext(first.context)).toBe(
      fingerprintAuthoringContext(second.context),
    );
  });

  it('fingerprints exclude budget usage and react to objective changes', () => {
    const packs = load();
    const { context } = resolveAuthoringContext(
      packs,
      { curriculum: 'nios-math-level-a', unit: 'fractions' },
      { availableActivities: activities },
    );
    const base = fingerprintAuthoringContext(context);
    expect(base).toMatch(/^sha256:[0-9a-f]{64}$/);

    const bumped = {
      ...context,
      budget: { ...context.budget, usedChars: context.budget.usedChars + 99, truncated: ['x'] },
    };
    expect(fingerprintAuthoringContext(bumped)).toBe(base);

    const changed = {
      ...context,
      objectives: context.objectives.map((o, i) =>
        i === 0 ? { ...o, description: `${o.description} (edited)` } : o,
      ),
    };
    expect(fingerprintAuthoringContext(changed)).not.toBe(base);
  });
});
