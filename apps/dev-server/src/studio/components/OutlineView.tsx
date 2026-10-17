import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Skeleton,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@open-edu/design-system';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@open-edu/i18n';
import { createEmptyExercise, serializeExerciseNode } from '../widgets/exerciseNode.js';
import type { CuratedWidget } from '../widgets/curatedCatalog.js';
import { WidgetPicker } from './WidgetPicker.js';
import { AiAddDialog } from './AiAddDialog.js';
import { FlowAdvancedPanel } from './FlowAdvancedPanel.js';
import { RewardsCardsPanel } from './RewardsCardsPanel.js';
import { AddActivityMenu } from './AddActivityMenu.js';
import { OutlineActivityRow } from './OutlineActivityRow.js';
import { OutlineHealthStrip } from './OutlineHealthStrip.js';
import { buildReadyCheck, isReadyToExport } from '../readyCheck.js';
import { useStudioAssistant } from '../ai';
import type { ActivitySummary } from '../types.js';
import { refreshProvenanceAfterApply } from '../ai/provenanceRefresh.js';
import type { DraftItem } from '../ai/types.js';
import type { AuthoringContext } from '@open-edu/packs';
import type { StudioApi } from '../studioApi.js';

function newLessonContent(): string {
  return '# New lesson\n\nStart writing here...\n';
}

function newQuizContent(): string {
  return JSON.stringify(
    {
      type: 'quiz',
      question: 'New question',
      options: [
        { id: 'a', text: 'First answer', correct: true },
        { id: 'b', text: 'Second answer', correct: false },
      ],
    },
    null,
    2,
  );
}

export function OutlineView({
  api,
  authoring = null,
  onEdit,
  onError,
  onTitleChange,
  onShare,
}: {
  api: StudioApi;
  authoring?: AuthoringContext | null;
  onEdit: (path: string) => void;
  onError: (message: string) => void;
  onTitleChange?: (title: string) => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const { openWithPreset, enabled: assistantEnabled } = useStudioAssistant();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivitySummary | null>(null);
  const [settledPath, setSettledPath] = useState<string | null>(null);
  const [settleKey, setSettleKey] = useState(0);
  const [title, setTitle] = useState('');
  const [health, setHealth] = useState<{ count: number; ready: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const outline = await api.getOutline();
      setActivities(outline.activities);
      setTitle(outline.title);
      onTitleChange?.(outline.title);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [api, onError, onTitleChange, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || activities.length === 0) {
      setHealth(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const outline = await api.getOutline();
        const validation = await api.validate();
        const files = new Map<string, string>();
        for (const activity of outline.activities) {
          try {
            const file = await api.readFile(activity.path);
            files.set(activity.path, file.content);
          } catch {
            // unreadable node counts as missing content
          }
        }
        if (cancelled) return;
        const items = buildReadyCheck({
          title: outline.title,
          files,
          validationErrors: validation.errors,
        });
        setHealth({ count: outline.activities.length, ready: isReadyToExport(items) });
      } catch {
        if (!cancelled) setHealth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activities, api, loading]);

  const persistOrder = async (next: ActivitySummary[]) => {
    setSaving(true);
    try {
      await api.saveOutlineOrder(next.map((a) => a.path));
      setActivities(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...activities];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setSettledPath(item!.path);
    setSettleKey((key) => key + 1);
    void persistOrder(next);
  };

  useEffect(() => {
    if (!settledPath) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-row-menu="${settledPath}"]`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [settledPath, settleKey]);

  const addActivity = async (kind: 'lesson' | 'quiz') => {
    const stamp = Date.now();
    const path = kind === 'lesson' ? `nodes/lesson-${stamp}.md` : `nodes/quiz-${stamp}.json`;
    const content = kind === 'lesson' ? newLessonContent() : newQuizContent();
    try {
      await api.writeFile(path, content);
      const next = [
        ...activities,
        {
          id: path,
          path,
          title:
            kind === 'lesson'
              ? t('studio.outline.newLessonTitle')
              : t('studio.outline.newQuizTitle'),
          kind,
        },
      ];
      await persistOrder(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    }
  };

  const addPractice = async (widget: CuratedWidget) => {
    const stamp = Date.now();
    const path = `nodes/practice-${stamp}.json`;
    const content = serializeExerciseNode(
      createEmptyExercise(widget.id, t('studio.outline.newPracticeTitle')),
    );
    try {
      await api.writeFile(path, content);
      const next: ActivitySummary[] = [
        ...activities,
        { id: path, path, title: widget.name, kind: 'practice' },
      ];
      await persistOrder(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    }
  };

  const addAiDraft = async (item: DraftItem) => {
    const stamp = Date.now();
    const ext = item.kind === 'lesson' ? '.md' : '.json';
    const path = `nodes/${item.kind}-${stamp}${ext}`;
    try {
      await api.writeFile(path, item.content);
      void refreshProvenanceAfterApply(
        api,
        [{ path, title: item.title, content: item.content }],
        authoring ?? null,
      );
      const next: ActivitySummary[] = [
        ...activities,
        { id: path, path, title: item.title, kind: item.kind },
      ];
      await persistOrder(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    }
  };

  const removeActivity = async (activity: ActivitySummary) => {
    setSaving(true);
    try {
      await api.deleteFile(activity.path);
      const remaining = activities.filter((a) => a.id !== activity.id);
      await api.saveOutlineOrder(remaining.map((a) => a.path));
      setActivities(remaining);
      setDeleteTarget(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div
        className="mx-auto max-w-3xl space-y-6 p-6"
        aria-busy
        aria-label={t('studio.outline.loading')}
      >
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 lg:w-64">
        <h2 className="text-h3 text-on-surface">{title}</h2>
        {health ? (
          <OutlineHealthStrip
            count={health.count}
            ready={health.ready}
            onShare={() => onShare?.()}
          />
        ) : null}
        <p className="text-on-surface-variant text-sm">{t('studio.outline.dragHint')}</p>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="bg-surface sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1 text-on-surface">{t('studio.outline.title')}</h1>
          <AddActivityMenu
            onAddLesson={() => void addActivity('lesson')}
            onAddQuiz={() => void addActivity('quiz')}
            onAddPractice={() => setPickerOpen(true)}
            onAddAi={() => {
              if (assistantEnabled) {
                openWithPreset({
                  message: t('studio.assistant.preset.addActivity'),
                });
              } else {
                setAiDialogOpen(true);
              }
            }}
          />
        </div>

        {activities.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              heading={t('studio.outline.empty')}
              description={t('studio.outline.emptyDescription')}
            />
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (assistantEnabled) {
                    openWithPreset({
                      message: t('studio.assistant.preset.addFirstActivity'),
                    });
                  } else {
                    setAiDialogOpen(true);
                  }
                }}
              >
                <Sparkles className="mr-1 size-4" aria-hidden="true" />
                {t('studio.assistant.suggest.add_with_ai')}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="border-outline-variant bg-surface divide-outline-variant divide-y rounded-lg border">
            {activities.map((activity, index) => (
              <OutlineActivityRow
                key={
                  activity.path === settledPath ? `${activity.id}-settle-${settleKey}` : activity.id
                }
                activity={activity}
                index={index}
                total={activities.length}
                saving={saving}
                settling={activity.path === settledPath}
                onEdit={onEdit}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onDelete={() => setDeleteTarget(activity)}
              />
            ))}
          </ul>
        )}
        <div className="border-outline-variant rounded-lg border px-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="flow">
              <AccordionTrigger>{t('studio.flow.title')}</AccordionTrigger>
              <AccordionContent>
                <FlowAdvancedPanel api={api} onError={onError} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rewards">
              <AccordionTrigger>{t('studio.rewards.title')}</AccordionTrigger>
              <AccordionContent>
                <RewardsCardsPanel api={api} onError={onError} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <WidgetPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(widget) => void addPractice(widget)}
        />
        {!assistantEnabled ? (
          <AiAddDialog
            api={api}
            authoring={authoring}
            open={aiDialogOpen}
            onOpenChange={setAiDialogOpen}
            onAccept={(item) => void addAiDraft(item)}
            onError={onError}
          />
        ) : null}

        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('studio.outline.deleteConfirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('studio.outline.deleteConfirmLede', { title: deleteTarget?.title ?? '' })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                {t('studio.outline.deleteCancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteTarget && void removeActivity(deleteTarget)}
                disabled={saving}
              >
                {t('studio.outline.deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
