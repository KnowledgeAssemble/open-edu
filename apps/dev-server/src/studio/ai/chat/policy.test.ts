import { describe, it, expect } from 'vitest';
import { extractSuggestedNextSteps, buildSystemPrompt } from './policy';
import { MAX_SUGGESTED_NEXT_STEPS } from './metadata';
import { MAX_CONTEXT_CHARS } from '@open-edu/companion/chat';
import type { StudioContextSnapshot } from '../context.js';
import type { AuthoringContext } from '@open-edu/packs';
import { LearningIntent } from '@open-edu/widgets/intents';

describe('extractSuggestedNextSteps', () => {
  it('returns draft follow-ups for item drafts', () => {
    const steps = extractSuggestedNextSteps({
      mode: 'draft',
      view: 'edit-activity',
      hasCourseDraft: false,
      locale: 'en',
    });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(MAX_SUGGESTED_NEXT_STEPS);
    expect(steps[0]).toContain('Apply');
  });

  it('returns course-draft follow-ups for course drafts', () => {
    const steps = extractSuggestedNextSteps({
      mode: 'course_draft',
      view: 'home',
      hasCourseDraft: true,
      locale: 'en',
    });
    expect(steps).toContain('Review quality checklist');
    expect(steps).toContain('Accept draft');
    expect(steps).toContain('Add more notes');
  });

  it('includes add-notes for course drafts even when hasCourseDraft is false', () => {
    const steps = extractSuggestedNextSteps({
      mode: 'course_draft',
      view: 'home',
      hasCourseDraft: false,
      locale: 'en',
    });
    expect(steps).toContain('Add more notes');
  });

  it('returns view-based next steps for explain mode', () => {
    const outline = extractSuggestedNextSteps({
      mode: 'explain',
      view: 'outline',
      hasCourseDraft: false,
      locale: 'en',
    });
    expect(outline).toContain('Add a lesson');
    expect(outline).toContain('Preview course');
  });

  it('caps results at MAX_SUGGESTED_NEXT_STEPS', () => {
    const steps = extractSuggestedNextSteps({
      mode: 'explain',
      view: 'outline',
      hasCourseDraft: false,
      locale: 'en',
    });
    expect(steps.length).toBeLessThanOrEqual(MAX_SUGGESTED_NEXT_STEPS);
  });
});

describe('buildSystemPrompt authoring context', () => {
  function largeAuthoring(): AuthoringContext {
    return {
      packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
      curriculumUnit: 'fractions',
      learner: 'neurotypical',
      availableActivities: Array.from({ length: 25 }, (_, i) => ({
        id: `widget-${i}`,
        name: `Widget ${i}`,
        intents: [LearningIntent.Practice],
        subjectTags: ['math'],
      })),
      concepts: Array.from({ length: 40 }, (_, i) => ({
        ref: { pack: 'openedu-fractions', concept: `concept-${i}` },
        summary: 'A concept summary long enough to matter for the budget. '.repeat(3),
      })),
      objectives: Array.from({ length: 40 }, (_, i) => ({
        id: `objective-${i}`,
        description: 'A measurable objective description. '.repeat(6),
        concepts: [],
        requiresIntents: [LearningIntent.Practice, LearningIntent.Compare],
      })),
      budget: { maxChars: 20000, usedChars: 19999, truncated: ['objectives'] },
      provenance: [],
    };
  }

  it('keeps the system prompt bounded for a large authoring context', () => {
    const snapshot: StudioContextSnapshot = {
      view: 'home',
      locale: 'en',
      aiAvailable: true,
      authoring: largeAuthoring(),
    };
    const prompt = buildSystemPrompt(snapshot);
    expect(prompt.length).toBeLessThan(MAX_CONTEXT_CHARS);
    expect(prompt).toContain('AUTHORING CONTEXT (compact):');
    expect(prompt).toContain('curriculum/nios-math-level-a@0.1.0');
  });
});
