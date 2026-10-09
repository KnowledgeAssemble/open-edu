import type { AuthoringContext } from '@open-edu/packs';

export function renderAuthoringContextBlock(ctx: AuthoringContext): string {
  const packs = ctx.packs.map((p) => `- ${p.type}/${p.id}@${p.version}`).join('\n');
  const concepts = ctx.concepts
    .map((c) => `- ${c.ref.pack}/${c.ref.concept}: ${c.summary}`)
    .join('\n');
  const objectives = ctx.objectives
    .map(
      (o) =>
        `- ${o.id} (${o.bloomLevel ?? 'n/a'}): ${o.description} — requiresIntents: [${o.requiresIntents.join(', ')}]`,
    )
    .join('\n');
  const activities = ctx.availableActivities
    .map((a) => `- ${a.id}${a.domain ? ` (${a.domain})` : ''}: intents [${a.intents.join(', ')}]`)
    .join('\n');
  return [
    'AUTHORING CONTEXT:',
    'Packs:',
    packs || '- (none)',
    '',
    `Curriculum unit: ${ctx.curriculumUnit ?? '(none selected)'}`,
    `Learner profile: ${ctx.learner ?? '(none)'}`,
    `Locale: ${ctx.locale ?? 'en'}`,
    '',
    'Objectives — satisfy each objective with an activity whose learning intents cover requiresIntents, using ONLY the available activities below:',
    objectives || '- (none)',
    '',
    'Concepts:',
    concepts || '- (none)',
    '',
    'Available activities — use ONLY these widget ids in this course:',
    activities || '- (none)',
    '',
    'Provenance (packs and source documents this course is derived from):',
    ctx.provenance
      .map((p) => `- ${p.pack}@${p.version}: ${p.documents.join(', ') || '(no documents)'}`)
      .join('\n') || '- (none)',
  ].join('\n');
}
