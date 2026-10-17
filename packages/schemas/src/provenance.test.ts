import { describe, it, expect } from 'vitest';
import { AuthoringScopeSchema, ReproductionRecordSchema } from './provenance';

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

describe('AuthoringScopeSchema', () => {
  it('accepts a full scope', () => {
    const result = AuthoringScopeSchema.safeParse({
      curriculum: 'nios-math-level-a',
      unit: 'fractions',
      learner: 'neurotypical',
      locale: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('accepts curriculum only', () => {
    expect(AuthoringScopeSchema.safeParse({ curriculum: 'x' }).success).toBe(true);
  });

  it('rejects an empty curriculum', () => {
    expect(AuthoringScopeSchema.safeParse({ curriculum: '' }).success).toBe(false);
  });
});

describe('ReproductionRecordSchema', () => {
  it('parses a valid record', () => {
    const result = ReproductionRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(ReproductionRecordSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
  });
});

describe('ReproductionRecordSchema authoringScope', () => {
  const base = {
    schemaVersion: 1,
    packs: [],
    generatedAt: 'now',
    contextFingerprint: 'sha256:x',
    nodes: [],
  };

  it('accepts a record without authoringScope (back-compat)', () => {
    const result = ReproductionRecordSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoringScope).toBeUndefined();
  });

  it('round-trips a record with authoringScope', () => {
    const result = ReproductionRecordSchema.safeParse({
      ...base,
      authoringScope: { curriculum: 'nios-math-level-a', unit: 'fractions' },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authoringScope?.curriculum).toBe('nios-math-level-a');
  });
});
