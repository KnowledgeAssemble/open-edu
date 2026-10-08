import { z } from 'zod';
import type {
  CourseModel,
  CourseMetadata,
  CourseModule,
  Lesson,
  Activity,
  CompilerDiagnostic,
} from '../schemas/index.js';

export const MCQQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
});

export const ActivityJSONSchema = z.object({
  step: z.enum([
    'observe',
    'guided_practice',
    'independent_practice',
    'mastery_check',
    'positive_completion',
  ]),
  order: z.number(),
  type: z.enum(['reading', 'exercise', 'quiz', 'reflection', 'widget']),
  description: z.string(),
  instructions: z.string().optional(),
  examples: z.array(z.string()).optional(),
  questions: z.array(MCQQuestionSchema).optional(),
  widgetId: z.string().optional(),
  widgetConfig: z.record(z.unknown()).optional(),
});

export const LessonJSONSchema = z.object({
  id: z.string(),
  title: z.string(),
  objectives: z.array(z.string()),
  coreIdea: z.string(),
  examples: z.array(z.string()).optional(),
  misconceptions: z.array(z.string()).optional(),
  estimatedMinutes: z.number().optional(),
  activities: z.array(ActivityJSONSchema),
});

export const CourseSpecJSONSchema = z.object({
  format: z.literal('openedu-course-spec'),
  version: z.literal(1),
  generatedAt: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string().optional(),
    version: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    audience: z.string().optional(),
    accessibility: z.array(z.string()).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    estimatedHours: z.number().optional(),
    lastUpdated: z.string().optional(),
    language: z.string().optional(),
    generated: z.boolean(),
  }),
  lessons: z.array(LessonJSONSchema),
});

export type CourseSpecJSON = z.infer<typeof CourseSpecJSONSchema>;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unnamed'
  );
}

function mapLesson(jsonLesson: z.infer<typeof LessonJSONSchema>): Lesson {
  const activities: Activity[] = jsonLesson.activities
    .filter((a) => a.type !== 'quiz')
    .map((a) => {
      const id = slugify(`${a.step}-${a.description}`);
      if (a.type === 'widget') {
        const activity: Activity = {
          id,
          type: 'widget',
          widgetId: a.widgetId || '',
          config: a.widgetConfig || {},
          description: a.description,
        };
        return activity;
      }
      if (a.type === 'reflection') {
        const activity: Activity = {
          id,
          type: 'reflection',
          prompt: a.instructions || a.description,
          private: true,
        };
        return activity;
      }
      if (a.type === 'reading') {
        const activity: Activity = {
          id,
          type: 'reading',
          content: a.instructions || '',
        };
        return activity;
      }
      const activity: Activity = {
        id,
        type: 'exercise',
        instructions: a.instructions || '',
      };
      return activity;
    });

  const quizActivity = jsonLesson.activities.find((a) => a.type === 'quiz');
  const quiz =
    quizActivity && quizActivity.questions
      ? {
          id: slugify(`quiz-${jsonLesson.id}`),
          title: quizActivity.description,
          questions: quizActivity.questions.map((q, qi) => ({
            id: `q-${qi + 1}`,
            type: 'multiple-choice' as const,
            prompt: q.question,
            options: q.options.map((opt, oi) => ({
              id: `opt-${oi + 1}`,
              text: opt,
              correct: oi === q.correctIndex,
            })),
          })),
          shuffleQuestions: false,
        }
      : undefined;

  return {
    id: jsonLesson.id,
    title: jsonLesson.title,
    objectives: jsonLesson.objectives.map((obj, i) => ({
      id: `obj-${i + 1}`,
      description: obj,
    })),
    content:
      jsonLesson.coreIdea + '\n\n' + (jsonLesson.examples ?? []).map((e) => `- ${e}`).join('\n'),
    activities: activities.length > 0 ? activities : undefined,
    quiz: quiz,
    estimatedMinutes: jsonLesson.estimatedMinutes,
  };
}

export function parseCourseSpecJSON(jsonStr: string): {
  model: CourseModel | null;
  diagnostics: CompilerDiagnostic[];
} {
  const diagnostics: CompilerDiagnostic[] = [];

  let parsed: CourseSpecJSON;
  try {
    const raw = JSON.parse(jsonStr);
    const result = CourseSpecJSONSchema.safeParse(raw);
    if (!result.success) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid course spec JSON: ${result.error.message}`,
        code: 'INVALID_JSON_SCHEMA',
      });
      return { model: null, diagnostics };
    }
    parsed = result.data;
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      message: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
      code: 'JSON_PARSE_ERROR',
    });
    return { model: null, diagnostics };
  }

  const lessons = parsed.lessons.map(mapLesson);

  const metadata: CourseMetadata = {
    title: parsed.metadata.title,
    description: parsed.metadata.description,
    author: parsed.metadata.author,
    version: parsed.metadata.version,
    language: parsed.metadata.language ?? 'en',
    keywords: parsed.metadata.keywords,
    targetAudience: parsed.metadata.targetAudience,
    audience: parsed.metadata.audience,
    accessibility: parsed.metadata.accessibility,
    difficulty: parsed.metadata.difficulty,
    estimatedHours: parsed.metadata.estimatedHours,
    lastUpdated: parsed.metadata.lastUpdated,
  };

  const moduleId =
    parsed.metadata.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled';

  const mod: CourseModule = {
    id: moduleId,
    title: parsed.metadata.title,
    description: parsed.metadata.description,
    lessons,
  };

  const model: CourseModel = {
    metadata,
    modules: [mod],
  };

  return { model, diagnostics };
}
