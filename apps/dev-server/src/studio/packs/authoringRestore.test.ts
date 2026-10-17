import { describe, expect, it } from 'vitest';
import type { AuthoringContext } from '@open-edu/packs';
import { computeAuthoringDrift } from './authoringRestore.js';

const authoringFixture: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.2.0', type: 'curriculum' }],
  objectives: [],
  concepts: [],
  availableActivities: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
};

describe('computeAuthoringDrift', () => {
  it('reports version diffs for packs that changed version', () => {
    const record = {
      schemaVersion: 1 as const,
      packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' as const }],
      generatedAt: 'now',
      contextFingerprint: 'sha256:a',
      authoringScope: { curriculum: 'nios-math-level-a' },
      nodes: [],
    };
    const drift = computeAuthoringDrift(record, authoringFixture);
    expect(drift.packDiffs).toEqual([
      { id: 'nios-math-level-a', recorded: '0.1.0', current: '0.2.0' },
    ]);
    expect(drift.fingerprintChanged).toBe(true);
  });
});
