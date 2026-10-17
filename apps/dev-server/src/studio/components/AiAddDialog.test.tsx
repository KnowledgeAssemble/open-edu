import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { AiAddDialog } from './AiAddDialog';
import type { StudioApi } from '../studioApi.js';
import type { DraftItem } from '../ai/types.js';
import { authoringFixture } from '../test/authoringFixture.js';

vi.mock('./ItemDraftPreview.js', () => ({
  ItemDraftPreview: ({ item }: { item: DraftItem }) => (
    <div data-testid="draft-preview">{item.title}</div>
  ),
}));

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
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
    readFile: vi.fn(),
    writeFile: vi.fn(),
    getAiStatus: vi.fn().mockResolvedValue({ available: true }),
    generateItemAdd: vi.fn().mockResolvedValue({
      ok: true,
      item: { kind: 'lesson', title: 'Fractions', content: '# Fractions\n\nBody' },
    }),
    ...overrides,
  } as unknown as StudioApi;
}

describe('AiAddDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches kind via the tabs', async () => {
    render(
      wrap(
        <AiAddDialog
          api={makeApi()}
          open
          onOpenChange={() => {}}
          onAccept={() => {}}
          onError={() => {}}
        />,
      ),
    );
    const quizTab = await screen.findByRole('tab', { name: 'Quiz' });
    await userEvent.click(quizTab);
    expect(quizTab).toHaveAttribute('data-state', 'active');
  });

  it('disables Generate until the description is long enough', async () => {
    const api = makeApi();
    render(
      wrap(
        <AiAddDialog
          api={api}
          open
          onOpenChange={() => {}}
          onAccept={() => {}}
          onError={() => {}}
        />,
      ),
    );
    const generateButton = await screen.findByRole('button', { name: /generate draft/i });
    expect(generateButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/describe what you want to create/i), 'Too short');
    expect(generateButton).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/describe what you want to create/i));
    await userEvent.type(
      screen.getByLabelText(/describe what you want to create/i),
      'A complete description that is definitely long enough',
    );
    expect(generateButton).toBeEnabled();
  });

  it('shows the preview and accepts a generated draft', async () => {
    const api = makeApi();
    const onAccept = vi.fn();
    const onOpenChange = vi.fn();
    render(
      wrap(
        <AiAddDialog
          api={api}
          open
          onOpenChange={onOpenChange}
          onAccept={onAccept}
          onError={() => {}}
        />,
      ),
    );
    await userEvent.type(
      await screen.findByLabelText(/describe what you want to create/i),
      'Explain fractions using pizza slice examples for beginners',
    );
    await userEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    expect(await screen.findByTestId('draft-preview')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add to course/i }));
    expect(onAccept).toHaveBeenCalledWith({
      kind: 'lesson',
      title: 'Fractions',
      content: '# Fractions\n\nBody',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows retryFailed inline when the server returns ok:false', async () => {
    const api = makeApi({
      generateItemAdd: vi
        .fn()
        .mockResolvedValue({ ok: false, code: 'item-retry-failed', error: 'x' }),
    });
    render(
      wrap(
        <AiAddDialog
          api={api}
          open
          onOpenChange={() => {}}
          onAccept={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await userEvent.type(
      await screen.findByLabelText(/describe what you want to create/i),
      'Explain fractions using pizza slice examples for beginners',
    );
    const generateButton = screen.getByRole('button', { name: /generate draft/i });
    await waitFor(() => expect(generateButton).toBeEnabled());
    await userEvent.click(generateButton);
    expect(await screen.findByText(/AI couldn’t draft that item/)).toBeInTheDocument();
  });

  it('passes authoring to generateItemAdd when provided', async () => {
    const api = makeApi();
    const description = 'Explain fractions using pizza slice examples for beginners';
    render(
      wrap(
        <AiAddDialog
          api={api}
          authoring={authoringFixture}
          open
          onOpenChange={() => {}}
          onAccept={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await userEvent.type(
      await screen.findByLabelText(/describe what you want to create/i),
      description,
    );
    await userEvent.click(screen.getByRole('button', { name: /generate draft/i }));
    await waitFor(() =>
      expect(api.generateItemAdd).toHaveBeenCalledWith('lesson', description, {
        authoring: authoringFixture,
      }),
    );
  });

  it('shows the unavailable hint and disables Generate when AI is unavailable', async () => {
    const api = makeApi({
      getAiStatus: vi.fn().mockResolvedValue({ available: false, reason: 'missing-key' }),
    });
    render(
      wrap(
        <AiAddDialog
          api={api}
          open
          onOpenChange={() => {}}
          onAccept={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(
      await screen.findByText(/AI is unavailable offline or no API key is configured/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate draft/i })).not.toBeInTheDocument();
  });
});
