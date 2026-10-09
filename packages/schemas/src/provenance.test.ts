import { describe, it, expect } from 'vitest';
import { ReproductionRecordSchema } from './provenance';

const valid = {
  schemaVersion: 1,
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  generatedAt: '2026-10-08T00:00:00.000Z',
  contextFingerprint: 'sha256:abc',
  nodes: [
    {
      path: 'nodes/represent.md',
      objectives: ['represent-fraction'],
      concepts: [{ pack: 'openedu-fractions', concept: 'fraction' }],
      widgets: ['math.number-line'],
      capabilityGaps: [],
    },
  ],
};

describe('ReproductionRecordSchema', () => {
  it('parses a valid record', () => {
    const result = ReproductionRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(ReproductionRecordSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
  });
});
