import { describe, it, expect } from 'vitest';
import { mapDiagnosticsToQuality } from './qualityMap';

describe('qualityMap', () => {
  const cleanOutline = [
    { title: 'Intro', kind: 'lesson' },
    { title: 'Check', kind: 'quiz' },
  ];

  it('marks objectives unmet when diagnostics report missing objectives', () => {
    const items = mapDiagnosticsToQuality(
      [{ severity: 'warning', message: 'Lesson has no objectives', code: 'MISSING_OBJECTIVES' }],
      cleanOutline,
    );
    expect(items.find((i) => i.id === 'objectives')?.passed).toBe(false);
  });

  it('marks assessment unmet when the outline has no quiz or practice', () => {
    const items = mapDiagnosticsToQuality([], [{ title: 'Intro', kind: 'lesson' }]);
    expect(items.find((i) => i.id === 'assessment')?.passed).toBe(false);
  });

  it('marks duration unmet when there are too many lessons', () => {
    const outline = Array.from({ length: 9 }, (_, index) => ({
      title: `Lesson ${index}`,
      kind: 'lesson',
    }));
    const items = mapDiagnosticsToQuality([], outline);
    expect(items.find((i) => i.id === 'duration')?.passed).toBe(false);
  });

  it('marks completeness unmet on error-severity diagnostics', () => {
    const items = mapDiagnosticsToQuality(
      [
        {
          severity: 'error',
          message: 'Invalid question options',
          code: 'INVALID_QUESTION_OPTIONS',
        },
      ],
      cleanOutline,
    );
    expect(items.find((i) => i.id === 'completeness')?.passed).toBe(false);
  });

  it('passes all items for a clean draft', () => {
    const items = mapDiagnosticsToQuality([], cleanOutline);
    expect(items.every((i) => i.passed)).toBe(true);
    expect(items.every((i) => i.detail === undefined)).toBe(true);
    expect(items.map((i) => i.labelKey)).toEqual([
      'studio.ai.quality.objectives',
      'studio.ai.quality.assessment',
      'studio.ai.quality.duration',
      'studio.ai.quality.completeness',
    ]);
  });

  it('includes detail text for failed checks', () => {
    const items = mapDiagnosticsToQuality(
      [
        { severity: 'warning', message: 'Lesson has no objectives', code: 'MISSING_OBJECTIVES' },
        {
          severity: 'error',
          message: 'Invalid question options',
          code: 'INVALID_QUESTION_OPTIONS',
        },
      ],
      [{ title: 'Intro', kind: 'lesson' }],
    );
    expect(items.find((i) => i.id === 'objectives')?.detail).toContain('no objectives');
    expect(items.find((i) => i.id === 'assessment')?.detail).toMatch(/quiz or practice/i);
    expect(items.find((i) => i.id === 'completeness')?.detail).toContain('Invalid question');
  });
});
