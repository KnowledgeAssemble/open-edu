import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@open-edu/design-system';
import { Check, X, ExternalLink } from 'lucide-react';
import { useTranslation } from '@open-edu/i18n';
import { ItemDraftPreview } from './ItemDraftPreview';
import type { DraftItem } from '../ai/types';

export function AssistantDraftCard({
  item,
  index,
  total,
  onUse,
  onDiscard,
  onOpen,
  isDirty,
  disabled,
}: {
  item: DraftItem;
  index: number;
  total: number;
  onUse: (item: DraftItem) => void;
  onDiscard: (item: DraftItem) => void;
  onOpen?: (item: DraftItem) => void;
  isDirty?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUse = () => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      onUse(item);
    }
  };

  return (
    <div className="border-outline-variant bg-surface rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-on-surface text-xs font-medium uppercase tracking-wider">
          {item.kind}
          {total > 1 ? ` ${index + 1}/${total}` : ''}
        </span>
        <span className="text-on-surface-variant truncate text-xs">{item.title}</span>
      </div>

      <div className="max-h-48 overflow-y-auto rounded">
        <ItemDraftPreview item={item} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={handleUse}
          disabled={disabled}
        >
          <Check className="mr-1 size-3" aria-hidden="true" />
          {t('studio.assistant.draft.use')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDiscard(item)}
          disabled={disabled}
          aria-label={t('studio.assistant.draft.discard')}
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
        {onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpen(item)}
            disabled={disabled}
            aria-label={t('studio.assistant.draft.openInEditor')}
          >
            <ExternalLink className="size-3" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('studio.assistant.draft.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('studio.assistant.draft.confirmLede')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              {t('studio.assistant.draft.confirmCancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setShowConfirm(false);
                onUse(item);
              }}
            >
              {t('studio.assistant.draft.confirmApply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
