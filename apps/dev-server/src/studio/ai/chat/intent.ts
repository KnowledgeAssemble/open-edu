import type { ItemIntent, ItemIntentParams } from '../types.js';

export interface ParsedIntent {
  type: 'draft_new' | 'edit_existing' | 'generate_course' | 'explain';
  kind?: 'lesson' | 'quiz' | 'practice';
  description?: string;
  intent?: ItemIntent;
  params?: ItemIntentParams;
}

/** Shortest explicit course requests ("Create a course about X") are ~30 chars. */
const MIN_EXPLICIT_COURSE_REQUEST_LENGTH = 30;

/**
 * Deterministic, regex-based intent parser used by both the local Vite chat
 * handler and the browser-mode hosted chat transport. It keeps course
 * generation and item drafting triggers consistent across server and gateway
 * paths without requiring an LLM call.
 */
export function parseIntentFromMessage(content: string): ParsedIntent | null {
  const low = content.toLowerCase();

  if (low.includes('add questions') || low.includes('more questions')) {
    return { type: 'edit_existing', intent: 'add-questions' };
  }

  // Check for course generation before individual activity creation
  const coursePatterns = [
    /create\s+(?:a\s+)?(?:full\s+)?course\b/i,
    /generate\s+(?:a\s+)?course\b/i,
    /build\s+(?:a\s+)?course\b/i,
    /make\s+(?:a\s+)?course\b/i,
    /\b(?:course|curriculum|unit)\s+(?:from|based on|covering)\s+/i,
    /^.*notes?.*course.*$/i,
    /^.*course.*notes?.*$/i,
  ];
  const isCourseRequest = coursePatterns.some((p) => p.test(low));

  // Trigger course generation for explicit course requests (even short ones)
  // or long messages that look like notes.
  const hasSubstantialNotes = content.length > 100;

  if (
    isCourseRequest &&
    (hasSubstantialNotes || low.length >= MIN_EXPLICIT_COURSE_REQUEST_LENGTH)
  ) {
    return { type: 'generate_course', description: content };
  }

  // Also trigger course generation for very long messages that look like notes
  if (
    content.length > 300 &&
    !low.includes('create') &&
    !low.includes('add') &&
    !low.includes('edit')
  ) {
    return { type: 'generate_course', description: content };
  }

  const createMatch = low.match(
    /(?:create|add|draft|generate|make new)\s+(?:a\s+)?(lesson|quiz|practice)/,
  );
  if (createMatch) {
    return {
      type: 'draft_new',
      kind: createMatch[1] as 'lesson' | 'quiz' | 'practice',
      description: content,
    };
  }

  // Specific edit patterns win before generic edit words so messages like
  // "Make this easier" or "Translate this" route to a concrete intent.
  const editPatterns: Array<{ match: RegExp; intent: ItemIntent; params?: ItemIntentParams }> = [
    { match: /rewrite|rephrase/i, intent: 'rewrite' },
    { match: /expand|elaborate/i, intent: 'expand' },
    { match: /fix.*quality/i, intent: 'fix-quality' },
    { match: /easier|simplif|simpler/i, intent: 'difficulty', params: { direction: 'easier' } },
    { match: /harder|more.*challenging/i, intent: 'difficulty', params: { direction: 'harder' } },
    { match: /translate/i, intent: 'translate', params: { targetLocale: 'en' } },
    { match: /improve.*prompt/i, intent: 'improve-prompt' },
  ];

  for (const pattern of editPatterns) {
    if (pattern.match.test(low)) {
      return { type: 'edit_existing', intent: pattern.intent, params: pattern.params };
    }
  }

  if (
    low.includes('edit') ||
    low.includes('change') ||
    low.includes('improve') ||
    low.includes('rewrite')
  ) {
    return { type: 'edit_existing', intent: 'rewrite' };
  }

  return null;
}
