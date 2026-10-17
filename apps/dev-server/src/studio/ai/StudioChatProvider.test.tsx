import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nProvider } from '@open-edu/i18n';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { StudioAssistantProvider, useStudioAssistant } from './StudioAssistantProvider';
import { StudioChatProvider, useStudioChat } from './StudioChatProvider';
import { EditorBridgeProvider } from './EditorBridgeContext';
import { ConversationStore } from './ConversationStore';
import { setConversationId } from './assistantStorage';
import type { StudioContextSnapshot } from './context';
import type { StudioApi } from '../studioApi';
import { authoringFixture } from '../test/authoringFixture.js';

function sseResponse(chunks: Array<Record<string, unknown>>): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('');
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

interface ChatApi {
  messages: unknown[];
  sendMessage: ReturnType<typeof vi.fn>;
  regenerate: ReturnType<typeof vi.fn>;
  status: string;
  stop: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
  setMessages: (m: unknown[]) => void;
  error: undefined;
}

const { capturedUseChatOptions } = vi.hoisted(() => ({
  capturedUseChatOptions: { current: undefined as undefined | Record<string, unknown> },
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (options: Record<string, unknown>) => {
    capturedUseChatOptions.current = options as Record<string, unknown>;
    const [messages, setMessages] = useState<unknown[]>([]);
    const api: ChatApi = {
      messages,
      sendMessage: vi.fn(),
      regenerate: vi.fn(),
      status: 'ready',
      stop: vi.fn(),
      clearError: vi.fn(),
      setMessages,
      error: undefined,
    };
    return api;
  },
}));

function ContextSeeder({
  snapshot,
  children,
}: {
  snapshot: StudioContextSnapshot;
  children: ReactNode;
}) {
  const { setContext } = useStudioAssistant();
  useEffect(() => {
    setContext(snapshot);
  }, [setContext, snapshot]);
  return <>{children}</>;
}

const snapshot: StudioContextSnapshot = {
  view: 'outline',
  locale: 'en',
  aiAvailable: true,
  course: {
    id: 'course-x',
    title: 'Course',
    activityCount: 2,
    outline: [
      { title: 'A', kind: 'lesson', path: 'nodes/a.md' },
      { title: 'B', kind: 'quiz', path: 'nodes/b.json' },
    ],
  },
};

function Consumer() {
  const { messages, clearMessages } = useStudioChat();
  return (
    <div>
      <button type="button" onClick={clearMessages}>
        New conversation
      </button>
      {messages.length === 0 ? (
        <p data-testid="empty">empty</p>
      ) : (
        <ul>
          {messages.map((m) => (
            <li key={m.id} data-testid="message">
              {m.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function wrap() {
  return render(
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <StudioAssistantProvider>
        <EditorBridgeProvider>
          <StudioChatProvider courseId="course-x">
            <ContextSeeder snapshot={snapshot}>
              <Consumer />
            </ContextSeeder>
          </StudioChatProvider>
        </EditorBridgeProvider>
      </StudioAssistantProvider>
    </I18nProvider>,
  );
}

describe('StudioChatProvider new conversation', () => {
  let store: ConversationStore;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    store = new ConversationStore();
    await store.saveMessages('course-x', [
      { id: 'user-1', role: 'user', content: 'Old question', createdAt: 1 },
      { id: 'assistant-1', role: 'assistant', content: 'Old answer', createdAt: 2 },
    ]);
    setConversationId('course-x', 'old-thread');
  });

  afterEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    try {
      await store.clearMessages('course-x');
    } catch {
      // ignore
    }
  });

  it('starts a fresh chat after a single New conversation click without showing old messages', async () => {
    const user = userEvent.setup();
    wrap();

    // History hydrates from the pre-seeded store.
    await waitFor(() => {
      expect(screen.getByText('Old question')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    // A single click must produce an empty thread (no stale messages reappear).
    await waitFor(() => {
      expect(screen.getByTestId('empty')).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId('message')).toHaveLength(0);
  });
});

const COURSE_NOTES =
  'Help me create a course from my notes. Course for School students. Exploring different states of India. Capital cities & key historical places. It needs to be interactive & should be engaging.';

function makeUserMessage(content: string): UIMessage {
  return {
    id: `user-${content.slice(0, 10)}`,
    role: 'user',
    parts: [{ type: 'text', text: content, state: 'done' }],
  };
}

async function readChunks(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const chunks: UIMessageChunk[] = [];
  let finished = false;
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      finished = true;
    } else {
      chunks.push(value);
    }
  }
  return chunks;
}

function chunkText(chunks: UIMessageChunk[]): string {
  return chunks
    .filter((c): c is Extract<UIMessageChunk, { type: 'text-delta' }> => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');
}

describe('StudioChatProvider single-endpoint transport', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    capturedUseChatOptions.current = undefined;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'start', messageId: 'm1', role: 'assistant' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Here is a draft' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function renderBrowserChat(api: Partial<StudioApi>) {
    render(
      <I18nProvider
        locale="en"
        dictionaries={{ en: { studio: studioEn as Record<string, string> } }}
      >
        <StudioAssistantProvider>
          <EditorBridgeProvider>
            <StudioChatProvider courseId="course-x" api={api as StudioApi}>
              <ContextSeeder snapshot={snapshot}>
                <div />
              </ContextSeeder>
            </StudioChatProvider>
          </EditorBridgeProvider>
        </StudioAssistantProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(capturedUseChatOptions.current).toBeDefined());
    await act(async () => {});
  }

  async function sendViaTransport(content: string, chatId = 'chat-1'): Promise<UIMessageChunk[]> {
    const transport = capturedUseChatOptions.current
      ?.transport as unknown as ChatTransport<UIMessage>;
    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      messageId: undefined,
      messages: [makeUserMessage(content)],
      chatId,
      abortSignal: undefined,
    });
    return readChunks(stream);
  }

  it('sends a course-generation message to the single /api/studio/ai/chat endpoint', async () => {
    const generateCourseDraft = vi.fn();
    await renderBrowserChat({ generateCourseDraft });

    const chunks = await sendViaTransport(COURSE_NOTES);

    expect(generateCourseDraft).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/studio/ai/chat');
    const body = JSON.parse((init as RequestInit).body as string) as {
      messages: Array<{ role: string; content: string }>;
      context: StudioContextSnapshot;
    };
    expect(body.messages[0]).toMatchObject({ role: 'user', content: COURSE_NOTES });
    expect(body.context.view).toBe('outline');
    expect(chunkText(chunks)).toBe('Here is a draft');
  });

  it('sends a tool-intent "Add this quiz to course" message to the same endpoint', async () => {
    const generateItemAdd = vi.fn();
    const generateItemEdit = vi.fn();
    await renderBrowserChat({ generateItemAdd, generateItemEdit });

    const chunks = await sendViaTransport('Add this quiz to course');

    expect(generateItemAdd).not.toHaveBeenCalled();
    expect(generateItemEdit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/studio/ai/chat');
    const body = JSON.parse((init as RequestInit).body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0]).toMatchObject({ role: 'user', content: 'Add this quiz to course' });
    expect(chunkText(chunks)).toBe('Here is a draft');
  });

  it('forwards authoring into generateItemEdit from runIntent', async () => {
    const generateItemEdit = vi.fn().mockResolvedValue({
      ok: true,
      items: [{ kind: 'lesson', title: 'T', content: '# T\n' }],
    });
    function IntentRunner() {
      const { runIntent } = useStudioChat();
      return (
        <button
          type="button"
          onClick={() => void runIntent('lesson', 'rewrite', '# Title\n\nBody')}
        >
          Run intent
        </button>
      );
    }
    render(
      <I18nProvider
        locale="en"
        dictionaries={{ en: { studio: studioEn as Record<string, string> } }}
      >
        <StudioAssistantProvider>
          <EditorBridgeProvider>
            <StudioChatProvider
              courseId="course-x"
              api={{ generateItemEdit } as unknown as StudioApi}
              authoring={authoringFixture}
            >
              <ContextSeeder snapshot={snapshot}>
                <IntentRunner />
              </ContextSeeder>
            </StudioChatProvider>
          </EditorBridgeProvider>
        </StudioAssistantProvider>
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Run intent' }));
    await waitFor(() => expect(generateItemEdit).toHaveBeenCalled());
    expect(generateItemEdit).toHaveBeenCalledWith(
      'lesson',
      'rewrite',
      '# Title\n\nBody',
      undefined,
      { authoring: authoringFixture },
    );
  });

  it('always targets the loop endpoint regardless of intent', async () => {
    await renderBrowserChat({});

    for (const content of [
      COURSE_NOTES,
      'Make this simpler',
      'create a quiz about photosynthesis',
      'What is a quote?',
    ]) {
      fetchMock.mockClear();
      await sendViaTransport(content);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![0]).toBe('/api/studio/ai/chat');
    }
  });
});
