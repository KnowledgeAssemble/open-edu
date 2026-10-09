import type { CompanionSkill } from '@open-edu/companion';

export const objectiveIntentSkill: CompanionSkill = {
  id: 'objective-intent',
  description:
    'Satisfy each curriculum objective with an activity whose learning intents cover its requiresIntents.',
  instructions:
    "For every objective in AUTHORING CONTEXT, emit activities whose learning intents (from the AVAILABLE ACTIVITIES table) cover ALL of the objective's requiresIntents — in one activity or together across the activities you emit. Use only activity ids listed under AVAILABLE ACTIVITIES. When no combination of listed activities can cover an objective's intents, fall back to the closest listed reading, exercise, or reflection activity rather than inventing an id; the uncovered intents will be reported as a capability gap.",
  tools: ['generate_course'],
};
