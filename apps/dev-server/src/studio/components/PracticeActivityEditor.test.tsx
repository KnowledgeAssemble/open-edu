import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { PracticeActivityEditor } from './PracticeActivityEditor';
import { EditorBridgeProvider } from '../ai/EditorBridgeContext';
import type { StudioApi } from '../studioApi.js';
import type { CuratedWidget } from '../widgets/curatedCatalog.js';
import { authoringFixture } from '../test/authoringFixture.js';

const { refreshProvenanceMock } = vi.hoisted(() => ({
  refreshProvenanceMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ai/provenanceRefresh.js', () => ({
  refreshProvenanceAfterApply: refreshProvenanceMock,
}));

vi.mock('../../editor/WidgetPreviewPanel.js', () => ({
  WidgetPreviewPanel: () => <div data-testid="preview" />,
}));

const { mockCatalog } = vi.hoisted(() => {
  const multipleChoice: CuratedWidget = {
    id: 'core.multiple-choice',
    name: 'Multiple Choice',
    description: 'Select the correct answer from a list of options',
    domain: 'core',
    source: 'builtin',
    trustTier: 'native',
    version: '0.1.0',
    guide: {
      configFields: [
        {
          name: 'questions',
          type: 'array of objects',
          required: true,
          description: 'The questions to ask.',
        },
        {
          name: 'questions[].question',
          type: 'string',
          required: true,
          description: 'The question text shown to the student.',
        },
        {
          name: 'interactive',
          type: 'boolean',
          required: false,
          description: 'Allow students to answer.',
        },
      ],
    },
    guideMarkdown: '# Multiple Choice',
  };
  const matching: CuratedWidget = {
    id: 'core.matching',
    name: 'Matching',
    description: 'Match pairs of items',
    domain: 'core',
    source: 'builtin',
    trustTier: 'native',
    version: '0.1.0',
  };
  return { mockCatalog: { multipleChoice, matching } };
});

vi.mock('../widgets/curatedCatalog.js', () => ({
  listCuratedWidgets: () => [mockCatalog.multipleChoice, mockCatalog.matching],
  getCuratedWidget: (id: string) =>
    id === 'core.multiple-choice'
      ? mockCatalog.multipleChoice
      : id === 'core.matching'
        ? mockCatalog.matching
        : undefined,
}));

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <EditorBridgeProvider>{ui}</EditorBridgeProvider>
    </I18nProvider>
  );
}

const validNodeContent = JSON.stringify({
  type: 'exercise',
  title: 'Planets quiz',
  widget: 'core.multiple-choice',
  config: {
    questions: [
      { question: 'What is the largest planet?', options: ['Earth', 'Jupiter'], correctIndex: 1 },
    ],
    interactive: true,
  },
});

function makeApi(content: string, overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn(),
    getOutline: vi.fn(),
    saveOutlineOrder: vi.fn(),
    applyTemplate: vi.fn(),
    exportOep: vi.fn(),
    readFile: vi.fn().mockResolvedValue({ path: 'nodes/p.json', content }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    getAiStatus: vi.fn().mockResolvedValue({ available: false }),
    generateItemEdit: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

function renderEditor(
  content: string,
  overrides: {
    onSaved?: () => void;
    onError?: (message: string) => void;
    onCancel?: () => void;
    api?: StudioApi;
  } = {},
) {
  const api = overrides.api ?? makeApi(content);
  render(
    wrap(
      <PracticeActivityEditor
        api={api}
        path="nodes/p.json"
        onSaved={overrides.onSaved ?? (() => {})}
        onError={overrides.onError ?? (() => {})}
        onCancel={overrides.onCancel}
      />,
    ),
  );
  return api;
}

describe('PracticeActivityEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshProvenanceMock.mockClear();
  });

  it('renders the title, settings form, and preview stub after loading an exercise node', async () => {
    renderEditor(validNodeContent);
    expect(await screen.findByDisplayValue('Planets quiz')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getAllByText('Interactive').length).toBeGreaterThan(0);
    expect(screen.getByText('Practice settings')).toBeInTheDocument();
    expect(screen.getByText('Live preview')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
    expect(screen.queryByText(/fix the highlighted settings/i)).not.toBeInTheDocument();
  });

  it('saves a serialized exercise node and calls onSaved', async () => {
    const api = makeApi(validNodeContent);
    const onSaved = vi.fn();
    renderEditor(validNodeContent, { api, onSaved });
    await screen.findByDisplayValue('Planets quiz');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).toHaveBeenCalledWith('nodes/p.json', expect.any(String));
    const parsed = JSON.parse(writeCall.mock.calls[0]![1] as string);
    expect(parsed.type).toBe('exercise');
    expect(parsed.widget).toBe('core.multiple-choice');
    expect(parsed.title).toBe('Planets quiz');
    expect(parsed.config).toEqual({
      questions: [
        { question: 'What is the largest planet?', options: ['Earth', 'Jupiter'], correctIndex: 1 },
      ],
      interactive: true,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('refreshes provenance after save when authoring is provided', async () => {
    const api = makeApi(validNodeContent);
    render(
      wrap(
        <PracticeActivityEditor
          api={api}
          path="nodes/p.json"
          authoring={authoringFixture}
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await screen.findByDisplayValue('Planets quiz');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(refreshProvenanceMock).toHaveBeenCalled();
    const [, applied, authoring] = refreshProvenanceMock.mock.calls[0]!;
    expect(applied[0].path).toBe('nodes/p.json');
    expect(authoring).toBe(authoringFixture);
  });

  it('seeds default settings for an empty config and shows a coaching banner', async () => {
    renderEditor(JSON.stringify({ type: 'exercise', widget: 'core.multiple-choice', config: {} }));
    expect(
      await screen.findByText('Fix the highlighted settings before saving'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Some settings need attention before learners can use this practice.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getAllByText('Interactive').length).toBeGreaterThan(0);
  });

  it('still allows saving when validation errors exist but the JSON is valid', async () => {
    const api = renderEditor(
      JSON.stringify({ type: 'exercise', widget: 'core.multiple-choice', config: {} }),
    );
    await screen.findByText('Fix the highlighted settings before saving');
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeEnabled();
    await userEvent.click(save);
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when the node is not a practice node', async () => {
    renderEditor(JSON.stringify({ type: 'quiz', question: 'Q?' }));
    expect(await screen.findByText('This isn’t a practice activity.')).toBeInTheDocument();
  });

  it('prompts to choose another practice when the widget is unknown', async () => {
    renderEditor(JSON.stringify({ type: 'exercise', widget: 'no.such-widget' }));
    expect(
      await screen.findByText('This practice uses a widget that isn’t in the curated catalog.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /choose another practice/i }));
    expect(await screen.findByText('Choose a practice activity')).toBeInTheDocument();
  });

  it('reports read errors through onError', async () => {
    const onError = vi.fn();
    const api = makeApi('{}', {
      readFile: vi.fn().mockRejectedValue(new Error('nope')),
    });
    renderEditor('{}', { api, onError });
    expect(await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('nope')));
  });

  it('cancels without writing when onCancel is provided', async () => {
    const api = makeApi(validNodeContent);
    const onCancel = vi.fn();
    renderEditor(validNodeContent, { api, onCancel });
    await screen.findByDisplayValue('Planets quiz');
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).not.toHaveBeenCalled();
  });

  it('renders the widget guide when guideMarkdown is present and hides it otherwise', async () => {
    renderEditor(validNodeContent);
    await screen.findByDisplayValue('Planets quiz');
    expect(screen.getByText('How this practice works')).toBeInTheDocument();
  });

  it('does not render the widget guide when guideMarkdown is absent', async () => {
    renderEditor(
      JSON.stringify({ type: 'exercise', widget: 'core.matching', config: { pairs: [] } }),
    );
    await screen.findByLabelText(/lesson title/i);
    expect(screen.queryByText('How this practice works')).not.toBeInTheDocument();
  });

  it('shows field-level validation errors in the settings form', async () => {
    renderEditor(
      JSON.stringify({ type: 'exercise', widget: 'core.matching', config: { pairs: [{}] } }),
    );
    await screen.findByLabelText(/lesson title/i);
    expect(screen.getByText('Fix the highlighted settings before saving')).toBeInTheDocument();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });
});
