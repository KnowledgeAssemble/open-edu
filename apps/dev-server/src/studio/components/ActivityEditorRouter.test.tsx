import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { ActivityEditorRouter } from './ActivityEditorRouter';
import { EditorBridgeProvider } from '../ai/EditorBridgeContext';
import type { StudioApi } from '../studioApi.js';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <EditorBridgeProvider>{ui}</EditorBridgeProvider>
    </I18nProvider>
  );
}

function makeApi(content: string, path = 'nodes/x.md'): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn(),
    getOutline: vi.fn(),
    saveOutlineOrder: vi.fn(),
    applyTemplate: vi.fn(),
    exportOep: vi.fn(),
    readFile: vi.fn().mockResolvedValue({ path, content }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    getAiStatus: vi.fn().mockResolvedValue({ available: false }),
    generateItemEdit: vi.fn(),
  } as unknown as StudioApi;
}

describe('ActivityEditorRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes markdown to the lesson editor', async () => {
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi('# Hi', 'nodes/l.md')}
          path="nodes/l.md"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByLabelText(/lesson content/i)).toBeInTheDocument();
  });

  it('routes quiz json to the quiz editor', async () => {
    const content = JSON.stringify({
      type: 'quiz',
      question: 'Q?',
      options: [
        { id: 'a', text: 'A', correct: true },
        { id: 'b', text: 'B', correct: false },
      ],
    });
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi(content, 'nodes/q.json')}
          path="nodes/q.json"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByLabelText(/question/i)).toBeInTheDocument();
  });

  it('routes practice json to the practice editor', async () => {
    const content = JSON.stringify({
      type: 'exercise',
      widget: 'core.multiple-choice',
      config: {},
    });
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi(content, 'nodes/p.json')}
          path="nodes/p.json"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByLabelText(/lesson title/i)).toBeInTheDocument();
  });

  it('routes reflection json to the reflection editor', async () => {
    const content = JSON.stringify({
      type: 'reflection',
      title: 'Reflect',
      prompt: 'Think about it',
    });
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi(content, 'nodes/r.json')}
          path="nodes/r.json"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByLabelText(/reflection prompt/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Reflect')).toBeInTheDocument();
  });

  it('routes unknown activity types to the raw file editor', async () => {
    const content = 'custom text content';
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi(content, 'nodes/notes.txt')}
          path="nodes/notes.txt"
          onSaved={() => {}}
          onError={() => {}}
        />,
      ),
    );
    expect(await screen.findByLabelText(/file content/i)).toBeInTheDocument();
  });

  it('forwards onCancel to the active editor and cancels from a lesson', async () => {
    const onCancel = vi.fn();
    render(
      wrap(
        <ActivityEditorRouter
          api={makeApi('# Hi', 'nodes/l.md')}
          path="nodes/l.md"
          onSaved={() => {}}
          onError={() => {}}
          onCancel={onCancel}
        />,
      ),
    );
    await screen.findByLabelText(/lesson content/i);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
