import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@open-edu/design-system';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@open-edu/i18n';
import { ItemDraftPreview } from './ItemDraftPreview.js';
import type { AuthoringContext } from '@open-edu/packs';
import type { StudioApi, StudioApiError } from '../studioApi.js';
import type { DraftItem } from '../ai/types.js';

type ItemKind = DraftItem['kind'];
type Status = 'checking' | 'available' | 'unavailable';

const MIN_DESCRIPTION_LENGTH = 20;

export function AiAddDialog({
  api,
  authoring = null,
  open,
  onOpenChange,
  onAccept,
  onError,
}: {
  api: StudioApi;
  authoring?: AuthoringContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (item: DraftItem) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ItemKind>('lesson');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('checking');
    setInlineError(null);
    api
      .getAiStatus()
      .then(({ available }) => {
        if (!cancelled) setStatus(available ? 'available' : 'unavailable');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [api, open]);

  const handleKindChange = (next: string) => {
    setKind(next as ItemKind);
    setDraft(null);
    setInlineError(null);
  };

  const handleGenerate = async () => {
    if (description.trim().length < MIN_DESCRIPTION_LENGTH || generating) return;
    setGenerating(true);
    setInlineError(null);
    try {
      const result = await api.generateItemAdd(
        kind,
        description.trim(),
        authoring ? { authoring } : undefined,
      );
      if (result.ok) {
        setDraft(result.item);
      } else {
        setInlineError(t('studio.ai.item.retryFailed'));
      }
    } catch (err) {
      const error = err as StudioApiError;
      if (error.code === 'no-active-package') {
        onError(t('studio.ai.noActivePackage'));
      } else if (error.code === 'ai-unavailable') {
        setInlineError(t('studio.ai.unavailable'));
      } else {
        setInlineError(error instanceof Error ? error.message : t('studio.ai.item.error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    if (draft) {
      onAccept(draft);
      setDraft(null);
      onOpenChange(false);
    }
  };

  const handleReject = () => {
    setDraft(null);
    setInlineError(null);
    onOpenChange(false);
  };

  const unavailable = status === 'unavailable';
  const tooShort =
    description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION_LENGTH;
  const canGenerate =
    status === 'available' && description.trim().length >= MIN_DESCRIPTION_LENGTH && !generating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('studio.ai.item.addTitle')}</DialogTitle>
          <DialogDescription>{t('studio.ai.item.addDescription')}</DialogDescription>
        </DialogHeader>
        {unavailable ? (
          <p className="text-on-surface-variant text-sm">{t('studio.ai.unavailable')}</p>
        ) : (
          <div className="space-y-4">
            <Tabs value={kind} onValueChange={handleKindChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="lesson">{t('studio.ai.item.kind.lesson')}</TabsTrigger>
                <TabsTrigger value="quiz">{t('studio.ai.item.kind.quiz')}</TabsTrigger>
                <TabsTrigger value="practice">{t('studio.ai.item.kind.practice')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <label className="text-on-surface block text-sm font-medium">
              {t('studio.ai.item.description')}
              <Textarea
                className="text-on-surface mt-2"
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraft(null);
                }}
                aria-label={t('studio.ai.item.description')}
              />
            </label>
            {tooShort ? (
              <p className="text-error text-sm">{t('studio.ai.item.descriptionShort')}</p>
            ) : null}
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
              >
                <Sparkles className="mr-1 size-4" aria-hidden="true" />
                {generating ? t('studio.ai.item.generating') : t('studio.ai.item.generate')}
              </Button>
            </div>
            {inlineError ? (
              <p className="text-error text-sm" role="alert">
                {inlineError}
              </p>
            ) : null}
            {draft ? <ItemDraftPreview item={draft} /> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleReject} disabled={generating}>
            {t('studio.ai.item.reject')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAccept}
            disabled={!draft || generating}
          >
            {t('studio.ai.item.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
