import { describe, it, expect } from 'vitest';
import { renderWidgetGuideMarkdown } from './guide-markdown.js';
import type { WidgetCatalogEntry } from '@open-edu/schemas';

const entry: WidgetCatalogEntry = {
  id: 'core.multiple-choice',
  name: 'Multiple Choice',
  domain: 'core',
  status: 'stable',
  guide: {
    oneLiner: 'Ask a question with several answers.',
    whatItDoes: 'Presents a question and answer options.',
    whenToUse: ['Check understanding after a lesson.'],
    setupSteps: ['Add the widget.', 'Add questions.'],
    configFields: [
      { name: 'questions', type: 'array of objects', required: true, description: 'Questions.' },
    ],
    exampleJson: '{"questions": []}',
    tips: ['Keep options short.'],
    sidebarPosition: 2,
  },
};

describe('renderWidgetGuideMarkdown', () => {
  it('renders the widget name, config table, and a code fence', () => {
    const md = renderWidgetGuideMarkdown(entry);
    expect(md).toContain('# Multiple Choice');
    expect(md).toContain('## Configuration fields');
    expect(md).toContain('```json');
    expect(md).toContain('**Widget ID:** `core.multiple-choice`');
  });

  it('returns an empty string when entry.guide is undefined', () => {
    expect(renderWidgetGuideMarkdown({ id: 'core.matching' })).toBe('');
  });
});
