import { useEffect, useState } from 'react';
import { useTranslation } from '@open-edu/i18n';
import { LessonActivityEditor } from './LessonActivityEditor.js';
import { QuizActivityEditor } from './QuizActivityEditor.js';
import { PracticeActivityEditor } from './PracticeActivityEditor.js';
import { ReflectionActivityEditor } from './ReflectionActivityEditor.js';
import { RawActivityEditor } from './RawActivityEditor.js';
import { detectActivityKind } from '../outlineModel.js';
import type { ActivityKind } from '../types.js';
import type { AuthoringContext } from '@open-edu/packs';
import type { StudioApi } from '../studioApi.js';

export function ActivityEditorRouter({
  api,
  path,
  authoring = null,
  onSaved,
  onError,
  onCancel,
}: {
  api: StudioApi;
  path: string;
  authoring?: AuthoringContext | null;
  onSaved: () => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ActivityKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .readFile(path)
      .then((file) => {
        if (!cancelled) setKind(detectActivityKind(file.path, file.content));
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, path, onError]);

  if (kind === null) {
    return (
      <div className="p-6" aria-busy>
        <p className="text-on-surface-variant text-sm">{t('studio.editor.loading')}</p>
      </div>
    );
  }

  if (kind === 'lesson') {
    return (
      <LessonActivityEditor
        api={api}
        path={path}
        authoring={authoring}
        onSaved={onSaved}
        onError={onError}
        onCancel={onCancel}
      />
    );
  }

  if (kind === 'quiz') {
    return (
      <QuizActivityEditor
        api={api}
        path={path}
        authoring={authoring}
        onSaved={onSaved}
        onError={onError}
        onCancel={onCancel}
      />
    );
  }

  if (kind === 'practice') {
    return (
      <PracticeActivityEditor
        api={api}
        path={path}
        authoring={authoring}
        onSaved={onSaved}
        onError={onError}
        onCancel={onCancel}
      />
    );
  }

  if (kind === 'reflection') {
    return (
      <ReflectionActivityEditor
        api={api}
        path={path}
        onSaved={onSaved}
        onError={onError}
        onCancel={onCancel}
      />
    );
  }

  return (
    <RawActivityEditor
      api={api}
      path={path}
      onSaved={onSaved}
      onError={onError}
      onCancel={onCancel}
    />
  );
}
