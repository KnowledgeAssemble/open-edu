import { useState } from 'react';
import {
  Button,
  PageHeader,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { listRecentCourses } from '../recentCourses.js';
import { AiStartPanel } from './AiStartPanel.js';
import { HomeTemplateGallery } from './HomeTemplateGallery.js';
import { PackSelectionPanel } from './PackSelectionPanel.js';
import type { StudioApi } from '../studioApi.js';
import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';

export function HomeView({
  api,
  onOpened,
  onError,
  courseTitle,
  onOpenCurrent,
  onOpenLibrary,
  onAuthoring,
}: {
  api: StudioApi;
  onOpened: () => void;
  onError: (message: string) => void;
  courseTitle?: string;
  onOpenCurrent: () => void;
  onOpenLibrary: () => void;
  onAuthoring?: (context: AuthoringContext, warnings: PackDiagnostic[]) => void;
}) {
  const { t } = useTranslation();
  const recent = listRecentCourses();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handleConfirmOverwrite = async () => {
    if (!pendingTemplateId) return;
    setApplying(true);
    try {
      await api.applyTemplate(pendingTemplateId);
      setPendingTemplateId(null);
      setSelectedTemplateId(null);
      onOpened();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <PageHeader title={t('studio.home.title')} subtitle={t('studio.home.lede')} />

      {courseTitle ? (
        <section aria-labelledby="studio-continue-heading">
          <div className="border-outline-variant bg-surface flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-on-surface text-sm font-medium">{courseTitle}</span>
            <Button variant="default" size="sm" onClick={onOpenCurrent}>
              {t('studio.home.openCurrentCourse')}
            </Button>
          </div>
        </section>
      ) : null}

      <HomeTemplateGallery
        selectedId={selectedTemplateId}
        onSelect={setSelectedTemplateId}
        onApply={setPendingTemplateId}
      />

      <PackSelectionPanel api={api} onError={onError} onAuthoring={onAuthoring ?? (() => {})} />

      <section aria-labelledby="studio-ai-heading">
        <h2 id="studio-ai-heading" className="text-h2 text-on-surface mb-4">
          {t('studio.home.aiHeading')}
        </h2>
        <AiStartPanel onError={onError} />
      </section>

      <section aria-labelledby="studio-recent-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="studio-recent-heading" className="text-h2 text-on-surface">
            {t('studio.home.recentHeading')}
          </h2>
          {recent.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onOpenLibrary}>
              {t('studio.nav.library')}
            </Button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            heading={t('studio.home.emptyRecent')}
            description={t('studio.home.emptyRecentDescription')}
            action={
              <Button variant="default" size="sm" onClick={onOpenLibrary}>
                {t('studio.nav.library')}
              </Button>
            }
          />
        ) : (
          <ul className="border-outline-variant bg-surface divide-outline-variant divide-y rounded-lg border">
            {recent.map((course) => (
              <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-on-surface text-sm">{course.title}</span>
                <Button variant="ghost" size="sm" onClick={onOpened}>
                  {t('studio.home.open')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={pendingTemplateId !== null}
        onOpenChange={(open) => {
          if (!open && !applying) setPendingTemplateId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('studio.home.overwriteTitle')}</DialogTitle>
            <DialogDescription>{t('studio.home.overwriteLede')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={applying}
              onClick={() => setPendingTemplateId(null)}
            >
              {t('studio.home.overwriteCancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={applying}
              onClick={() => void handleConfirmOverwrite()}
            >
              {t('studio.home.overwriteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
