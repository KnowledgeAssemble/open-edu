import { renderWidgetCatalogSection } from './buildPrompt.js';
import type { ItemIntent, ItemIntentParams } from '../types.js';

const OUTPUT_ONLY_JSON =
  'Output ONLY a single JSON object that conforms EXACTLY to this JSON schema (no markdown, no comments, no extra text):';

function intentDescription(intent: ItemIntent): string {
  switch (intent) {
    case 'rewrite':
      return 'Rewrite';
    case 'expand':
      return 'Expand';
    case 'fix-quality':
      return 'Improve the clarity and quality of';
    case 'difficulty':
      return 'Adjust the difficulty of';
    case 'translate':
      return 'Translate';
    case 'add-questions':
      return 'Add new quiz questions inspired by';
    case 'improve-prompt':
      return 'Improve the instructions and prompt of';
    default:
      return 'Revise';
  }
}

function renderParamsSection(params?: ItemIntentParams): string {
  if (!params) return '';
  if ('targetLocale' in params) {
    return `TARGET LANGUAGE: ${params.targetLocale}`;
  }
  if ('direction' in params) {
    const direction = params.direction;
    const verb = direction === 'easier' ? 'easier' : 'harder';
    return `DIFFICULTY: Make it ${verb} for a ${direction} learner.`;
  }
  return '';
}

function quizEnvelope(sourceOptionCount: number): string[] {
  const options = Array.from(
    { length: sourceOptionCount },
    () => '    { "text": "<answer>", "correct": true | false }',
  ).join(',\n');
  return ['{', '  "question": "<the question>",', '  "options": [', options, '  ]', '}'];
}

function renderIntentRules(intent: ItemIntent, sourceOptionCount: number): string[] {
  const rules: string[] = [];
  if (intent === 'add-questions') {
    rules.push(
      '- Return exactly 3 new quiz questions, each with exactly 4 options and exactly one "correct": true.',
      '- Questions must be distinct from the current content.',
    );
  } else {
    rules.push(
      `- Preserve the current structure: exactly ${sourceOptionCount} options and exactly one "correct": true.`,
      '- Keep the question aligned with the existing quiz while applying the requested change.',
    );
  }
  return rules;
}

export function buildQuizEditPrompt(
  intent: ItemIntent,
  currentContent: string,
  sourceOptionCount: number,
  context: string,
  params?: ItemIntentParams,
  authoringSection?: string,
): string {
  const paramsSection = renderParamsSection(params);

  if (intent === 'add-questions') {
    return [
      `You are an expert curriculum designer. ${intentDescription(intent)} the current quiz below.`,
      '',
      'CURRENT QUIZ:',
      currentContent.trim(),
      '',
      OUTPUT_ONLY_JSON,
      '',
      '{',
      '  "questions": [',
      '    { "question": "<question>", "options": [',
      '      { "text": "<answer>", "correct": true },',
      '      { "text": "<answer>", "correct": false },',
      '      { "text": "<answer>", "correct": false },',
      '      { "text": "<answer>", "correct": false }',
      '    ] }',
      '  ]',
      '}',
      '',
      'RULES:',
      ...renderIntentRules(intent, sourceOptionCount),
      '',
      paramsSection,
      '',
      ...(authoringSection ? [authoringSection, ''] : []),
      context,
    ].join('\n');
  }

  return [
    `You are an expert curriculum designer. ${intentDescription(intent)} the current quiz below.`,
    '',
    'CURRENT QUIZ:',
    currentContent.trim(),
    '',
    OUTPUT_ONLY_JSON,
    '',
    ...quizEnvelope(sourceOptionCount),
    '',
    'RULES:',
    ...renderIntentRules(intent, sourceOptionCount),
    '',
    paramsSection,
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}

export function buildLessonEditPrompt(
  intent: ItemIntent,
  currentContent: string,
  context: string,
  params?: ItemIntentParams,
  authoringSection?: string,
): string {
  const paramsSection = renderParamsSection(params);
  return [
    `You are an expert curriculum designer. ${intentDescription(intent)} the current lesson below.`,
    '',
    'CURRENT LESSON:',
    currentContent.trim(),
    '',
    OUTPUT_ONLY_JSON,
    '',
    '{',
    '  "title": "<lesson title>",',
    '  "markdown": "# <lesson title>\\n\\n<lesson body written in Markdown>"',
    '}',
    '',
    'RULES:',
    '- The "markdown" body must start with a "# " heading that matches the title.',
    '- Keep the lesson focused on the same topic while applying the requested change.',
    '',
    paramsSection,
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}

export function buildPracticeEditPrompt(
  intent: ItemIntent,
  currentContent: string,
  context: string,
  params?: ItemIntentParams,
  authoringSection?: string,
): string {
  const paramsSection = renderParamsSection(params);
  return [
    `You are an expert curriculum designer. ${intentDescription(intent)} the current practice activity below.`,
    '',
    'CURRENT PRACTICE:',
    currentContent.trim(),
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
    paramsSection,
    '',
    ...(authoringSection ? [authoringSection, ''] : []),
    context,
  ].join('\n');
}
