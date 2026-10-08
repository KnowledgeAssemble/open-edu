import type { CompanionSkill } from '@open-edu/companion';

export const objectiveIntentSkill: CompanionSkill = {
  id: 'objective-intent',
  description:
    'Satisfy each curriculum objective with an activity whose learning intents cover its requiresIntents.',
  instructions:
    "For every objective in AUTHORING CONTEXT, emit an activity whose learning intents (from the AVAILABLE ACTIVITIES table) cover ALL of the objective's requiresIntents. Use only activity ids listed under AVAILABLE ACTIVITIES. When no listed activity covers an objective's intents, fall back to a reading, exercise, or reflection activity rather than inventing a widget id.",
  tools: ['generate_course'],
};
