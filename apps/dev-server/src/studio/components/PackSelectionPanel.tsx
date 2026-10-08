import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { SUPPORTED_LOCALES } from '@open-edu/i18n/locale';
import { listProfiles } from '@open-edu/domain-guidance/profiles';
import type { AuthoringContext, PackDiagnostic, PackDetail, PackSummary } from '@open-edu/packs';
import { useStudioAssistant } from '../ai/StudioAssistantProvider';
import type { StudioApi } from '../studioApi.js';

export function PackSelectionPanel({
  api,
  onError,
  onAuthoring,
}: {
  api: StudioApi;
  onError: (message: string) => void;
  onAuthoring: (context: AuthoringContext, warnings: PackDiagnostic[]) => void;
}) {
  const { t } = useTranslation();
  const { openWithPreset } = useStudioAssistant();
  const profiles = listProfiles();

  const [curricula, setCurricula] = useState<PackSummary[] | null>(null);
  const [curriculumId, setCurriculumId] = useState<string>('');
  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [unit, setUnit] = useState<string>('');
  const [learner, setLearner] = useState<string>('neurotypical');
  const [locale, setLocale] = useState<string>('en');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const listPromise = typeof api.listPacks === 'function' ? api.listPacks() : Promise.resolve([]);
    void listPromise
      .then((packs) => {
        if (!cancelled) setCurricula(packs.filter((p) => p.type === 'curriculum'));
      })
      .catch((err) => {
        if (!cancelled) {
          setCurricula([]);
          onError(err instanceof Error ? err.message : t('studio.errors.generic'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, onError, t]);

  useEffect(() => {
    if (!curriculumId) {
      setDetail(null);
      return;
    }
    const summary = curricula?.find((c) => c.id === curriculumId);
    if (!summary) return;
    let cancelled = false;
    void api
      .getPackDetail(summary.id, summary.version)
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
          setUnit(next?.units[0]?.id ?? '');
        }
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : t('studio.errors.generic'));
      });
    return () => {
      cancelled = true;
    };
  }, [api, curriculumId, curricula, onError, t]);

  const handleCreate = async () => {
    if (!curriculumId) return;
    setBusy(true);
    try {
      const { context, warnings } = await api.setAuthoringSelection({
        curriculum: curriculumId,
        unit: unit || undefined,
        learner,
        locale,
      });
      onAuthoring(context, warnings);
      openWithPreset({
        message: t('studio.packs.assistantPreset', {
          unit: unit || t('studio.packs.unitAll'),
          curriculum: curriculumId,
        }),
        prefill: true,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : t('studio.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (curricula !== null && curricula.length === 0) {
    return (
      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-6 pt-6">
          {t('studio.packs.selectionHeading')}
        </CardTitle>
        <CardContent className="px-6 pb-6 pt-4">
          <EmptyState
            heading={t('studio.packs.selectionHeading')}
            description={t('studio.packs.noneFound')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-outline-variant bg-surface">
      <CardTitle className="text-on-surface px-6 pt-6">
        {t('studio.packs.selectionHeading')}
      </CardTitle>
      <CardDescription className="px-6 pt-2">{t('studio.packs.selectionLede')}</CardDescription>
      <CardContent className="grid gap-4 px-6 pb-6 pt-4 sm:grid-cols-2">
        <div>
          <label className="text-on-surface-variant text-xs font-medium">
            {t('studio.packs.curriculumLabel')}
          </label>
          <Select value={curriculumId} onValueChange={setCurriculumId}>
            <SelectTrigger className="mt-1 w-full" aria-label={t('studio.packs.curriculumLabel')}>
              <SelectValue placeholder={t('studio.packs.curriculumPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {(curricula ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-on-surface-variant text-xs font-medium">
            {t('studio.packs.unitLabel')}
          </label>
          <Select value={unit} onValueChange={setUnit} disabled={!detail}>
            <SelectTrigger className="mt-1 w-full" aria-label={t('studio.packs.unitLabel')}>
              <SelectValue placeholder={t('studio.packs.unitAll')} />
            </SelectTrigger>
            <SelectContent>
              {(detail?.units ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-on-surface-variant text-xs font-medium">
            {t('studio.packs.learnerLabel')}
          </label>
          <Select value={learner} onValueChange={setLearner}>
            <SelectTrigger className="mt-1 w-full" aria-label={t('studio.packs.learnerLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-on-surface-variant text-xs font-medium">
            {t('studio.packs.languageLabel')}
          </label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger className="mt-1 w-full" aria-label={t('studio.packs.languageLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Button
            variant="default"
            size="sm"
            disabled={busy || !curriculumId}
            onClick={() => void handleCreate()}
          >
            {t('studio.packs.createButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
