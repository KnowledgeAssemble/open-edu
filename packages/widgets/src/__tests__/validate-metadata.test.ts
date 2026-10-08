import { describe, it, expect } from 'vitest';
import { validateWidgetMetadata } from '../validate-metadata';
import type { WidgetDefinitionV2 } from '../types';
import { LearningIntent } from '../metadata/learning-intents';

function v2(overrides: Partial<WidgetDefinitionV2> = {}): WidgetDefinitionV2 {
  return {
    id: 'test.widget',
    name: 'Test',
    description: 'A test widget',
    domain: 'test',
    learningIntents: [LearningIntent.Practice],
    capabilities: { supportsObserveMode: true },
    accessibility: {},
    analytics: {},
    reward: {},
    ai: {
      difficulty: 'medium',
      recommendedAge: [5, 18],
      learningObjectives: ['Understand the concepts'],
      commonMisconceptions: ['Common errors'],
      exampleConfigs: [{ sample: true }],
    },
    icon: 'info',
    keywords: ['test'],
    status: 'stable',
    render: () => null,
    ...overrides,
  };
}

describe('validateWidgetMetadata', () => {
  it('returns no errors for a valid V2 definition', () => {
    const result = validateWidgetMetadata(v2());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when name is missing', () => {
    const result = validateWidgetMetadata(v2({ name: '' }));
    expect(result.warnings).toContainEqual(expect.stringContaining('name'));
  });

  it('warns when description is missing', () => {
    const result = validateWidgetMetadata(v2({ description: '' }));
    expect(result.warnings).toContainEqual(expect.stringContaining('description'));
  });

  it('warns when learningIntents is empty', () => {
    const result = validateWidgetMetadata(v2({ learningIntents: [] }));
    expect(result.warnings).toContainEqual(expect.stringContaining('learningIntents'));
  });

  it('warns when ai.difficulty is missing', () => {
    const result = validateWidgetMetadata(v2({ ai: {} }));
    expect(result.warnings).toContainEqual(expect.stringContaining('difficulty'));
  });

  it('warns when keywords are missing', () => {
    const result = validateWidgetMetadata(v2({ keywords: undefined }));
    expect(result.warnings).toContainEqual(expect.stringContaining('keywords'));
  });

  it('errors when id is empty', () => {
    const result = validateWidgetMetadata(v2({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('id'));
  });

  it('warns when status is experimental', () => {
    const result = validateWidgetMetadata(v2({ status: 'experimental' }));
    expect(result.warnings).toContainEqual(expect.stringContaining('experimental'));
  });

  it('warns when deprecated is true but replacement is missing', () => {
    const result = validateWidgetMetadata(v2({ deprecated: true, replacement: undefined }));
    expect(result.warnings).toContainEqual(expect.stringContaining('replacement'));
  });

  it('warns when icon is missing', () => {
    const result = validateWidgetMetadata(v2({ icon: undefined }));
    expect(result.warnings).toContainEqual(expect.stringContaining('icon'));
  });

  it('returns no warnings for a fully populated V2 definition', () => {
    const result = validateWidgetMetadata(v2());
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn about replacement when deprecated with replacement provided', () => {
    const result = validateWidgetMetadata(v2({ deprecated: true, replacement: 'other.widget' }));
    expect(result.warnings).not.toContainEqual(expect.stringContaining('replacement'));
  });

  it('warns about missing replacement when status is deprecated', () => {
    const result = validateWidgetMetadata(v2({ status: 'deprecated', deprecated: false }));
    expect(result.warnings).toContainEqual(expect.stringContaining('replacement'));
  });

  it('warns when recommendedAge is missing', () => {
    const result = validateWidgetMetadata(v2({ ai: { difficulty: 'easy' } }));
    expect(result.warnings).toContainEqual(expect.stringContaining('recommendedAge'));
  });

  it('warns when learningObjectives is empty', () => {
    const result = validateWidgetMetadata(
      v2({ ai: { difficulty: 'easy', learningObjectives: [] } }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('learningObjectives'));
  });

  it('warns when commonMisconceptions is empty', () => {
    const result = validateWidgetMetadata(
      v2({ ai: { difficulty: 'easy', commonMisconceptions: [] } }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('commonMisconceptions'));
  });

  it('warns when supportsObserveMode is missing on stable widget', () => {
    const result = validateWidgetMetadata(
      v2({ status: 'stable', capabilities: { supportsKeyboard: true } }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('supportsObserveMode'));
  });

  it('does not warn about supportsObserveMode on experimental widgets', () => {
    const result = validateWidgetMetadata(v2({ status: 'experimental', capabilities: {} }));
    expect(result.warnings).not.toContainEqual(expect.stringContaining('supportsObserveMode'));
  });

  it('warns when a stable widget declares empty capabilities', () => {
    const result = validateWidgetMetadata(v2({ status: 'stable', capabilities: {} }));
    expect(result.warnings).toContainEqual(expect.stringContaining('capabilities'));
  });

  it('warns when a stable widget declares no capabilities', () => {
    const result = validateWidgetMetadata(v2({ status: 'stable', capabilities: undefined }));
    expect(result.warnings).toContainEqual(expect.stringContaining('capabilities'));
  });

  it('does not warn about capabilities on experimental widgets', () => {
    const result = validateWidgetMetadata(v2({ status: 'experimental', capabilities: undefined }));
    expect(result.warnings).not.toContainEqual(expect.stringContaining('capabilities'));
  });

  it('warns when supportsHints is true but trackHints is false', () => {
    const result = validateWidgetMetadata(
      v2({
        capabilities: { supportsHints: true },
        analytics: { trackHints: false },
      }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('trackHints'));
  });

  it('warns when supportsRetry is true but trackRetries is false', () => {
    const result = validateWidgetMetadata(
      v2({
        capabilities: { supportsRetry: true },
        analytics: { trackRetries: false },
      }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('trackRetries'));
  });

  it('warns when completionXP is set but positiveMessage is missing', () => {
    const result = validateWidgetMetadata(
      v2({
        reward: { completionXP: 10 },
      }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('positiveMessage'));
  });

  it('warns when exampleConfigs is empty array', () => {
    const result = validateWidgetMetadata(
      v2({
        ai: { difficulty: 'easy', exampleConfigs: [] },
      }),
    );
    expect(result.warnings).toContainEqual(expect.stringContaining('exampleConfigs'));
  });

  it('no warnings for fully-populated widget with consistent metadata', () => {
    const result = validateWidgetMetadata(
      v2({
        status: 'stable',
        capabilities: { supportsObserveMode: true, supportsHints: true, supportsRetry: true },
        analytics: { trackHints: true, trackRetries: true },
        reward: { completionXP: 10, positiveMessage: 'Great!' },
        ai: {
          difficulty: 'easy',
          recommendedAge: [5, 10],
          learningObjectives: ['Learn something'],
          commonMisconceptions: ['A common error'],
          exampleConfigs: [{ test: true }],
        },
      }),
    );
    expect(result.warnings).toHaveLength(0);
  });
});
