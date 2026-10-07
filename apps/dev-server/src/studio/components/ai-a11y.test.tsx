import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import axe from 'axe-core';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { AiStartPanel } from './AiStartPanel';
import { AssistantIntentRow } from './AssistantIntentRow';
import { ItemDraftPreview } from './ItemDraftPreview';
import { StudioAssistantProvider } from '../ai/StudioAssistantProvider';
import type { DraftItem } from '../ai/types.js';

vi.mock('../../editor/WidgetPreviewPanel.js', () => ({
  WidgetPreviewPanel: () => <div data-testid="widget-preview" />,
}));

vi.mock('../../editor/WidgetValidator.js', () => ({
  validateWidgetConfigForType: () => [],
}));

(globalThis as { axe?: typeof axe }).axe = axe;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <StudioAssistantProvider>{children}</StudioAssistantProvider>
    </I18nProvider>
  );
}

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  return results.violations;
}

describe('AI Studio components — axe-core accessibility audits', () => {
  it('AiStartPanel is accessible', async () => {
    const { container } = render(<AiStartPanel />, { wrapper });
    const violations = await runAxe(container);
    expect(violations).toHaveLength(0);
  });

  it('ItemDraftPreview with a highlighted quiz draft is accessible', async () => {
    const item: DraftItem = {
      kind: 'quiz',
      title: 'Quiz',
      content: JSON.stringify({
        type: 'quiz',
        question: 'Q?',
        options: [
          { id: 'a', text: 'Alpha', correct: true },
          { id: 'b', text: 'Beta', correct: false },
        ],
      }),
    };
    const currentContent = JSON.stringify({
      type: 'quiz',
      question: 'Old Q?',
      options: [
        { id: 'a', text: 'Alpha', correct: true },
        { id: 'b', text: 'Different', correct: false },
      ],
    });
    const { container } = render(<ItemDraftPreview item={item} currentContent={currentContent} />, {
      wrapper,
    });
    const violations = await runAxe(container);
    expect(violations).toHaveLength(0);
  });

  it('AssistantIntentRow with lesson intents is accessible', async () => {
    const { container } = render(
      <AssistantIntentRow kind="lesson" onRunIntent={() => {}} running={false} />,
      { wrapper },
    );
    expect(await screen.findByRole('button', { name: 'Rewrite' })).toBeInTheDocument();
    const violations = await runAxe(container);
    expect(violations).toHaveLength(0);
  });
});
