import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@open-edu/design-system';
import { MarkdownRenderer } from '@open-edu/runtime';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@open-edu/i18n';
import { EditorCoachingPanel } from './EditorCoachingPanel.js';
import { useEditorBridge, readTextareaSelection } from '../ai/EditorBridgeContext';
import type { StudioApi } from '../studioApi.js';
import type { DraftItem } from '../ai/types.js';

function syncHeading(content: string, title: string): string {
  const lines = content.split('\n');
  const firstHeading = lines.findIndex((line) => /^#{1,6}\s/.test(line));
  const heading = `# ${title}`;
  if (firstHeading === -1) {
    return `${heading}\n\n${content}`;
  }
  lines[firstHeading] = heading;
  return lines.join('\n');
}

export function LessonActivityEditor({
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
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [baseline, setBaseline] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('write');
  const { register, unregister, setSelection } = useEditorBridge();

  useEffect(() => {
    let cancelled = false;
    api
      .readFile(path)
      .then((file) => {
        if (cancelled) return;
        setBody(file.content);
        setBaseline(file.content);
        const match = file.content.match(/^#{1,6}\s+(.+)$/m);
        setTitle(match?.[1]?.trim() ?? '');
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, path, onError]);

  const getCurrentContent = useCallback(() => body, [body]);
  const isDirty = useCallback(() => body !== baseline, [body, baseline]);

  useEffect(() => {
    register({
      getCurrentContent,
      applyToEditor: (item: DraftItem) => {
        setBody(item.content);
        const match = item.content.match(/^#{1,6}\s+(.+)$/m);
        setTitle(match?.[1]?.trim() ?? '');
      },
      isDirty,
      kind: 'lesson',
      path,
      title,
    });
    return () => unregister();
  }, [getCurrentContent, isDirty, path, register, title, unregister]);

  const handleSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setSelection(readTextareaSelection(e.currentTarget));
  };
  const handleTitleChange = (next: string) => {
    setTitle(next);
    setBody(syncHeading(body, next));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.writeFile(path, body);
      setBaseline(body);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const hasHeading = /^#{1,6}\s/m.test(body);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-outline-variant bg-surface flex items-center gap-2 border-b px-4 py-2">
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label={t('studio.editor.back')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <h1 className="text-h1 text-on-surface">{t('studio.editor.heading.lesson')}</h1>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <label className="text-on-surface block text-sm font-medium">
            {t('studio.editor.lesson.titleLabel')}
            <Input
              className="mt-2"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              aria-label={t('studio.editor.lesson.titleLabel')}
            />
          </label>
          <div>
            <span className="text-on-surface block text-sm font-medium">
              {t('studio.editor.lesson.bodyLabel')}
            </span>
            <Tabs value={tab} onValueChange={setTab} className="mt-2">
              <TabsList className="grid w-full grid-cols-2 lg:w-64">
                <TabsTrigger value="write">{t('studio.editor.writeTab')}</TabsTrigger>
                <TabsTrigger value="preview">{t('studio.editor.previewTab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-4">
                <Textarea
                  className="min-h-[320px] w-full"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onSelect={handleSelectionChange}
                  onKeyUp={handleSelectionChange}
                  onMouseUp={handleSelectionChange}
                  aria-label={t('studio.editor.lesson.bodyLabel')}
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-4">
                <div className="border-outline-variant bg-surface min-h-[320px] rounded-lg border p-4">
                  {body.trim() ? (
                    <MarkdownRenderer content={body} />
                  ) : (
                    <p className="text-on-surface-variant text-sm">
                      {t('studio.editor.previewEmpty')}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={() => void handleSave()} disabled={saving}>
              {t('studio.editor.save')}
            </Button>
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
                id: 'heading',
                passed: hasHeading,
                label: hasHeading
                  ? t('studio.editor.coaching.lesson.headingPresent')
                  : t('studio.editor.coaching.lesson.headingMissing'),
              },
            ]}
            tips={[
              t('studio.editor.coaching.lesson.addHeading'),
              t('studio.editor.coaching.lesson.oneIdea'),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
