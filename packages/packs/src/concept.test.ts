import { describe, it, expect } from 'vitest';
import { ConceptSchema } from './concept.js';

const validConcept = {
  id: 'fraction',
  title: 'Fraction',
  summary: 'A fraction names equal parts of a whole.',
  domainTags: ['math', 'fractions'],
};

describe('ConceptSchema', () => {
  it('parses a valid concept', () => {
    const result = ConceptSchema.safeParse(validConcept);
    expect(result.success).toBe(true);
  });

  it('requires a non-empty domainTags array', () => {
    expect(ConceptSchema.safeParse({ ...validConcept, domainTags: [] }).success).toBe(false);
  });

  it('rejects a summary longer than 2000 characters', () => {
    expect(ConceptSchema.safeParse({ ...validConcept, summary: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });

  it('rejects an unknown key (strict)', () => {
    expect(ConceptSchema.safeParse({ ...validConcept, extra: true }).success).toBe(false);
  });

  it('accepts an optional source', () => {
    const result = ConceptSchema.safeParse({
      ...validConcept,
      source: { documentId: 'nios-math-ch1', section: '2.1', excerpt: 'Parts of a whole.' },
    });
    expect(result.success).toBe(true);
  });
});
