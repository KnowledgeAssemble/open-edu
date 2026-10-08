import { describe, it, expect } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import { AuthoringContextSchema } from './context.js';

const budget = { maxChars: 20000, usedChars: 0, truncated: [] as string[] };

describe('AuthoringContextSchema bounds', () => {
  it('accepts an empty authoring context', () => {
    const result = AuthoringContextSchema.safeParse({ budget });
    expect(result.success).toBe(true);
  });

  it('rejects an oversized objectives array', () => {
    const objectives = Array.from({ length: 1001 }, (_, i) => ({
      id: `o${i}`,
      description: 'd',
      requiresIntents: [LearningIntent.Practice],
    }));
    expect(AuthoringContextSchema.safeParse({ objectives, budget }).success).toBe(false);
  });

  it('rejects an oversized objective description', () => {
    const objectives = [
      { id: 'o', description: 'x'.repeat(501), requiresIntents: [LearningIntent.Practice] },
    ];
    expect(AuthoringContextSchema.safeParse({ objectives, budget }).success).toBe(false);
  });

  it('rejects an oversized packs array', () => {
    const packs = Array.from({ length: 101 }, (_, i) => ({
      id: `p${i}`,
      version: '1.0.0',
      type: 'curriculum' as const,
    }));
    expect(AuthoringContextSchema.safeParse({ packs, budget }).success).toBe(false);
  });

  it('rejects an oversized availableActivities array', () => {
    const availableActivities = Array.from({ length: 501 }, (_, i) => ({
      id: `w${i}`,
      name: `W${i}`,
    }));
    expect(AuthoringContextSchema.safeParse({ availableActivities, budget }).success).toBe(false);
  });

  it('rejects an oversized maxChars budget', () => {
    expect(
      AuthoringContextSchema.safeParse({
        budget: { maxChars: 2_000_000, usedChars: 0, truncated: [] },
      }).success,
    ).toBe(false);
  });
});
