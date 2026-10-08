import { z } from 'zod';
import { AuthoringContextSchema } from '@open-edu/packs';

export const StudioViewSchema = z.enum([
  'home',
  'outline',
  'edit-activity',
  'preview',
  'share',
  'library',
  'unit-builder',
]);

export type StudioView = z.infer<typeof StudioViewSchema>;

export const ActivityKindSchema = z.enum(['lesson', 'quiz', 'practice', 'reflection', 'other']);

export type ActivityKind = z.infer<typeof ActivityKindSchema>;

export const learnerProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['school', 'college', 'adult', 'family', 'neurotypical', 'autism']),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

export const studioContextSnapshotSchema = z
  .object({
    view: StudioViewSchema,
    locale: z.string(),
    aiAvailable: z.boolean(),
    learner: learnerProfileSchema.optional(),
    course: z
      .object({
        id: z.string(),
        title: z.string(),
        activityCount: z.number(),
        outline: z.array(
          z.object({
            title: z.string(),
            kind: ActivityKindSchema,
            path: z.string(),
          }),
        ),
      })
      .optional(),
    activity: z
      .object({
        path: z.string(),
        kind: ActivityKindSchema,
        title: z.string().optional(),
        contentExcerpt: z.string().optional(),
        selection: z
          .object({
            start: z.number(),
            end: z.number(),
            text: z.string(),
          })
          .optional(),
        isDirty: z.boolean().optional(),
        validationIssues: z.array(z.string()).optional(),
      })
      .optional(),
    lastCourseDraftQuality: z
      .array(
        z.object({
          id: z.string(),
          labelKey: z.string(),
          passed: z.boolean(),
          detail: z.string().optional(),
        }),
      )
      .optional(),
  })
  .extend({ authoring: AuthoringContextSchema.optional() });

export type StudioContextSnapshot = z.infer<typeof studioContextSnapshotSchema>;

export function truncateExcerpt(text: string, limit = 4000): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '... [truncated]';
}

export function buildOutlineSummary(
  activities: Array<{ title?: string; kind?: string; path: string }>,
  limit = 30,
) {
  return activities.slice(0, limit).map((a) => {
    const kindParse = ActivityKindSchema.safeParse(a.kind);
    return {
      title: a.title || 'Untitled',
      kind: kindParse.success ? kindParse.data : ('other' as const),
      path: a.path,
    };
  });
}
