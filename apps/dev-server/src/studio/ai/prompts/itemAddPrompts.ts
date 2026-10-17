import { renderWidgetCatalogSection } from './buildPrompt.js';

const OUTPUT_ONLY_JSON =
  'Output ONLY a single JSON object that conforms EXACTLY to this JSON schema (no markdown, no comments, no extra text):';

export function buildLessonAddPrompt(
  description: string,
  context: string,
  authoringSection?: string,
): string {
  return [
    'You are an expert curriculum designer. Draft a single lesson for an OpenEdu course.',
    '',
    'LESSON DESCRIPTION:',
    description.trim(),
    '',
    OUTPUT_ONLY_JSON,
    '',
    '{',
    '  "title": "<short lesson title>",',
    '  "markdown": "# <lesson title>\\n\\n<lesson body written in Markdown>"',
    '}',
    '',
    'RULES:',
    '- The "markdown" body must start with a "# " heading that matches the title.',
    '- Write a complete, ready-to-learn lesson; keep it focused on the description.',
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}

export function buildQuizAddPrompt(
  description: string,
  context: string,
  authoringSection?: string,
): string {
  return [
    'You are an expert curriculum designer. Draft a single multiple-choice quiz question for an OpenEdu course.',
    '',
    'QUIZ DESCRIPTION:',
    description.trim(),
    '',
    OUTPUT_ONLY_JSON,
    '',
    '{',
    '  "question": "<the question>",',
    '  "options": [',
    '    { "text": "<answer>", "correct": true },',
    '    { "text": "<answer>", "correct": false },',
    '    { "text": "<answer>", "correct": false },',
    '    { "text": "<answer>", "correct": false }',
    '  ]',
    '}',
    '',
    'RULES:',
    '- Exactly 4 options, and exactly one option must have "correct": true.',
    '- The correct option should not be the first option by default — vary it.',
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}

export function buildPracticeAddPrompt(
  description: string,
  context: string,
  authoringSection?: string,
): string {
  return [
    'You are an expert curriculum designer. Draft a single practice activity for an OpenEdu course.',
    '',
    'PRACTICE DESCRIPTION:',
    description.trim(),
    '',
    OUTPUT_ONLY_JSON,
    '',
    '{',
    '  "widget": "<canonical widget id from the AVAILABLE WIDGETS table>",',
    '  "title": "<short practice title>",',
    '  "config": { "<config field>": "<value>" }',
    '}',
    '',
    'RULES:',
    '- The "widget" must be one of the ids in the AVAILABLE WIDGETS table below.',
    '- The "config" must fill that widget\'s config fields (see the configFields column).',
    '',
    renderWidgetCatalogSection(),
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}
