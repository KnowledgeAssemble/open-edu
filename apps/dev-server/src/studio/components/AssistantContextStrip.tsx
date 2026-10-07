import { useTranslation } from '@open-edu/i18n';
import { useStudioAssistant, resolveSuggestions } from '../ai';
import type { SuggestionChip } from '../ai/suggestions';

interface SuggestionChipProps {
  chip: SuggestionChip;
  onSend: (message: string) => void;
}

function SuggestionChipItem({ chip, onSend }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSend(chip.action.message)}
      className="border-outline-variant bg-surface text-on-surface-variant hover:border-primary hover:text-primary whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors"
    >
      {chip.label}
    </button>
  );
}

function contextLabel(
  view: string,
  t: (key: string, options?: Record<string, string>) => string,
  activityTitle?: string,
  activityCount?: number,
): string {
  switch (view) {
    case 'home':
      return t('studio.assistant.context.home');
    case 'outline':
      return t('studio.assistant.context.outline', { count: String(activityCount ?? '') });
    case 'edit-activity':
      return t('studio.assistant.context.editing', { title: activityTitle ?? '' });
    case 'preview':
      return t('studio.assistant.context.preview');
    case 'share':
      return t('studio.assistant.context.share');
    case 'library':
      return t('studio.assistant.context.library');
    case 'unit-builder':
      return t('studio.assistant.context.unitBuilder');
    default:
      return t('studio.assistant.context.home');
  }
}

export function AssistantContextStrip({ onSend }: { onSend: (msg: string) => void }) {
  const { t } = useTranslation();
  const { context, ephemeralSuggestions, setEphemeralSuggestions } = useStudioAssistant();

  if (!context) return null;

  const suggestions =
    ephemeralSuggestions && ephemeralSuggestions.length > 0
      ? ephemeralSuggestions
      : resolveSuggestions(context, t);

  const handleSend = (message: string) => {
    if (ephemeralSuggestions?.length) {
      setEphemeralSuggestions(null);
    }
    onSend(message);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2">
        {suggestions.map((chip) => (
          <SuggestionChipItem key={chip.id} chip={chip} onSend={handleSend} />
        ))}
      </div>

      <div className="text-on-surface-variant text-[10px] font-medium uppercase tracking-wider">
        {contextLabel(context.view, t, context.activity?.title, context.course?.activityCount)}
      </div>
    </div>
  );
}
