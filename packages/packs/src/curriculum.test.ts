import { describe, it, expect } from 'vitest';
import { CurriculumSchema, ObjectiveSchema, CurriculumUnitSchema } from './curriculum.js';

const validObjective = {
  id: 'represent-fraction',
  description: 'Represent three-quarters as a shaded area.',
  requiresIntents: ['practice'],
};

describe('ObjectiveSchema', () => {
  it('parses a valid objective', () => {
    const result = ObjectiveSchema.safeParse(validObjective);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.concepts).toEqual([]);
  });

  it('requires at least one requiresIntent', () => {
    expect(ObjectiveSchema.safeParse({ ...validObjective, requiresIntents: [] }).success).toBe(
      false,
    );
  });

  it('rejects an unknown intent value', () => {
    expect(
      ObjectiveSchema.safeParse({ ...validObjective, requiresIntents: ['not-an-intent'] }).success,
    ).toBe(false);
  });

  it('rejects an unknown key (strict)', () => {
    expect(ObjectiveSchema.safeParse({ ...validObjective, extra: true }).success).toBe(false);
  });
});

describe('CurriculumUnitSchema', () => {
  it('requires at least one objective', () => {
    expect(
      CurriculumUnitSchema.safeParse({ id: 'fractions', title: 'Fractions', objectives: [] })
        .success,
    ).toBe(false);
  });

  it('defaults concepts and prerequisites to empty arrays', () => {
    const result = CurriculumUnitSchema.safeParse({
      id: 'fractions',
      title: 'Fractions',
      objectives: [validObjective],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concepts).toEqual([]);
      expect(result.data.prerequisites).toEqual([]);
    }
  });
});

describe('CurriculumSchema', () => {
  it('parses a valid curriculum', () => {
    const result = CurriculumSchema.safeParse({
      id: 'nios-math-level-a',
      title: 'NIOS Mathematics Level A',
      subject: 'mathematics',
      units: [{ id: 'fractions', title: 'Fractions', objectives: [validObjective] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown key (strict)', () => {
    const result = CurriculumSchema.safeParse({
      id: 'nios-math-level-a',
      title: 'NIOS Mathematics Level A',
      subject: 'mathematics',
      units: [{ id: 'fractions', title: 'Fractions', objectives: [validObjective] }],
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});
