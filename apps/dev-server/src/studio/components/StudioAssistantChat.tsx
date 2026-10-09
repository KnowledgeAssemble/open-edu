import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Square, RotateCcw, Paperclip } from 'lucide-react';
import { ThinkingIndicator } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { useStudioAssistant, useStudioChat } from '../ai';
import { applyDraft, applyDraftBatch } from '../ai/applyDraft';
import { resolvePostCommitSuggestions } from '../ai/suggestions';
import { resolveSpecExtension, SPEC_FILE_ACCEPT } from '../ai/specFile';
import { StudioAssistantMessage } from './StudioAssistantMessage';
import { AssistantIntentRow } from './AssistantIntentRow';
import { useEditorBridge } from '../ai/EditorBridgeContext';
import type { DraftApplyMode, SpecAttachPreset } from '../ai/StudioAssistantProvider';
import type { DraftItem, ItemIntent, ItemIntentParams } from '../ai/types';

export function StudioAssistantChat() {
  const { t } = useTranslation();
  const {
    context,
    pendingDrafts,
    setPendingDrafts,
    setEphemeralSuggestions,
    setLastCourseQuality,
  } = useStudioAssistant();
  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    clearError,
    runIntent,
    appendAssistantNote,
    ingestCourseDraft,
    api,
    onOpenPath,
    onError,
    onOutlineChanged,
    onCapabilityGaps,
  } = useStudioChat();
  const { currentEditor } = useEditorBridge();
  const [input, setInput] = useState('');
  const [intentRunning, setIntentRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [courseDraftAccepting, setCourseDraftAccepting] = useState(false);
  const [attachingSpec, setAttachingSpec] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const preset = e.detail;
      if (!preset.message) return;
      if (preset.prefill) {
        setInput(preset.message);
        inputRef.current?.focus();
        return;
      }
      sendMessage(preset.message);
    };
    window.addEventListener('studio:assistant:preset', handler as EventListener);
    return () => window.removeEventListener('studio:assistant:preset', handler as EventListener);
  }, [sendMessage]);

  const uploadSpecFile = useCallback(
    async (spec: SpecAttachPreset) => {
      if (!api || attachingSpec) return;
      clearError();
      setAttachingSpec(true);
      try {
        const result = await api.uploadSpecDraft(spec.content, spec.ext);
        ingestCourseDraft(
          t('studio.assistant.chat.specAttached', { name: spec.name }),
          result,
          t('studio.assistant.chat.courseDraftReadySpec', { name: spec.name }),
        );
      } catch (err) {
        onError?.(err instanceof Error ? err.message : t('studio.ai.uploadError'));
      } finally {
        setAttachingSpec(false);
      }
    },
    [api, attachingSpec, clearError, ingestCourseDraft, onError, t],
  );

  const uploadSpecFileRef = useRef(uploadSpecFile);
  uploadSpecFileRef.current = uploadSpecFile;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SpecAttachPreset>).detail;
      if (!detail?.content || !detail.ext) return;
      void uploadSpecFileRef.current(detail);
    };
    window.addEventListener('studio:assistant:spec', handler);
    return () => window.removeEventListener('studio:assistant:spec', handler);
  }, []);

  const aiAvailable = context?.aiAvailable !== false;

  const handleSend = () => {
    if (!input.trim() || !aiAvailable) return;
    clearError();
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSpecFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = resolveSpecExtension(file.name);
    if (!ext) {
      onError?.(t('studio.ai.specInvalid'));
      return;
    }
    const content = await file.text();
    await uploadSpecFile({ name: file.name, content, ext });
  };

  const resolveApplyMode = (_item: DraftItem, siblings: DraftItem[]): DraftApplyMode => {
    if (pendingDrafts?.applyMode) return pendingDrafts.applyMode;
    if (siblings.length > 1) return 'file';
    if (currentEditor && context?.view === 'edit-activity') return 'buffer';
    return 'file';
  };

  const handleUseDraft = async (item: DraftItem, siblings: DraftItem[] = [item]) => {
    if (!api || applying) return;
    setApplying(true);
    try {
      const mode = resolveApplyMode(item, siblings);

      if (mode === 'buffer' && currentEditor) {
        await applyDraft(api, item, {
          mode: 'buffer',
          applyToEditor: currentEditor.applyToEditor,
        });
        appendAssistantNote(t('studio.assistant.draft.appliedEditor'));
      } else if (siblings.length > 1 && mode === 'file') {
        await applyDraftBatch(api, siblings);
        appendAssistantNote(t('studio.assistant.draft.appliedOutline'));
        onOutlineChanged?.();
      } else {
        await applyDraft(api, item, { mode: 'file' });
        appendAssistantNote(t('studio.assistant.draft.appliedOutline'));
        onOutlineChanged?.();
      }

      setPendingDrafts(null);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setApplying(false);
    }
  };

  const handleUseAll = async (items: DraftItem[]) => {
    if (items.length <= 1) {
      await handleUseDraft(items[0]!, items);
      return;
    }
    await handleUseDraft(items[0]!, items);
  };

  const handleDiscardDraft = (_item: DraftItem) => {
    setPendingDrafts(null);
  };

  const handleOpenDraft = async (item: DraftItem) => {
    if (!api || !onOpenPath) return;
    try {
      const { path } = await applyDraft(api, item, { mode: 'file' });
      if (path) {
        setPendingDrafts(null);
        appendAssistantNote(t('studio.assistant.draft.appliedOutline'));
        onOpenPath(path);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('studio.errors.generic'));
    }
  };

  const handleAcceptCourseDraft = async (force: boolean) => {
    if (!api || courseDraftAccepting) return;
    setCourseDraftAccepting(true);
    try {
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.metadata?.courseDraft);
      const courseDraft = lastAssistantMsg?.metadata?.courseDraft;
      if (!courseDraft || !courseDraft.draftId) {
        appendAssistantNote(
          t('studio.assistant.courseDraft.failed', {
            error: t('studio.assistant.courseDraft.noDraft'),
          }),
        );
        return;
      }
      const result = await api.commitCourseDraft(courseDraft.draftId, force);
      if (result.success) {
        appendAssistantNote(t('studio.assistant.courseDraft.accepted'));
        setLastCourseQuality(courseDraft.quality);
        setEphemeralSuggestions(resolvePostCommitSuggestions(t, courseDraft.quality));
        onOutlineChanged?.();
        onCapabilityGaps?.(result.capabilityGaps ?? []);
      } else {
        appendAssistantNote(
          t('studio.assistant.courseDraft.failed', {
            error: result.error || t('studio.assistant.courseDraft.unknownError'),
          }),
        );
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setCourseDraftAccepting(false);
    }
  };

  const handleSelectNextStep = (step: string) => {
    // Action chips map to draft/course card controls; other chips continue the chat.
    if (step === t('studio.assistant.next.applyDraft')) {
      const lastDraftMsg = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.metadata?.drafts?.length);
      const drafts = lastDraftMsg?.metadata?.drafts;
      if (drafts?.length) {
        void handleUseAll(drafts);
        return;
      }
    }
    if (step === t('studio.assistant.next.acceptDraft')) {
      const hasContent = (context?.course?.activityCount ?? 0) > 0;
      if (hasContent) {
        // Overwrite confirmation lives on the course draft card — do not force.
        appendAssistantNote(t('studio.assistant.courseDraft.overwriteLede'));
        return;
      }
      void handleAcceptCourseDraft(false);
      return;
    }
    sendMessage(step);
  };

  const handleDiscardCourseDraft = async () => {
    const lastAssistantMsg = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.metadata?.courseDraft);
    const courseDraft = lastAssistantMsg?.metadata?.courseDraft;
    if (api && courseDraft?.draftId) {
      try {
        await api.discardCourseDraft(courseDraft.draftId);
      } catch {
        // TTL cleanup still applies if discard endpoint fails
      }
    }
    setEphemeralSuggestions(null);
    appendAssistantNote(t('studio.assistant.courseDraft.discarded'));
  };

  const handleIntent = async (intent: ItemIntent, params?: ItemIntentParams) => {
    if (!currentEditor || intentRunning) return;
    if (
      currentEditor.kind !== 'lesson' &&
      currentEditor.kind !== 'quiz' &&
      currentEditor.kind !== 'practice'
    ) {
      return;
    }
    setIntentRunning(true);
    try {
      await runIntent(currentEditor.kind, intent, currentEditor.getCurrentContent(), params);
    } finally {
      setIntentRunning(false);
    }
  };

  if (context && !context.aiAvailable) {
    return (
      <div className="text-on-surface-variant flex h-full items-center justify-center p-6 text-center text-sm">
        {t('studio.assistant.unavailable')}
      </div>
    );
  }

  const isEditing = context?.view === 'edit-activity' && currentEditor;
  const editKind =
    isEditing &&
    (currentEditor!.kind === 'lesson' ||
      currentEditor!.kind === 'quiz' ||
      currentEditor!.kind === 'practice')
      ? currentEditor!.kind
      : null;

  const busy = status === 'loading' || attachingSpec;
  const working = busy || intentRunning || applying || courseDraftAccepting;
  const workingLabel = attachingSpec
    ? t('studio.assistant.attachingSpec')
    : intentRunning
      ? t('studio.assistant.intent.running')
      : applying || courseDraftAccepting
        ? t('studio.assistant.draft.applying')
        : t('studio.assistant.thinking');

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-on-surface-variant py-10 text-center text-sm">
            {t('studio.assistant.placeholder')}
          </div>
        ) : (
          messages.map((m) => (
            <StudioAssistantMessage
              key={m.id}
              role={m.role}
              content={m.content}
              metadata={m.metadata}
              onUseDraft={(item, siblings) => void handleUseDraft(item, siblings)}
              onUseAll={(items) => void handleUseAll(items)}
              onDiscardDraft={handleDiscardDraft}
              onOpenDraft={
                (m.metadata?.applyMode ?? pendingDrafts?.applyMode) === 'file' ||
                (m.metadata?.drafts && m.metadata.drafts.length > 0 && !currentEditor)
                  ? (item) => void handleOpenDraft(item)
                  : undefined
              }
              onAcceptCourseDraft={(force) => void handleAcceptCourseDraft(force)}
              onDiscardCourseDraft={() => void handleDiscardCourseDraft()}
              onSelectNextStep={handleSelectNextStep}
              isDirty={currentEditor?.isDirty()}
              applying={applying}
              courseDraftAccepting={courseDraftAccepting}
              packageHasContent={(context?.course?.activityCount ?? 0) > 0}
            />
          ))
        )}
        {working && <ThinkingIndicator label={workingLabel} />}
        {status === 'error' && (
          <div className="mx-auto text-center">
            <p className="text-error mb-2 text-xs">{t('studio.assistant.error.request')}</p>
            <button
              type="button"
              onClick={clearError}
              className="text-primary hover:text-primary-container text-xs underline"
            >
              {t('studio.assistant.chat.retry')}
            </button>
          </div>
        )}
      </div>

      {isEditing && editKind ? (
        <AssistantIntentRow
          kind={editKind}
          onRunIntent={handleIntent}
          running={intentRunning || busy || applying}
        />
      ) : null}

      <div className="border-outline-variant bg-surface border-t p-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('studio.assistant.placeholder')}
            aria-label={t('studio.assistant.placeholder')}
            className="border-outline-variant bg-surface-container focus:ring-primary text-on-surface w-full resize-none rounded-md border p-2 pr-20 text-sm focus:outline-none focus:ring-1"
            rows={3}
            disabled={busy || !aiAvailable}
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept={SPEC_FILE_ACCEPT}
              className="hidden"
              aria-label={t('studio.assistant.attachSpec')}
              onChange={(e) => void handleSpecFileChange(e)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-on-surface-variant hover:text-on-surface p-1"
              disabled={busy || !aiAvailable || !api}
              aria-label={t('studio.assistant.attachSpec')}
            >
              <Paperclip className="size-4" />
            </button>
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="text-on-surface-variant hover:text-on-surface p-1"
                aria-label={t('studio.assistant.chat.stop')}
                disabled={attachingSpec}
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                className="text-primary hover:text-primary-container p-1 transition-colors"
                disabled={!input.trim() || !aiAvailable}
                aria-label={t('studio.assistant.chat.send')}
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
        {messages.length > 0 && status === 'idle' && !attachingSpec && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={regenerate}
              className="text-on-surface-variant hover:text-on-surface flex items-center gap-1 text-[10px]"
            >
              <RotateCcw className="size-3" />
              {t('studio.assistant.regenerate')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
