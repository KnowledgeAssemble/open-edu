import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { LessonActivityEditor } from './LessonActivityEditor';
import { EditorBridgeProvider } from '../ai/EditorBridgeContext';
import type { StudioApi } from '../studioApi.js';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <EditorBridgeProvider>{ui}</EditorBridgeProvider>
    </I18nProvider>
  );
}

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn(),
    getOutline: vi.fn(),
    saveOutlineOrder: vi.fn(),
    applyTemplate: vi.fn(),
    exportOep: vi.fn(),
    readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: '# Title\n\nBody' }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    getAiStatus: vi.fn().mockResolvedValue({ available: false }),
    generateItemEdit: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

describe('LessonActivityEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies a draft via editor bridge by replacing the body and re-syncing the title', async () => {
    const api = makeApi();
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Title');
    const textarea = screen.getByLabelText(/lesson content/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('# Title');
  });

  it('loads markdown and extracts title from first heading', async () => {
    render(
      wrap(
        <LessonActivityEditor
          api={makeApi()}
          path="nodes/l.md"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByDisplayValue('Title')).toBeInTheDocument();
  });

  it('syncing title updates the first markdown heading', async () => {
    render(
      wrap(
        <LessonActivityEditor
          api={makeApi()}
          path="nodes/l.md"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await screen.findByDisplayValue('Title');
    const titleInput = screen.getByLabelText(/lesson title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Fractions');
    const body = screen.getByLabelText(/lesson content/i) as HTMLTextAreaElement;
    expect(body.value).toMatch(/^# Fractions\n/);
  });

  it('warns when markdown lacks a heading', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: 'No heading' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    expect(await screen.findByText('Needs a heading')).toBeInTheDocument();
  });

  it('saves content via writeFile', async () => {
    const api = makeApi();
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Title');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).toHaveBeenCalledWith('nodes/l.md', '# Title\n\nBody');
  });

  it('cancels without writing when onCancel is provided', async () => {
    const api = makeApi();
    const onCancel = vi.fn();
    render(
      wrap(
        <LessonActivityEditor
          api={api}
          path="nodes/l.md"
          onSaved={() => {}}
          onError={() => {}}
          onCancel={onCancel}
        />,
      ),
    );
    await screen.findByDisplayValue('Title');
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).not.toHaveBeenCalled();
  });

  it('shows coaching panel heading-missing label when body has no markdown heading', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: 'No heading here' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    expect(await screen.findByText('Needs a heading')).toBeInTheDocument();
  });

  it('shows coaching panel heading-present after typing a heading', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: 'No heading here' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByText('Needs a heading');
    const textarea = screen.getByLabelText(/lesson content/i) as HTMLTextAreaElement;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '# A heading\n\nBody');
    expect(await screen.findByText('Has a clear heading')).toBeInTheDocument();
  });

  it('toggles to the preview tab and renders the markdown body', async () => {
    const api = makeApi({
      readFile: vi
        .fn()
        .mockResolvedValue({ path: 'nodes/l.md', content: '# Fractions\n\n**Key idea:** halves' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Fractions');
    await userEvent.click(screen.getByRole('tab', { name: /preview/i }));
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fractions', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Key idea:', { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText(/lesson content/i)).not.toBeInTheDocument();
  });

  it('returns to the write tab and re-shows the textarea', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: '# Fractions\n\nBody' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Fractions');
    await userEvent.click(screen.getByRole('tab', { name: /preview/i }));
    expect(screen.queryByLabelText(/lesson content/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /write/i }));
    expect(screen.getByLabelText(/lesson content/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when previewing an empty body', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({ path: 'nodes/l.md', content: '# Title' }),
    });
    render(
      wrap(
        <LessonActivityEditor api={api} path="nodes/l.md" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Title');
    const textarea = screen.getByLabelText(/lesson content/i) as HTMLTextAreaElement;
    await userEvent.clear(textarea);
    await userEvent.click(screen.getByRole('tab', { name: /preview/i }));
    expect(
      await screen.findByText('Nothing to preview yet — add some content.'),
    ).toBeInTheDocument();
  });
});
