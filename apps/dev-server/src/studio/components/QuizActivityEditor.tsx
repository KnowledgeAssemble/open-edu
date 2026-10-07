import { useEffect, useState, useCallback } from 'react';
import { Button, Input, RadioGroup, RadioGroupItem, Textarea } from '@open-edu/design-system';
import { Check, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@open-edu/i18n';
import { EditorCoachingPanel } from './EditorCoachingPanel.js';
import { useEditorBridge, readTextareaSelection } from '../ai/EditorBridgeContext';
import type { StudioApi } from '../studioApi.js';
import type { DraftItem } from '../ai/types.js';

interface OptionDraft {
  id: string;
  text: string;
}

function freshOption(prefix: string, text: string): OptionDraft {
  return { id: `${prefix}-${Math.random().toString(36).slice(2, 7)}`, text };
}

function serializeQuiz(
  question: string,
  options: OptionDraft[],
  correctIndex: number | null,
): string {
  return JSON.stringify(
    {
      type: 'quiz',
      question,
      options: options.map((option, index) => ({
        id: option.id,
        text: option.text,
        correct: index === correctIndex,
      })),
    },
    null,
    2,
  );
}

export function QuizActivityEditor({
  api,
  path,
  onSaved,
  onError,
  onCancel,
}: {
  api: StudioApi;
  path: string;
  onSaved: () => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([
    freshOption('a', ''),
    freshOption('b', ''),
  ]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(0);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, unregister, setSelection } = useEditorBridge();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .readFile(path)
      .then((file) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(file.content) as {
            question?: string;
            options?: Array<{ id?: string; text?: string; correct?: boolean }>;
          };
          setQuestion(parsed.question ?? '');
          const parsedOptions = parsed.options ?? [];
          if (parsedOptions.length > 0) {
            setOptions(
              parsedOptions.map((o) => ({ id: o.id ?? '', text: o.text ?? '' })) as OptionDraft[],
            );
            const correct = parsedOptions.findIndex((o) => o.correct === true);
            setCorrectIndex(correct >= 0 ? correct : null);
          }
          setBaseline(file.content);
        } catch {
          // keep defaults on unparseable content
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, path, onError]);

  const getCurrentContent = useCallback(
    () => serializeQuiz(question, options, correctIndex),
    [question, options, correctIndex],
  );
  const isDirty = useCallback(
    () => getCurrentContent() !== baseline,
    [getCurrentContent, baseline],
  );

  useEffect(() => {
    register({
      getCurrentContent,
      applyToEditor: (item: DraftItem) => {
        try {
          const parsed = JSON.parse(item.content) as {
            question?: string;
            options?: Array<{ text?: string; correct?: boolean }>;
          };
          setQuestion(parsed.question ?? '');
          const draftOptions = parsed.options ?? [];
          setOptions(draftOptions.map((option) => freshOption('opt', option.text ?? '')));
          const correct = draftOptions.findIndex((option) => option.correct === true);
          setCorrectIndex(correct >= 0 ? correct : null);
        } catch {
          // ignore unparseable drafts
        }
      },
      isDirty,
      kind: 'quiz',
      path,
      title: question,
    });
    return () => unregister();
  }, [getCurrentContent, isDirty, path, register, question, unregister]);

  const handleSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setSelection(readTextareaSelection(e.currentTarget));
  };
  const handleAddOption = () => {
    setOptions((prev) => [...prev, freshOption('opt', '')]);
  };

  const handleOptionText = (index: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  };

  const handleCorrect = (value: string) => {
    setCorrectIndex(Number(value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = serializeQuiz(question, options, correctIndex);
      await api.writeFile(path, content);
      setBaseline(content);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6" aria-busy>
        <p className="text-on-surface-variant text-sm">{t('studio.editor.quiz.loading')}</p>
      </div>
    );
  }

  const hasCorrect = correctIndex !== null;
  const minOptions = options.length >= 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-outline-variant bg-surface flex items-center gap-2 border-b px-4 py-2">
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label={t('studio.editor.back')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <h1 className="text-h1 text-on-surface">{t('studio.editor.heading.quiz')}</h1>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <label className="text-on-surface block text-sm font-medium">
            {t('studio.editor.quiz.questionLabel')}
            <Textarea
              className="mt-2"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onSelect={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              onMouseUp={handleSelectionChange}
              aria-label={t('studio.editor.quiz.questionLabel')}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-on-surface mb-2 text-sm font-medium">
              {t('studio.editor.quiz.optionsLabel')}
            </legend>
            <RadioGroup
              value={correctIndex != null ? String(correctIndex) : undefined}
              onValueChange={handleCorrect}
            >
              {options.map((option, index) => (
                <div
                  key={option.id}
                  className="border-outline-variant bg-surface flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <RadioGroupItem
                    value={String(index)}
                    id={`option-${index}`}
                    aria-label={t('studio.editor.quiz.option', { number: String(index + 1) })}
                  />
                  <Input
                    className="flex-1"
                    value={option.text}
                    onChange={(e) => handleOptionText(index, e.target.value)}
                    aria-label={t('studio.editor.quiz.option', { number: String(index + 1) })}
                    placeholder={t('studio.editor.quiz.option', { number: String(index + 1) })}
                  />
                  {correctIndex === index ? (
                    <Check className="text-primary size-4" aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleAddOption}>
              {t('studio.editor.quiz.addOption')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || correctIndex === null}
            >
              {t('studio.editor.save')}
            </Button>
            {correctIndex === null ? (
              <span className="text-error text-sm">
                {t('studio.editor.quiz.noCorrectSelected')}
              </span>
            ) : null}
            {saved ? (
              <span role="status" aria-live="polite" className="text-on-surface-variant text-sm">
                {t('studio.editor.saved')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-col gap-6 lg:w-80 lg:shrink-0">
          <EditorCoachingPanel
            checks={[
              {
                id: 'correct',
                passed: hasCorrect,
                label: hasCorrect
                  ? t('studio.editor.coaching.quiz.hasCorrect')
                  : t('studio.editor.coaching.quiz.noCorrect'),
              },
              {
                id: 'options',
                passed: minOptions,
                label: minOptions
                  ? t('studio.editor.coaching.quiz.minOptions')
                  : t('studio.editor.coaching.quiz.minOptionsMissing'),
              },
            ]}
            tips={[t('studio.editor.coaching.quiz.questionTip')]}
          />
        </div>
      </div>
    </div>
  );
}
