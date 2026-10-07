import { useMemo } from 'react';
import { useTranslation } from '@open-edu/i18n';
import { SchemaForm } from './SchemaForm';
import { X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { ValidationError } from './WidgetValidator';
import { listConfiguredRegistryIds } from '../studio/widgets/curatedCatalog';

type NodeType = 'lesson' | 'quiz' | 'reflection' | 'exercise' | 'custom';

interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

interface ContentNodeData {
  type: NodeType;
  title?: string;
  skills?: string[];
  question?: string;
  options?: QuizOption[];
  prompt?: string;
  widget?: string;
  version?: string;
  config?: Record<string, unknown>;
  remoteWidget?: Record<string, unknown>;
  widgetRef?: Record<string, unknown>;
}

interface JSONNodeEditorProps {
  data: ContentNodeData;
  onChange: (data: ContentNodeData) => void;
  fileName: string;
  fieldErrors?: Record<string, ValidationError[]>;
}

export function JSONNodeEditor({
  data,
  onChange,
  fileName,
  fieldErrors = {},
}: JSONNodeEditorProps) {
  const { t } = useTranslation();

  const commonFieldLabels = useMemo<Record<string, string>>(
    () => ({
      type: t('studio.editor.node.nodeType'),
      title: t('studio.editor.node.title'),
      skills: t('studio.editor.node.skills'),
    }),
    [t],
  );

  const commonPlaceholders = useMemo<Record<string, string>>(
    () => ({
      title: t('studio.editor.node.titlePlaceholder'),
    }),
    [t],
  );

  const typeDescriptions = useMemo<Record<NodeType, string>>(
    () => ({
      lesson: t('studio.editor.node.typeDescription.lesson'),
      quiz: t('studio.editor.node.typeDescription.quiz'),
      reflection: t('studio.editor.node.typeDescription.reflection'),
      exercise: t('studio.editor.node.typeDescription.exercise'),
      custom: t('studio.editor.node.typeDescription.custom'),
    }),
    [t],
  );

  const registryWarning = useMemo(() => {
    if (data.type !== 'custom') return null;
    if (data.widgetRef?.source !== 'registry') return null;
    const registryId = data.widgetRef?.registryId;
    if (typeof registryId !== 'string' || !registryId) return null;
    if (listConfiguredRegistryIds().includes(registryId)) return null;
    return registryId;
  }, [data]);

  const formContent = useMemo(() => {
    const base: Record<string, unknown> = {
      type: data.type,
      ...(data.title ? { title: data.title } : {}),
      ...(data.skills ? { skills: data.skills } : {}),
    };

    if (data.type === 'quiz') {
      return {
        ...base,
        question: data.question ?? '',
        options: data.options ?? [{ id: 'a', text: '', correct: false }],
      };
    }

    if (data.type === 'reflection') {
      return {
        ...base,
        prompt: data.prompt ?? '',
      };
    }

    if (data.type === 'exercise') {
      return {
        ...base,
        widget: data.widget ?? '',
        config: data.config ?? {},
      };
    }

    if (data.type === 'custom') {
      return {
        ...base,
        widget: data.widget ?? '',
        version: data.version ?? '',
        config: data.config ?? {},
        remoteWidget: data.remoteWidget ?? {},
        widgetRef: data.widgetRef ?? {},
      };
    }

    return base;
  }, [data]);

  const handleFormChange = (updated: Record<string, unknown>) => {
    onChange(updated as unknown as ContentNodeData);
  };

  const fields = useMemo(() => {
    const base = ['type', 'title', 'skills'];
    switch (data.type) {
      case 'quiz':
        return [...base, 'question', 'options'];
      case 'reflection':
        return [...base, 'prompt'];
      case 'exercise':
        return [...base, 'widget', 'config'];
      case 'custom':
        return [...base, 'widget', 'version', 'config', 'widgetRef', 'remoteWidget'];
      default:
        return base;
    }
  }, [data.type]);

  return (
    <div className="space-y-4">
      <div className="border-tertiary-container bg-tertiary-container text-tertiary rounded-lg border px-3 py-2 text-xs">
        <span className="font-medium">{typeDescriptions[data.type]}</span>
        {' — '}
        {typeDescriptions[data.type] ?? t('studio.editor.node.editFallback')}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-on-surface-variant text-xs font-medium">
          {t('studio.editor.node.typeLabel')}
        </label>
        <Select
          value={data.type}
          onValueChange={(value) => onChange({ ...data, type: value as NodeType })}
        >
          <SelectTrigger className="border-outline-variant focus:border-primary focus:ring-primary rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lesson">Lesson</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="reflection">Reflection</SelectItem>
            <SelectItem value="exercise">Exercise</SelectItem>
            <SelectItem value="custom">Custom Widget</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-on-surface-variant text-xs">{fileName}</span>
      </div>

      <SchemaForm
        data={formContent as Record<string, unknown>}
        onChange={handleFormChange}
        fields={fields}
        fieldLabels={commonFieldLabels}
        placeholders={commonPlaceholders}
        fieldErrors={fieldErrors}
      />

      {registryWarning && (
        <div
          role="note"
          data-testid="registry-warning"
          className="border-warning/30 bg-warning/10 text-warning rounded-lg border px-3 py-2 text-xs"
        >
          {t('studio.widget.missing_registry_warning', { id: registryWarning })}
        </div>
      )}

      {data.type === 'quiz' && (
        <div className="space-y-2">
          <label className="text-on-surface-variant text-xs font-medium">
            {t('studio.editor.node.answerOptions')}
          </label>
          {(data.options ?? []).map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                className="border-outline-variant focus:border-primary focus:ring-primary w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
                placeholder={t('studio.editor.node.optionPlaceholder', {
                  letter: String.fromCharCode(97 + idx),
                })}
                value={opt.text}
                onChange={(e) => {
                  const opts = [...(data.options ?? [])];
                  const current = opts[idx]!;
                  opts[idx] = { id: current.id, text: e.target.value, correct: current.correct };
                  onChange({ ...data, options: opts });
                }}
              />
              <label className="text-on-surface-variant flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  className="border-outline-variant text-success focus:ring-success size-4 rounded"
                  checked={opt.correct}
                  onChange={(e) => {
                    const opts = [...(data.options ?? [])];
                    const current = opts[idx]!;
                    opts[idx] = { id: current.id, text: current.text, correct: e.target.checked };
                    onChange({ ...data, options: opts });
                  }}
                />
                {t('studio.editor.quiz.correct')}
              </label>
              <button
                type="button"
                className="text-on-surface-variant hover:bg-error-container hover:text-error shrink-0 rounded p-1"
                onClick={() => {
                  const opts = data.options?.filter((_, i) => i !== idx);
                  onChange({ ...data, options: opts });
                }}
                aria-label={`Remove option ${idx + 1}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-primary hover:bg-primary-container rounded px-2 py-1 text-xs font-medium"
            onClick={() => {
              const newId = String.fromCharCode(97 + (data.options?.length ?? 0));
              onChange({
                ...data,
                options: [...(data.options ?? []), { id: newId, text: '', correct: false }],
              });
            }}
          >
            + {t('studio.editor.quiz.addOption')}
          </button>
        </div>
      )}

      {data.type === 'reflection' && (
        <div>
          <label className="text-on-surface-variant mb-0.5 block text-xs font-medium">
            {t('studio.editor.reflection.promptLabel')}
          </label>
          <Textarea
            className="border-outline-variant focus:border-primary focus:ring-primary w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
            rows={4}
            placeholder={t('studio.editor.reflection.promptPlaceholder')}
            value={data.prompt ?? ''}
            onChange={(e) => onChange({ ...data, prompt: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
