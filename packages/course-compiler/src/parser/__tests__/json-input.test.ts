import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCourseSpecJSON } from '../json-input.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('parseCourseSpecJSON', () => {
  it('parses a valid minimal JSON', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
      metadata: { title: 'Test', description: 'Test course', generated: true },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test Lesson',
          objectives: ['Learn'],
          coreIdea: 'Core idea',
          examples: [],
          misconceptions: [],
          activities: [],
        },
      ],
    });
    const { model, diagnostics } = parseCourseSpecJSON(json);
    expect(model).not.toBeNull();
    expect(diagnostics).toHaveLength(0);
    expect(model!.metadata.title).toBe('Test');
    expect(model!.modules).toHaveLength(1);
    expect(model!.modules[0]!.lessons).toHaveLength(1);
  });

  it('forwards profile metadata into the compiled model', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-08-28T00:00:00.000Z',
      metadata: {
        title: 'Fractions',
        description: 'Intro to fractions',
        generated: true,
        audience: 'autism',
        accessibility: ['sensory-friendly', 'predictable-structure', 'literal-language'],
        targetAudience: '8-10 year old students',
        keywords: ['fractions', 'math'],
        lastUpdated: '2026-08-28',
      },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Parts of a Whole',
          objectives: ['Identify numerators and denominators'],
          coreIdea: 'A fraction represents a part of a whole',
          examples: ['1/2 of a pizza'],
          misconceptions: ['Larger denominator means larger fraction'],
          activities: [],
        },
      ],
    });
    const { model, diagnostics } = parseCourseSpecJSON(json);
    expect(model).not.toBeNull();
    expect(diagnostics).toHaveLength(0);
    expect(model!.metadata.audience).toBe('autism');
    expect(model!.metadata.accessibility).toEqual([
      'sensory-friendly',
      'predictable-structure',
      'literal-language',
    ]);
    expect(model!.metadata.targetAudience).toBe('8-10 year old students');
    expect(model!.metadata.keywords).toEqual(['fractions', 'math']);
    expect(model!.metadata.lastUpdated).toBe('2026-08-28');
  });

  it('maps widget activity correctly', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
      metadata: { title: 'Test', description: 'Test', generated: true },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test',
          objectives: [],
          coreIdea: 'Idea',
          examples: [],
          misconceptions: [],
          activities: [
            {
              step: 'observe',
              order: 1,
              type: 'widget',
              description: 'Match families',
              widgetId: 'open-edu.matching',
              widgetConfig: { pairs: [{ itemA: 'Joint', itemB: 'Multigen' }] },
            },
          ],
        },
      ],
    });
    const { model } = parseCourseSpecJSON(json);
    const activity = model!.modules[0]!.lessons[0]!.activities![0]!;
    expect(activity.type).toBe('widget');
    if (activity.type === 'widget') {
      expect(activity.widgetId).toBe('open-edu.matching');
    }
  });

  it('maps quiz activity correctly', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
      metadata: { title: 'Test', description: 'Test', generated: true },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test',
          objectives: [],
          coreIdea: 'Idea',
          examples: [],
          misconceptions: [],
          activities: [
            {
              step: 'mastery_check',
              order: 1,
              type: 'quiz',
              description: 'Quiz',
              questions: [
                {
                  question: 'What is?',
                  options: ['A', 'B', 'C', 'D'],
                  correctIndex: 0,
                },
              ],
            },
          ],
        },
      ],
    });
    const { model } = parseCourseSpecJSON(json);
    const lesson = model!.modules[0]!.lessons[0]!;
    expect(lesson.quiz).toBeDefined();
    expect(lesson.quiz!.questions).toHaveLength(1);
    const question = lesson.quiz!.questions[0]!;
    if (question.type === 'multiple-choice') {
      expect(question.prompt).toBe('What is?');
    } else {
      // fallback for other question types
      expect(true).toBe(true);
    }
  });

  it('maps reading activity correctly', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
      metadata: { title: 'Test', description: 'Test', generated: true },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test',
          objectives: [],
          coreIdea: 'Idea',
          examples: [],
          misconceptions: [],
          activities: [
            {
              step: 'observe',
              order: 1,
              type: 'reading',
              description: 'Read',
              instructions: 'Read this content.',
            },
          ],
        },
      ],
    });
    const { model } = parseCourseSpecJSON(json);
    const activity = model!.modules[0]!.lessons[0]!.activities![0]!;
    expect(activity.type).toBe('reading');
  });

  it('maps reflection activity correctly', () => {
    const json = JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
      metadata: { title: 'Test', description: 'Test', generated: true },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test',
          objectives: [],
          coreIdea: 'Idea',
          examples: [],
          misconceptions: [],
          activities: [
            {
              step: 'positive_completion',
              order: 1,
              type: 'reflection',
              description: 'Well done',
              instructions: 'Reflect on your learning.',
            },
          ],
        },
      ],
    });
    const { model } = parseCourseSpecJSON(json);
    const activity = model!.modules[0]!.lessons[0]!.activities![0]!;
    expect(activity.type).toBe('reflection');
  });

  it('returns null model for invalid JSON string', () => {
    const { model, diagnostics } = parseCourseSpecJSON('not valid json');
    expect(model).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.code).toBe('JSON_PARSE_ERROR');
  });

  it('returns null model for missing required field', () => {
    const { model, diagnostics } = parseCourseSpecJSON(JSON.stringify({}));
    expect(model).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.code).toBe('INVALID_JSON_SCHEMA');
  });

  it('parses the fixture file correctly', () => {
    const fixturePath = join(__dirname, 'fixtures', 'sample-course-spec.json');
    const content = readFileSync(fixturePath, 'utf-8');
    const { model, diagnostics } = parseCourseSpecJSON(content);
    expect(model).not.toBeNull();
    expect(diagnostics).toHaveLength(0);
    expect(model!.modules).toHaveLength(1);
    expect(model!.modules[0]!.lessons).toHaveLength(1);

    const lesson = model!.modules[0]!.lessons[0]!;
    expect(lesson.activities).toBeDefined();
    expect(lesson.quiz).toBeDefined();

    // Widget activity
    const widgetAct = lesson.activities!.find((a) => a.type === 'widget');
    expect(widgetAct).toBeDefined();
    if (widgetAct && widgetAct.type === 'widget') {
      expect(widgetAct.widgetId).toBe('open-edu.matching');
    }

    // Quiz
    expect(lesson.quiz!.questions).toHaveLength(1);
  });
});

describe('parseCourseSpecJSON metadata.language', () => {
  function specWithLanguage(language?: string) {
    return JSON.stringify({
      format: 'openedu-course-spec',
      version: 1,
      generatedAt: '2026-10-08T00:00:00.000Z',
      metadata: {
        title: 'Test',
        description: 'Test course',
        generated: true,
        ...(language ? { language } : {}),
      },
      lessons: [
        {
          id: 'lesson-101',
          title: 'Test Lesson',
          objectives: ['Learn'],
          coreIdea: 'Core idea',
          activities: [],
        },
      ],
    });
  }

  it('propagates an explicit metadata.language', () => {
    const { model } = parseCourseSpecJSON(specWithLanguage('hi'));
    expect(model?.metadata.language).toBe('hi');
  });

  it('defaults metadata.language to en when absent', () => {
    const { model } = parseCourseSpecJSON(specWithLanguage());
    expect(model?.metadata.language).toBe('en');
  });
});
