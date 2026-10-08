import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { type ChatTransport, type UIMessage } from 'ai';
import { useTranslation } from '@open-edu/i18n';
import { fromUIMessage } from '@open-edu/companion/chat';
import { CompanionChatTransport } from './CompanionChatTransport';
import { DEFAULT_PERMISSIONS } from './CompanionClient';
import { HttpCompanionClient } from './HttpCompanionClient';
import { getConversationId, setConversationId } from './assistantStorage';
import { useStudioAssistant } from './StudioAssistantProvider';
import { ConversationStore, type StoredChatMessage } from './ConversationStore';
import type { DraftApplyMode } from './StudioAssistantProvider';
import type { DraftItem, CourseDraftResult, ItemIntent, ItemIntentParams } from './types';
import type { StudioApi } from '../studioApi';
import type { StudioContextSnapshot } from './context';

interface ChatMessageMetadata {
  mode?: 'explain' | 'draft' | 'course_draft';
  drafts?: DraftItem[];
  courseDraft?: CourseDraftResult;
  applyMode?: DraftApplyMode;
  suggestedNextSteps?: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatMessageMetadata;
}

interface StudioChatContextType {
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  status: 'idle' | 'loading' | 'error';
  stop: () => void;
  regenerate: () => void;
  clearError: () => void;
  clearMessages: () => void;
  appendAssistantNote: (content: string) => void;
  ingestCourseDraft: (
    userContent: string,
    courseDraft: CourseDraftResult,
    readyMessage: string,
  ) => void;
  runIntent: (
    kind: 'lesson' | 'quiz' | 'practice',
    intent: ItemIntent,
    currentContent: string,
    params?: ItemIntentParams,
  ) => Promise<void>;
  api: StudioApi | null;
  onOpenPath?: (path: string) => void;
  onError?: (message: string) => void;
  onOutlineChanged?: () => void;
  onCapabilityGaps?: (gaps: string[]) => void;
}

const StudioChatContext = createContext<StudioChatContextType | null>(null);

function createConversationId(): string {
  return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convert our persisted shape into an AI SDK v7 UIMessage. */
function toUIMessage(stored: StoredChatMessage): UIMessage {
  return {
    id: stored.id,
    role: stored.role,
    parts: stored.content ? [{ type: 'text', text: stored.content, state: 'done' }] : [],
    ...(stored.metadata ? { metadata: stored.metadata } : {}),
  };
}

interface StudioChatProviderProps {
  children: ReactNode;
  courseId?: string;
  api?: StudioApi;
  onOpenPath?: (path: string) => void;
  onError?: (message: string) => void;
  onOutlineChanged?: () => void;
  onCapabilityGaps?: (gaps: string[]) => void;
}

/**
 * Provides the author-assistant chat surface. Resolves the per-course thread
 * (conversationId + persisted messages) before applying history into the AI SDK
 * chat runtime. Remounts when the course or a "New conversation" changes.
 */
export function StudioChatProvider(props: StudioChatProviderProps) {
  const courseKey = props.courseId || 'default';
  const storeRef = useRef(new ConversationStore());

  const [conversationId, setConversationIdState] = useState<string>(() => {
    const existing = getConversationId(courseKey);
    const id = existing ?? createConversationId();
    if (!existing) {
      setConversationId(courseKey, id);
    }
    return id;
  });
  const [hydrated, setHydrated] = useState<UIMessage[] | null>(null);

  // When the conversation id changes (New conversation), invalidate the
  // hydrated history synchronously so the remounted chat never hydrates with
  // the previous conversation's messages before the reload effect runs.
  const handleNewConversationId = useCallback((newId: string) => {
    setHydrated(null);
    setConversationIdState(newId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHydrated(null);
    void storeRef.current.loadMessages(courseKey).then((stored) => {
      if (cancelled) return;
      setHydrated(stored.map(toUIMessage));
    });
    return () => {
      cancelled = true;
    };
  }, [courseKey, conversationId]);

  return (
    <ChatRuntime
      key={`${courseKey}:${conversationId}`}
      courseKey={courseKey}
      conversationId={conversationId}
      initialMessages={hydrated ?? []}
      hydrationPending={hydrated === null}
      store={storeRef.current}
      setConversationIdState={handleNewConversationId}
      api={props.api}
      onOpenPath={props.onOpenPath}
      onError={props.onError}
      onOutlineChanged={props.onOutlineChanged}
      onCapabilityGaps={props.onCapabilityGaps}
    >
      {props.children}
    </ChatRuntime>
  );
}

function ChatRuntime({
  children,
  courseKey,
  conversationId,
  initialMessages,
  hydrationPending,
  store,
  setConversationIdState,
  api,
  onOpenPath,
  onError,
  onOutlineChanged,
  onCapabilityGaps,
}: {
  children: ReactNode;
  courseKey: string;
  conversationId: string;
  initialMessages: UIMessage[];
  hydrationPending: boolean;
  store: ConversationStore;
  setConversationIdState: (id: string) => void;
  api?: StudioApi;
  onOpenPath?: (path: string) => void;
  onError?: (message: string) => void;
  onOutlineChanged?: () => void;
  onCapabilityGaps?: (gaps: string[]) => void;
}) {
  const { t } = useTranslation();
  const {
    context,
    setPendingDrafts,
    lastCourseQuality,
    setLastCourseQuality,
    setEphemeralSuggestions,
  } = useStudioAssistant();

  const contextRef = useRef<StudioContextSnapshot | null>(context);
  contextRef.current = context;
  const lastCourseQualityRef = useRef(lastCourseQuality);
  lastCourseQualityRef.current = lastCourseQuality;
  const clearingRef = useRef(false);
  const hydrationPendingRef = useRef(hydrationPending);
  hydrationPendingRef.current = hydrationPending;

  const buildChatBody = (messages: UIMessage[], chatId: string) => ({
    conversationId: chatId,
    // The shared converter is the only place the client flattens UI messages
    // for the wire body (single converter rule).
    messages: messages.map((m) => fromUIMessage(m)),
    context: {
      ...(contextRef.current ?? {}),
      ...(lastCourseQualityRef.current?.length
        ? { lastCourseDraftQuality: lastCourseQualityRef.current }
        : {}),
    },
  });

  const client = useRef(
    new HttpCompanionClient({
      api: '/api/studio/ai/chat',
      buildBody: buildChatBody,
    }),
  ).current;

  const transport = useRef<ChatTransport<UIMessage>>(
    new CompanionChatTransport<UIMessage>({
      client,
      buildRequest: ({ messages }) => {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        const base: StudioContextSnapshot = contextRef.current ?? {
          view: 'home',
          locale: 'en',
          aiAvailable: true,
        };
        return {
          message: lastUser ? extractText(lastUser) : '',
          context: lastCourseQualityRef.current?.length
            ? { ...base, lastCourseDraftQuality: lastCourseQualityRef.current }
            : base,
          permissions: DEFAULT_PERMISSIONS,
        };
      },
    }),
  ).current;

  const {
    messages: rawMessages,
    sendMessage: chatSend,
    regenerate: chatRegenerate,
    status: chatStatus,
    stop: chatStop,
    clearError: chatClearError,
    setMessages: chatSetMessages,
  } = useChat({
    id: conversationId,
    transport,
    messages: [],
    onError: (err: Error) => {
      console.error('[studio-chat] error:', err?.name);
    },
    onFinish: ({
      message,
      isAbort,
      isError,
    }: {
      message: UIMessage;
      isAbort: boolean;
      isError: boolean;
    }) => {
      if (isAbort || isError || clearingRef.current) return;
      const metadata = message.metadata as ChatMessageMetadata | undefined;

      if (metadata?.drafts?.length) {
        const applyMode: DraftApplyMode = metadata.applyMode ?? 'file';
        setPendingDrafts({
          items: metadata.drafts,
          source: 'chat',
          applyMode,
          context: {
            kind: contextRef.current?.activity?.kind as 'lesson' | 'quiz' | 'practice' | undefined,
            path: contextRef.current?.activity?.path,
          },
        });
      }

      if (metadata?.courseDraft?.success) {
        setLastCourseQuality(metadata.courseDraft.quality);
      }
    },
  });

  const rawMessagesRef = useRef(rawMessages);
  rawMessagesRef.current = rawMessages;

  // Apply persisted history once. Never clobber messages the user already sent
  // while hydration was still pending.
  const appliedHydrationRef = useRef(false);
  useEffect(() => {
    if (hydrationPending) return;
    if (appliedHydrationRef.current) return;
    appliedHydrationRef.current = true;
    if (initialMessages.length > 0 && rawMessagesRef.current.length === 0) {
      chatSetMessages(initialMessages);
    }
  }, [hydrationPending, initialMessages, chatSetMessages]);

  // Persist the thread once a turn settles. ConversationStore write generations
  // drop/supersede saves that race with New conversation clears.
  useEffect(() => {
    if (clearingRef.current) return;
    if (hydrationPending) return;
    if (rawMessages.length === 0) return;
    if (chatStatus === 'submitted' || chatStatus === 'streaming') return;
    void store.saveMessages(courseKey, rawMessages.map(toStoredMessage));
  }, [rawMessages.length, chatStatus, courseKey, store, hydrationPending]);

  const status: 'idle' | 'loading' | 'error' =
    chatStatus === 'error'
      ? 'error'
      : chatStatus === 'submitted' || chatStatus === 'streaming' || hydrationPending
        ? 'loading'
        : 'idle';

  const clearMessages = useCallback(() => {
    if (clearingRef.current) return;
    clearingRef.current = true;
    chatStop();
    chatSetMessages([]);
    void (async () => {
      await store.clearMessages(courseKey);
      const newId = createConversationId();
      setConversationId(courseKey, newId);
      setConversationIdState(newId);
    })();
  }, [chatSetMessages, chatStop, courseKey, setConversationIdState, store]);

  const sendMessage = useCallback(
    (content: string) => {
      if (clearingRef.current || hydrationPendingRef.current) return;
      if (!contextRef.current) {
        onError?.(t('studio.assistant.error.request'));
        return;
      }
      setEphemeralSuggestions(null);
      void chatSend({ text: content });
    },
    [chatSend, onError, setEphemeralSuggestions, t],
  );

  const stop = useCallback(() => chatStop(), [chatStop]);

  const regenerate = useCallback(() => {
    if (clearingRef.current || hydrationPendingRef.current) return;
    void chatRegenerate();
  }, [chatRegenerate]);

  const clearError = useCallback(() => chatClearError(), [chatClearError]);

  const appendAssistantNote = useCallback(
    (content: string) => {
      if (clearingRef.current) return;
      const note: StoredChatMessage = {
        id: `assistant-note-${Date.now()}`,
        role: 'assistant',
        content,
        createdAt: Date.now(),
      };
      const current = rawMessagesRef.current;
      chatSetMessages([...current, toUIMessage(note)]);
    },
    [chatSetMessages],
  );

  const ingestCourseDraft = useCallback(
    (userContent: string, courseDraft: CourseDraftResult, readyMessage: string) => {
      if (clearingRef.current) return;
      const userMsg: StoredChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userContent,
        createdAt: Date.now(),
      };
      const assistantMsg: StoredChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: courseDraft.success
          ? readyMessage
          : t('studio.assistant.chat.courseDraftFailed', {
              error: courseDraft.error || t('studio.assistant.courseDraft.unknownError'),
            }),
        metadata: courseDraft.success ? { mode: 'course_draft', courseDraft } : undefined,
        createdAt: Date.now(),
      };
      const current = rawMessagesRef.current;
      chatSetMessages([...current, toUIMessage(userMsg), toUIMessage(assistantMsg)]);
      if (courseDraft.success) {
        setLastCourseQuality(courseDraft.quality);
      }
    },
    [chatSetMessages, setLastCourseQuality, t],
  );

  const runIntent = useCallback(
    async (
      kind: 'lesson' | 'quiz' | 'practice',
      intent: ItemIntent,
      currentContent: string,
      params?: ItemIntentParams,
    ) => {
      if (!api || clearingRef.current) return;
      try {
        const result = await api.generateItemEdit(kind, intent, currentContent, params);
        if (result.ok) {
          const applyMode: DraftApplyMode = result.items.length > 1 ? 'file' : 'buffer';
          const assistantMsg: StoredChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: t('studio.assistant.draft.previewLabel'),
            metadata: { mode: 'draft', drafts: result.items, applyMode },
            createdAt: Date.now(),
          };
          const current = rawMessagesRef.current;
          chatSetMessages([...current, toUIMessage(assistantMsg)]);
          setPendingDrafts({
            items: result.items,
            source: 'intent',
            applyMode,
            context: { kind, path: contextRef.current?.activity?.path },
          });
        }
      } catch {
        onError?.(t('studio.assistant.intent.error'));
      }
    },
    [api, chatSetMessages, onError, setPendingDrafts, t],
  );

  const messages: ChatMessage[] = rawMessages.map(toChatMessage);

  return (
    <StudioChatContext.Provider
      value={{
        messages,
        sendMessage,
        status,
        stop,
        regenerate,
        clearError,
        clearMessages,
        appendAssistantNote,
        ingestCourseDraft,
        runIntent,
        api: api ?? null,
        onOpenPath,
        onError,
        onOutlineChanged,
        onCapabilityGaps,
      }}
    >
      {children}
    </StudioChatContext.Provider>
  );
}

export function useStudioChat() {
  const ctx = useContext(StudioChatContext);
  if (!ctx) throw new Error('useStudioChat must be used within a StudioChatProvider');
  return ctx;
}

/** Extract plain text from a UIMessage (v7 parts style) with content fallback. */
function extractText(msg: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
}): string {
  if (msg.parts?.length) {
    return msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  return msg.content ?? '';
}

function toStoredMessage(msg: UIMessage): StoredChatMessage {
  return {
    id: msg.id,
    role: (msg.role as 'user' | 'assistant') || 'user',
    content: extractText(msg),
    metadata: (msg.metadata as StoredChatMessage['metadata']) || undefined,
    createdAt: Date.now(),
  };
}

function toChatMessage(msg: UIMessage): ChatMessage {
  return {
    id: msg.id,
    role: (msg.role as 'user' | 'assistant') || 'user',
    content: extractText(msg),
    metadata: (msg.metadata as ChatMessageMetadata) || undefined,
  };
}
