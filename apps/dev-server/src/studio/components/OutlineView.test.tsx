import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { OutlineView } from './OutlineView';
import type { StudioApi } from '../studioApi.js';
import type { ActivitySummary } from '../types.js';
import type { CuratedWidget } from '../widgets/curatedCatalog.js';
import { authoringFixture } from '../test/authoringFixture.js';

const { mockCatalog } = vi.hoisted(() => {
  const multipleChoice: CuratedWidget = {
    id: 'core.multiple-choice',
    name: 'Multiple Choice',
    description: 'Select the correct answer from a list of options',
    domain: 'core',
    source: 'builtin',
    trustTier: 'native',
    version: '0.1.0',
    guide: { configFields: [] },
  };
  return {
    mockCatalog: {
      multipleChoice,
      matching: {
        id: 'core.matching',
        name: 'Matching',
        domain: 'core',
        source: 'builtin',
        trustTier: 'native',
        version: '0.1.0',
        guide: { configFields: [] },
      } as CuratedWidget,
    },
  };
});

vi.mock('../widgets/curatedCatalog.js', () => ({
  listCuratedWidgets: () => [mockCatalog.multipleChoice, mockCatalog.matching],
  getCuratedWidget: (id: string) =>
    id === 'core.multiple-choice' ? mockCatalog.multipleChoice : undefined,
}));

const { mockAcceptDraft, capturedOnAccept } = vi.hoisted(() => {
  let _onAccept: ((item: unknown) => void) | null = null;
  return {
    mockAcceptDraft: (item: unknown) => _onAccept?.(item),
    capturedOnAccept: (fn: (item: unknown) => void) => {
      _onAccept = fn;
    },
  };
});

vi.mock('./AiAddDialog.js', () => ({
  AiAddDialog: ({ onAccept }: { onAccept: (item: unknown) => void }) => {
    capturedOnAccept(onAccept);
    return <div data-testid="ai-add-dialog" />;
  },
}));

const { mockAssistantContext, refreshProvenanceMock } = vi.hoisted(() => ({
  mockAssistantContext: { panelOpen: false, openWithPreset: vi.fn(), enabled: true },
  refreshProvenanceMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ai/provenanceRefresh.js', () => ({
  refreshProvenanceAfterApply: refreshProvenanceMock,
}));

vi.mock('../ai', () => ({
  useStudioAssistant: () => mockAssistantContext,
}));

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

const sampleActivities: ActivitySummary[] = [
  { id: 'nodes/a.md', path: 'nodes/a.md', title: 'Intro', kind: 'lesson' },
  { id: 'nodes/q.json', path: 'nodes/q.json', title: 'Check', kind: 'quiz' },
];

const validLesson = '# Fractions\n\nHello';
const validQuiz = JSON.stringify({
  type: 'quiz',
  question: 'Q?',
  options: [
    { id: 'a', text: 'A', correct: true },
    { id: 'b', text: 'B', correct: false },
  ],
});

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    getOutline: vi.fn().mockResolvedValue({ activities: sampleActivities, title: 'Test' }),
    saveOutlineOrder: vi.fn().mockResolvedValue({ success: true }),
    applyTemplate: vi.fn(),
    exportOep: vi.fn(),
    readFile: vi.fn().mockImplementation((path: string) =>
      Promise.resolve({
        path,
        content: path.endsWith('.json') ? validQuiz : validLesson,
      }),
    ),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
    getAiStatus: vi.fn().mockResolvedValue({ available: true }),
    generateItemAdd: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

describe('OutlineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssistantContext.enabled = true;
    refreshProvenanceMock.mockClear();
  });

  it('loads and renders activities with kind badges', async () => {
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Check')).toBeInTheDocument();
    expect(screen.getByText('Lesson')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
  });

  it('saves new order on move down', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for intro/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move intro down/i }));
    expect(api.saveOutlineOrder).toHaveBeenCalledWith(['nodes/q.json', 'nodes/a.md']);
  });

  it('adds a lesson and persists outline order', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /add activity/i }));
    await user.click(await screen.findByRole('menuitem', { name: /add lesson/i }));
    expect(api.writeFile).toHaveBeenCalled();
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    const path = writeCall.mock.calls[0]![0] as string;
    expect(path.startsWith('nodes/lesson-')).toBe(true);
    expect(api.saveOutlineOrder).toHaveBeenCalled();
    const orderCall = api.saveOutlineOrder as ReturnType<typeof vi.fn>;
    expect(orderCall.mock.calls.at(-1)![0]).toEqual([...sampleActivities.map((a) => a.path), path]);
  });

  it('adds a quiz with a correct option', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /add activity/i }));
    await user.click(await screen.findByRole('menuitem', { name: /add quiz/i }));
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    const path = writeCall.mock.calls[0]![0] as string;
    expect(path.endsWith('.json')).toBe(true);
    const content = writeCall.mock.calls[0]![1] as string;
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('quiz');
    expect(parsed.options.some((o: { correct?: boolean }) => o.correct)).toBe(true);
  });

  it('adds a practice via the widget picker and persists outline order', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /add activity/i }));
    await user.click(await screen.findByRole('menuitem', { name: /add practice/i }));
    const useButtons = await screen.findAllByRole('button', { name: /use this practice/i });
    await user.click(useButtons[0]!);
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    const path = writeCall.mock.calls[0]![0] as string;
    expect(path.startsWith('nodes/practice-')).toBe(true);
    expect(path.endsWith('.json')).toBe(true);
    const content = writeCall.mock.calls[0]![1] as string;
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('exercise');
    expect(parsed.widget).toBe('core.multiple-choice');
    expect(api.saveOutlineOrder).toHaveBeenCalled();
    const orderCall = api.saveOutlineOrder as ReturnType<typeof vi.fn>;
    expect(orderCall.mock.calls.at(-1)![0]).toEqual([...sampleActivities.map((a) => a.path), path]);
  });

  it('navigates to edit for an activity by clicking the title', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(wrap(<OutlineView api={makeApi()} onEdit={onEdit} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: 'Intro' }));
    expect(onEdit).toHaveBeenCalledWith('nodes/a.md');
  });

  it('shows empty state when no activities', async () => {
    const api = makeApi({ getOutline: vi.fn().mockResolvedValue({ activities: [], title: 'T' }) });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    expect(await screen.findByText('Add your first activity to get started.')).toBeInTheDocument();
  });

  it('reports load errors', async () => {
    const onError = vi.fn();
    const api = makeApi({ getOutline: vi.fn().mockRejectedValue(new Error('nope')) });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={onError} />));
    expect(await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('nope')));
  });

  it('opens the author assistant when clicking Add with AI', async () => {
    const user = userEvent.setup();
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /add activity/i }));
    await user.click(await screen.findByRole('menuitem', { name: /add with ai/i }));
    expect(mockAssistantContext.openWithPreset).toHaveBeenCalled();
  });

  it('accepting an AI draft writes the file, appends the row, and persists order', async () => {
    mockAssistantContext.enabled = false;
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');

    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    writeCall.mockClear();

    await act(async () => {
      mockAcceptDraft({
        kind: 'quiz',
        title: 'Drafted quiz',
        content: JSON.stringify({
          type: 'quiz',
          question: 'Drafted?',
          options: [
            { id: 'a', text: 'A', correct: true },
            { id: 'b', text: 'B', correct: false },
            { id: 'c', text: 'C', correct: false },
            { id: 'd', text: 'D', correct: false },
          ],
        }),
      });
    });

    await waitFor(() => {
      expect(writeCall).toHaveBeenCalled();
    });
    const path = writeCall.mock.calls[0]![0] as string;
    expect(path).toMatch(/^nodes\/quiz-\d+\.json$/);
    expect(api.saveOutlineOrder).toHaveBeenCalled();
    mockAssistantContext.enabled = true;
  });

  it('refreshes provenance after accepting an AI draft when authoring is set', async () => {
    mockAssistantContext.enabled = false;
    const api = makeApi();
    const draftContent = JSON.stringify({
      type: 'quiz',
      question: 'Drafted?',
      options: [
        { id: 'a', text: 'A', correct: true },
        { id: 'b', text: 'B', correct: false },
        { id: 'c', text: 'C', correct: false },
        { id: 'd', text: 'D', correct: false },
      ],
    });
    render(
      wrap(
        <OutlineView api={api} authoring={authoringFixture} onEdit={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByText('Intro');

    await act(async () => {
      mockAcceptDraft({
        kind: 'quiz',
        title: 'Drafted quiz',
        content: draftContent,
      });
    });

    await waitFor(() => expect(refreshProvenanceMock).toHaveBeenCalled());
    const [, applied, authoring] = refreshProvenanceMock.mock.calls[0]!;
    expect(applied[0].title).toBe('Drafted quiz');
    expect(applied[0].content).toBe(draftContent);
    expect(authoring).toBe(authoringFixture);
    mockAssistantContext.enabled = true;
  });

  it('does not mount AiAddDialog when the author assistant is enabled', async () => {
    mockAssistantContext.enabled = true;
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    expect(screen.queryByTestId('ai-add-dialog')).toBeNull();
  });

  it('renders listitems when activities present', async () => {
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('deletes an activity via row menu and persists the new order', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for check/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete check/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteFile).toHaveBeenCalledWith('nodes/q.json');
    expect(api.saveOutlineOrder).toHaveBeenCalledWith(['nodes/a.md']);
    expect(screen.queryByText('Check')).not.toBeInTheDocument();
  });

  it('cancel does not delete', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for check/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete check/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.deleteFile).not.toHaveBeenCalled();
    expect(screen.getByText('Check')).toBeInTheDocument();
  });

  it('deleting the last activity succeeds with an empty order', async () => {
    const user = userEvent.setup();
    const api = makeApi({
      getOutline: vi.fn().mockResolvedValue({
        activities: [{ id: 'nodes/a.md', path: 'nodes/a.md', title: 'Intro', kind: 'lesson' }],
        title: 'Test',
      }),
    });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for intro/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete intro/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteFile).toHaveBeenCalledWith('nodes/a.md');
    expect(api.saveOutlineOrder).toHaveBeenCalledWith([]);
    expect(await screen.findByText('Add your first activity to get started.')).toBeInTheDocument();
  });

  it('reconciles with the server when persisting the new order fails', async () => {
    const user = userEvent.setup();
    const getOutline = vi.fn().mockResolvedValue({ activities: sampleActivities, title: 'Test' });
    const onError = vi.fn();
    const api = makeApi({
      getOutline,
      saveOutlineOrder: vi.fn().mockRejectedValue(new Error('save failed')),
    });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={onError} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for check/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete check/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onError).toHaveBeenCalledWith('save failed');
    expect(await screen.findByText('Check')).toBeInTheDocument();
  });

  it('only one Add control exists and no standalone Add lesson button outside a menu', async () => {
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    const addTriggers = screen.getAllByRole('button', { name: /add activity/i });
    expect(addTriggers).toHaveLength(1);
  });

  it('settles the moved row and restores focus to its menu trigger', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('button', { name: /activity actions for intro/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move intro down/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activity actions for intro/i })).toHaveFocus();
    });
    expect(api.saveOutlineOrder).toHaveBeenCalledWith(['nodes/q.json', 'nodes/a.md']);
  });

  it('shows the health strip with the activity count when ready', async () => {
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    expect(await screen.findByText('2 activities')).toBeInTheDocument();
    expect(screen.getByText('Ready to share')).toBeInTheDocument();
  });

  it('shows the review-ready label when a quiz has no correct answer', async () => {
    const badQuiz = JSON.stringify({
      type: 'quiz',
      question: 'Q?',
      options: [{ id: 'a', text: 'A', correct: false }],
    });
    const api = makeApi({
      readFile: vi
        .fn()
        .mockImplementation((path: string) =>
          Promise.resolve({ path, content: path.endsWith('.json') ? badQuiz : validLesson }),
        ),
    });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    expect(await screen.findByText('Review ready check')).toBeInTheDocument();
  });

  it('navigates to Share from the health strip', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} onShare={onShare} />),
    );
    expect(await screen.findByText('2 activities')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const shareBtn = buttons.find((b) => b.textContent?.trim() === 'Share')!;
    expect(shareBtn).toBeTruthy();
    expect(shareBtn.getAttribute('disabled')).toBeNull();
    await user.click(shareBtn);
    expect(onShare).toHaveBeenCalled();
  });

  it('hides the health strip when the course is empty', async () => {
    const api = makeApi({ getOutline: vi.fn().mockResolvedValue({ activities: [], title: 'T' }) });
    render(wrap(<OutlineView api={api} onEdit={() => {}} onError={() => {}} />));
    expect(await screen.findByText('Add your first activity to get started.')).toBeInTheDocument();
    expect(screen.queryByText(/activities/)).not.toBeInTheDocument();
  });

  it('renders a left rail with course meta and tip, and advanced accordions in the main column', async () => {
    const user = userEvent.setup();
    render(wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />));
    await screen.findByText('Intro');
    const aside = screen.getByRole('complementary');
    expect(within(aside).getByText('Test')).toBeInTheDocument();
    expect(
      within(aside).getByText('Use the menu on each row to move it up or down.'),
    ).toBeInTheDocument();
    expect(within(aside).queryByRole('button', { name: /learning path/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /learning path/i }));
    expect(
      await screen.findByText('Learners go through activities in outline order.'),
    ).toBeInTheDocument();
  });
});
