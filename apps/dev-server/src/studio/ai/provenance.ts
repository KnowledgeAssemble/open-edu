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

export function buildProvenance(
  authoring: AuthoringContext,
  model: CourseModel,
  generatedAt: string,
): { record: ReproductionRecord; capabilityGaps: string[] } {
  const facts = factsFromModel(model);
  facts.expectedAudience = authoring.learner ? getProfile(authoring.learner)?.audience : undefined;
  const { capabilityGaps } = validateBlueprint(authoring, facts);

  const nodes = modelLessons(model).map((lesson) => {
    const matchedObjectiveIds = lesson.objectives
      .map(
        (o, i) =>
          authoring.objectives.find((ctx) => ctx.description === o.description)?.id ??
          authoring.objectives[i]?.id,
      )
      .filter((id): id is string => Boolean(id));
    const objectives = authoring.objectives.filter((o) => matchedObjectiveIds.includes(o.id));
    return {
      path: `nodes/${lesson.id}.md`,
      objectives: matchedObjectiveIds,
      concepts: objectives.flatMap((o) => o.concepts),
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
