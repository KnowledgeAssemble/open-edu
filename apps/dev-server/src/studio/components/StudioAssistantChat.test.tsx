import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { StudioAssistantChat } from './StudioAssistantChat';
import type { CourseDraftResult, DraftItem } from '../ai/types';
import { authoringFixture } from '../test/authoringFixture.js';

const { applyDraftMock } = vi.hoisted(() => ({
  applyDraftMock: vi.fn().mockResolvedValue({ path: 'nodes/a.md' }),
}));

const sendMessage = vi.fn();
const appendAssistantNote = vi.fn();
const handleUseDraft = vi.fn();
let chatStatus: 'idle' | 'loading' | 'error' = 'idle';

const draftItem: DraftItem = {
  kind: 'lesson',
  title: 'Water',
  content: '# Water\n',
};

const courseDraft: CourseDraftResult = {
  success: true,
  title: 'Course',
  draftId: 'draft-1',
  outlinePreview: [{ title: 'Intro', kind: 'lesson' }],
  quality: [],
};

let messages: Array<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
}> = [];

const commitCourseDraft = vi.fn().mockResolvedValue({ success: true });
const discardCourseDraft = vi.fn().mockResolvedValue({ success: true });

vi.mock('../ai', () => ({
  useStudioAssistant: () => ({
    context: {
      view: 'outline',
      locale: 'en',
      aiAvailable: true,
      course: { id: 'c1', title: 'C', activityCount: 0, outline: [] },
      authoring: authoringFixture,
    },
    pendingDrafts: null,
    setPendingDrafts: vi.fn(),
    setEphemeralSuggestions: vi.fn(),
    setLastCourseQuality: vi.fn(),
  }),
  useStudioChat: () => ({
    messages,
    sendMessage,
    status: chatStatus,
    stop: vi.fn(),
    regenerate: vi.fn(),
    clearError: vi.fn(),
    runIntent: vi.fn(),
    appendAssistantNote,
    ingestCourseDraft: vi.fn(),
    api: {
      commitCourseDraft,
      discardCourseDraft,
      uploadSpecDraft: vi.fn(),
    },
    onOpenPath: vi.fn(),
    onError: vi.fn(),
    onOutlineChanged: vi.fn(),
  }),
}));

vi.mock('../ai/EditorBridgeContext', () => ({
  useEditorBridge: () => ({ currentEditor: null }),
}));

vi.mock('../ai/applyDraft', () => ({
  applyDraft: async (...args: unknown[]) => {
    handleUseDraft();
    return applyDraftMock(...args);
  },
  applyDraftBatch: vi.fn(async () => {
    handleUseDraft();
  }),
}));

vi.mock('../ai/suggestions', () => ({
  resolvePostCommitSuggestions: () => [],
}));

function wrap(ui: React.ReactElement) {
  return render(
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>,
  );
}

describe('StudioAssistantChat next-step actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatStatus = 'idle';
    messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Draft ready',
        metadata: {
          mode: 'draft',
          drafts: [draftItem],
          suggestedNextSteps: ['Apply this draft', 'Add a quiz'],
        },
      },
    ];
  });

  it('applies the draft when the Apply this draft chip is clicked', async () => {
    wrap(<StudioAssistantChat />);
    await userEvent.click(screen.getByRole('button', { name: 'Apply this draft' }));
    await waitFor(() => expect(handleUseDraft).toHaveBeenCalled());
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('forwards authoring into applyDraft when applying a file draft', async () => {
    applyDraftMock.mockClear();
    wrap(<StudioAssistantChat />);
    await userEvent.click(screen.getByRole('button', { name: 'Apply this draft' }));
    await waitFor(() => expect(applyDraftMock).toHaveBeenCalled());
    const options = applyDraftMock.mock.calls[0]![2] as { authoring?: unknown };
    expect(options.authoring).toBe(authoringFixture);
  });

  it('sends non-action chips as chat messages', async () => {
    wrap(<StudioAssistantChat />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a quiz' }));
    expect(sendMessage).toHaveBeenCalledWith('Add a quiz');
  });

  it('accepts a course draft from the Accept draft chip on an empty package', async () => {
    messages = [
      {
        id: 'a2',
        role: 'assistant',
        content: 'Course ready',
        metadata: {
          mode: 'course_draft',
          courseDraft,
          suggestedNextSteps: ['Accept draft', 'Add more notes'],
        },
      },
    ];
    wrap(<StudioAssistantChat />);
    const chips = screen.getAllByRole('button', { name: 'Accept draft' });
    // Prefer the next-step chip (last), not the card primary button.
    await userEvent.click(chips[chips.length - 1]!);
    await waitFor(() => expect(commitCourseDraft).toHaveBeenCalledWith('draft-1', false));
  });

  it('shows a thinking indicator while the assistant is generating a response', () => {
    chatStatus = 'loading';
    wrap(<StudioAssistantChat />);
    expect(screen.getByTestId('thinking-indicator')).toBeTruthy();
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('prefills the composer without sending when a preset carries prefill: true', async () => {
    wrap(<StudioAssistantChat />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent('studio:assistant:preset', {
          detail: {
            message: 'Help me create a course from my notes.',
            prefill: true,
          },
        }),
      );
    });
    const textarea = screen.getByPlaceholderText('Ask anything about your course…');
    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        'Help me create a course from my notes.',
      ),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
