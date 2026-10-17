import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LearningIntent } from '@open-edu/widgets/intents';
import type { AuthoringContext } from './context.js';
import {
  canonicalizeContext,
  fingerprintAuthoringContext,
  sha256Hex,
} from './fingerprint.js';

const baseContext: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  learner: 'neurotypical',
  availableActivities: [
    {
      id: 'math.number-line',
      name: 'Number Line',
      intents: [LearningIntent.Practice],
      subjectTags: ['math'],
    },
  ],
  concepts: [],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent fractions',
      concepts: [],
      requiresIntents: [LearningIntent.Practice],
    },
  ],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('fingerprint isomorphism', () => {
  it('matches node:crypto sha256 for known vectors', () => {
    for (const input of [
      '',
      'abc',
      'The quick brown fox jumps over the lazy dog',
      'x'.repeat(1000),
    ]) {
      const expected = createHash('sha256').update(input, 'utf8').digest('hex');
      expect(sha256Hex(input)).toBe(expected);
    }
  });

  it('produces the same fingerprint values as the pre-change implementation', () => {
    const expected = `sha256:${createHash('sha256')
      .update(canonicalizeContext(baseContext), 'utf8')
      .digest('hex')}`;
    expect(fingerprintAuthoringContext(baseContext)).toBe(expected);
  });
});
