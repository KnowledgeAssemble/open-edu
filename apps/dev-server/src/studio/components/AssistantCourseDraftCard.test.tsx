import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistantCourseDraftCard } from './AssistantCourseDraftCard';
import type { CourseDraftResult } from '../ai/types';

vi.mock('@open-edu/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.title) return `${key}:${params.title}`;
      return key;
    },
  }),
}));

vi.mock('@open-edu/design-system', () => ({
  Button: ({ children, onClick, disabled, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  Badge: ({ children }: any) => <span>{children}</span>,
  Spinner: ({ 'aria-label': ariaLabel }: any) => <span aria-label={ariaLabel}>…</span>,
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

const draft: CourseDraftResult = {
  success: true,
  title: 'Fractions',
  draftId: 'draft-1',
  outlinePreview: [
    { title: 'Intro', kind: 'lesson' },
    { title: 'Quiz 1', kind: 'quiz' },
  ],
  quality: [
    { id: 'objectives', labelKey: 'studio.ai.quality.objectives', passed: true },
    { id: 'coverage', labelKey: 'studio.ai.quality.coverage', passed: false },
  ],
};

describe('AssistantCourseDraftCard', () => {
  it('renders outline and quality checklist', () => {
    render(<AssistantCourseDraftCard courseDraft={draft} onAccept={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('Intro')).toBeTruthy();
    expect(screen.getByText('Quiz 1')).toBeTruthy();
    expect(screen.getByText('studio.ai.quality.objectives')).toBeTruthy();
    expect(screen.getByText('studio.ai.quality.coverage')).toBeTruthy();
  });

  it('accepts without overwrite dialog when package is empty', () => {
    const onAccept = vi.fn();
    render(
      <AssistantCourseDraftCard
        courseDraft={draft}
        onAccept={onAccept}
        onDiscard={vi.fn()}
        packageHasContent={false}
      />,
    );
    fireEvent.click(screen.getByText('studio.assistant.courseDraft.accept'));
    expect(onAccept).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('confirms overwrite before accept when package has content', () => {
    const onAccept = vi.fn();
    render(
      <AssistantCourseDraftCard
        courseDraft={draft}
        onAccept={onAccept}
        onDiscard={vi.fn()}
        packageHasContent
      />,
    );
    fireEvent.click(screen.getByText('studio.assistant.courseDraft.accept'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByTestId('dialog')).toBeTruthy();
    fireEvent.click(screen.getByText('studio.assistant.courseDraft.overwriteConfirm'));
    expect(onAccept).toHaveBeenCalledWith(true);
  });

  it('calls onDiscard after discard confirm', () => {
    const onDiscard = vi.fn();
    render(
      <AssistantCourseDraftCard courseDraft={draft} onAccept={vi.fn()} onDiscard={onDiscard} />,
    );
    fireEvent.click(screen.getByLabelText('studio.assistant.courseDraft.discard'));
    fireEvent.click(screen.getByText('studio.assistant.courseDraft.discard'));
    expect(onDiscard).toHaveBeenCalled();
  });

  it('shows quality detail for failed checks', () => {
    const withDetail: CourseDraftResult = {
      ...draft,
      quality: [
        {
          id: 'assessment',
          labelKey: 'studio.ai.quality.assessment',
          passed: false,
          detail: 'Add a quiz or practice activity',
        },
      ],
    };
    render(
      <AssistantCourseDraftCard courseDraft={withDetail} onAccept={vi.fn()} onDiscard={vi.fn()} />,
    );
    expect(screen.getByText('Add a quiz or practice activity')).toBeTruthy();
  });
});
