import type { AiQualityItem } from './types.js';

export interface DiagnosticLike {
  severity: string;
  message: string;
  code?: string;
}

export interface OutlineLike {
  title: string;
  kind: string;
}

export function mapDiagnosticsToQuality(
  diagnostics: DiagnosticLike[],
  outline: OutlineLike[],
): AiQualityItem[] {
  const codes = new Set(diagnostics.map((diagnostic) => diagnostic.code));
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  const hasAssessment = outline.some((node) => node.kind === 'quiz' || node.kind === 'practice');
  const objectivesDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.code === 'MISSING_OBJECTIVES',
  );
  const errorDetails = diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.message)
    .filter(Boolean)
    .join('; ');

  const objectivesPassed = !codes.has('MISSING_OBJECTIVES');
  const durationPassed = outline.length >= 1 && outline.length <= 6;
  const completenessPassed = !hasErrors && outline.length > 0;

  const items: AiQualityItem[] = [
    {
      id: 'objectives',
      labelKey: 'studio.ai.quality.objectives',
      passed: objectivesPassed,
      detail: objectivesPassed
        ? undefined
        : objectivesDiagnostic?.message || 'One or more lessons are missing learning objectives.',
    },
    {
      id: 'assessment',
      labelKey: 'studio.ai.quality.assessment',
      passed: hasAssessment,
      detail: hasAssessment
        ? undefined
        : 'Add a quiz or practice activity so learners can check understanding.',
    },
    {
      id: 'duration',
      labelKey: 'studio.ai.quality.duration',
      passed: durationPassed,
      detail: durationPassed
        ? undefined
        : outline.length < 1
          ? 'Outline has no activities yet.'
          : `Outline has ${outline.length} activities; aim for 1–6 for a focused course.`,
    },
    {
      id: 'completeness',
      labelKey: 'studio.ai.quality.completeness',
      passed: completenessPassed,
      detail: completenessPassed
        ? undefined
        : hasErrors
          ? errorDetails || 'Compilation reported errors.'
          : 'Outline is empty.',
    },
  ];

  return items;
}
