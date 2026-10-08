import type { CourseModel, WidgetActivity } from '@open-edu/course-compiler';
import { getProfile } from '@open-edu/domain-guidance';
import { validateBlueprint, type AuthoringContext, type BlueprintFacts } from '@open-edu/packs';
import { fingerprintAuthoringContext } from '@open-edu/packs/fingerprint';
import type { ReproductionRecord } from '@open-edu/schemas';

function modelLessons(model: CourseModel): CourseModel['modules'][number]['lessons'] {
  return model.modules.flatMap((module) => module.lessons);
}

function widgetIds(lesson: { activities?: Array<{ type: string }> }): string[] {
  return (lesson.activities ?? [])
    .filter((a): a is WidgetActivity => a.type === 'widget')
    .map((a) => a.widgetId);
}

export function factsFromModel(model: CourseModel): BlueprintFacts {
  return {
    audience: model.metadata.audience,
    lessons: modelLessons(model).map((l) => ({
      id: l.id,
      objectives: l.objectives.map((o) => o.description),
      widgetIds: widgetIds(l),
    })),
  };
}

function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matchLessonObjective(
  authoring: AuthoringContext,
  lessonObjective: { description: string },
  index: number,
): AuthoringContext['objectives'][number] | undefined {
  const lessonNorm = normalizeDescription(lessonObjective.description);
  const exact = authoring.objectives.find(
    (ctx) => normalizeDescription(ctx.description) === lessonNorm,
  );
  if (exact) return exact;
  const partial = authoring.objectives.find((ctx) => {
    const ctxNorm = normalizeDescription(ctx.description);
    if (!ctxNorm || !lessonNorm) return false;
    return lessonNorm.includes(ctxNorm) || ctxNorm.includes(lessonNorm);
  });
  if (partial) return partial;
  return authoring.objectives[index];
}

export function buildProvenance(
  authoring: AuthoringContext,
  model: CourseModel,
  generatedAt: string,
): { record: ReproductionRecord; capabilityGaps: string[] } {
  const facts = factsFromModel(model);
  facts.expectedAudience = authoring.learner ? getProfile(authoring.learner)?.audience : undefined;
  const { capabilityGaps } = validateBlueprint(authoring, facts);

  const nodes = modelLessons(model).map((lesson) => {
    const matchedObjectives: AuthoringContext['objectives'] = [];
    lesson.objectives.forEach((lessonObjective, i) => {
      const matched = matchLessonObjective(authoring, lessonObjective, i);
      if (matched && !matchedObjectives.includes(matched)) {
        matchedObjectives.push(matched);
      }
    });
    const matchedObjectiveIds = matchedObjectives.map((o) => o.id);
    const concepts = matchedObjectives.flatMap((o) => o.concepts);
    const seenConcepts = new Set<string>();
    const uniqueConcepts = concepts.filter((c) => {
      const key = `${c.pack}/${c.concept}`;
      if (seenConcepts.has(key)) return false;
      seenConcepts.add(key);
      return true;
    });
    return {
      path: `nodes/${lesson.id}.md`,
      objectives: matchedObjectiveIds,
      concepts: uniqueConcepts,
      widgets: widgetIds(lesson),
      capabilityGaps: capabilityGaps.filter((g) =>
        matchedObjectiveIds.some((id) => g.startsWith(`objective-${id}:`)),
      ),
    };
  });

  return {
    capabilityGaps,
    record: {
      schemaVersion: 1,
      packs: authoring.packs,
      generatedAt,
      contextFingerprint: fingerprintAuthoringContext(authoring),
      nodes,
    },
  };
}
