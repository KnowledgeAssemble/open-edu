import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { QuizActivityEditor } from './QuizActivityEditor';
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
    readFile: vi.fn().mockResolvedValue({ path: 'nodes/q.json', content: '{}' }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    getAiStatus: vi.fn().mockResolvedValue({ available: false }),
    generateItemEdit: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

describe('QuizActivityEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads existing quiz content', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({
        path: 'nodes/q.json',
        content: JSON.stringify({
          type: 'quiz',
          question: 'Which one?',
          options: [
            { id: 'a', text: 'Alpha', correct: true },
            { id: 'b', text: 'Beta', correct: false },
          ],
        }),
      }),
    });
    render(
      wrap(
        <QuizActivityEditor api={api} path="nodes/q.json" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    expect(await screen.findByDisplayValue('Which one?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
  });

  it('adds an option', async () => {
    render(
      wrap(
        <QuizActivityEditor
          api={makeApi()}
          path="nodes/q.json"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await screen.findByLabelText(/question/i);
    await userEvent.click(screen.getByRole('button', { name: /add option/i }));
    expect(screen.getAllByLabelText('Option 3').length).toBeGreaterThan(0);
  });

  it('saves quiz with exactly one correct option', async () => {
    const api = makeApi();
    render(
      wrap(
        <QuizActivityEditor api={api} path="nodes/q.json" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByLabelText(/question/i);
    await userEvent.type(screen.getByLabelText(/question/i), 'What is 2+2?');
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, '4');
    await userEvent.clear(inputs[1]!);
    await userEvent.type(inputs[1]!, '5');

    await userEvent.click(screen.getByRole('radio', { name: /option 2/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    const content = writeCall.mock.calls[0]![1] as string;
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('quiz');
    const trueCount = parsed.options.filter((o: { correct: boolean }) => o.correct).length;
    expect(trueCount).toBe(1);
    expect(parsed.options[1].correct).toBe(true);
  });

  it('coerces every option to exactly one correct when saving', async () => {
    const api = makeApi();
    render(
      wrap(
        <QuizActivityEditor api={api} path="nodes/q.json" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByLabelText(/question/i);
    await userEvent.type(screen.getByLabelText(/question/i), 'Pick one');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    const parsed = JSON.parse(writeCall.mock.calls[0]![1] as string);
    const trueCount = parsed.options.filter((o: { correct: boolean }) => o.correct).length;
    expect(trueCount).toBe(1);
  });

  it('disables save and warns when no correct answer is selected', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({
        path: 'nodes/q.json',
        content: JSON.stringify({
          type: 'quiz',
          question: 'Q?',
          options: [
            { id: 'a', text: 'A', correct: false },
            { id: 'b', text: 'B', correct: false },
          ],
        }),
      }),
    });
    render(
      wrap(
        <QuizActivityEditor api={api} path="nodes/q.json" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    await screen.findByDisplayValue('Q?');
    expect(screen.getByText('Choose the correct answer before saving.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: /option 2/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    });
  });

  it('cancels without writing when onCancel is provided', async () => {
    const api = makeApi();
    const onCancel = vi.fn();
    render(
      wrap(
        <QuizActivityEditor
          api={api}
          path="nodes/q.json"
          onSaved={() => {}}
          onError={() => {}}
          onCancel={onCancel}
        />,
      ),
    );
    await screen.findByLabelText(/question/i);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    const writeCall = api.writeFile as ReturnType<typeof vi.fn>;
    expect(writeCall).not.toHaveBeenCalled();
  });

  it('shows coaching panel with positive checks for correct answer and min options', async () => {
    const api = makeApi({
      readFile: vi.fn().mockResolvedValue({
        path: 'nodes/q.json',
        content: JSON.stringify({
          type: 'quiz',
          question: 'Q?',
          options: [
            { id: 'a', text: 'A', correct: true },
            { id: 'b', text: 'B', correct: false },
          ],
        }),
      }),
    });
    render(
      wrap(
        <QuizActivityEditor api={api} path="nodes/q.json" onSaved={() => {}} onError={() => {}} />,
      ),
    );
    expect(await screen.findByText('A correct answer is selected')).toBeInTheDocument();
    expect(screen.getByText('At least two answers')).toBeInTheDocument();
  });
});
