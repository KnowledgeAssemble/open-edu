import { describe, it, expect } from 'vitest';
import { studioContextSnapshotSchema } from './context.js';

const baseSnapshot = {
  view: 'home' as const,
  locale: 'en',
  aiAvailable: true,
};

const minimalAuthoring = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' as const }],
  curriculumUnit: 'fractions',
  availableActivities: [
    { id: 'math.number-line', name: 'Number Line', intents: ['practice'], subjectTags: ['math'] },
  ],
  concepts: [],
  objectives: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('studioContextSnapshotSchema authoring block', () => {
  it('parses a snapshot without authoring (back-compat)', () => {
    const result = studioContextSnapshotSchema.safeParse(baseSnapshot);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoring).toBeUndefined();
  });

  it('parses and round-trips a minimal authoring block', () => {
    const result = studioContextSnapshotSchema.safeParse({
      ...baseSnapshot,
      authoring: minimalAuthoring,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoring?.packs[0]?.id).toBe('nios-math-level-a');
  });

  it('rejects an authoring block without a budget', () => {
    const withoutBudget = { ...minimalAuthoring, budget: undefined };
    const result = studioContextSnapshotSchema.safeParse({
      ...baseSnapshot,
      authoring: withoutBudget,
    });
    expect(result.success).toBe(false);
  });
});
