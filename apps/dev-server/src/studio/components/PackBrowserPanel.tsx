import { Card, CardContent, CardDescription, CardTitle } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';

function truncationLabel(section: string, t: (key: string) => string): string {
  switch (section) {
    case 'objectives':
      return t('studio.packs.sectionObjectives');
    case 'concepts':
      return t('studio.packs.sectionConcepts');
    case 'unitTitle':
      return t('studio.packs.sectionUnitTitle');
    case 'availableActivities':
      return t('studio.packs.sectionAvailableActivities');
    default:
      return section;
  }
}

export function PackBrowserPanel({
  authoring,
  warnings,
  capabilityGaps,
}: {
  authoring: AuthoringContext | null;
  warnings: PackDiagnostic[];
  capabilityGaps: string[];
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4" aria-label={t('studio.packs.panelTitle')}>
      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">
          {t('studio.packs.packsHeading')}
        </CardTitle>
        <CardDescription className="px-4 pt-1">{t('studio.packs.panelLede')}</CardDescription>
        <CardContent className="px-4 pb-4 pt-3">
          {authoring && authoring.packs.length > 0 ? (
            <ul className="text-on-surface space-y-1 text-sm">
              {authoring.packs.map((p) => (
                <li key={`${p.type}:${p.id}`}>
                  {p.type}/{p.id}@{p.version}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.conceptsEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">
          {t('studio.packs.conceptsHeading')}
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-3">
          {authoring && authoring.concepts.length > 0 ? (
            <ul className="text-on-surface space-y-2 text-sm">
              {authoring.concepts.map((c) => (
                <li key={`${c.ref.pack}/${c.ref.concept}`}>
                  <span className="font-medium">
                    {c.ref.pack}/{c.ref.concept}
                  </span>
                  <span className="text-on-surface-variant"> — {c.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.conceptsEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">
          {t('studio.packs.objectivesHeading')}
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-3">
          {authoring && authoring.objectives.length > 0 ? (
            <ul className="text-on-surface space-y-2 text-sm">
              {authoring.objectives.map((o) => (
                <li key={o.id}>
                  <span className="font-medium">{o.id}</span>
                  <span className="text-on-surface-variant">
                    {' '}
                    ({o.bloomLevel ?? 'n/a'}) — {o.description}
                  </span>
                  <div className="text-on-surface-variant text-xs">
                    {o.requiresIntents.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.conceptsEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">
          {t('studio.packs.provenanceHeading')}
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-3">
          {authoring && authoring.provenance.length > 0 ? (
            <ul className="text-on-surface space-y-1 text-sm">
              {authoring.provenance.map((p) => (
                <li key={p.pack}>
                  <span className="font-medium">
                    {p.pack}@{p.version}
                  </span>
                  <span className="text-on-surface-variant">
                    {' '}
                    — {p.documents.join(', ') || t('studio.packs.provenanceEmpty')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.provenanceEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">
          {t('studio.packs.truncatedHeading')}
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-3">
          {authoring && authoring.budget.truncated.length > 0 ? (
            <ul className="text-on-surface list-inside list-disc text-sm">
              {authoring.budget.truncated.map((section) => (
                <li key={section}>{truncationLabel(section, t)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.truncatedNone')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant bg-surface">
        <CardTitle className="text-on-surface px-4 pt-4">{t('studio.packs.gapsHeading')}</CardTitle>
        <CardContent className="px-4 pb-4 pt-3">
          {warnings.length > 0 || capabilityGaps.length > 0 ? (
            <ul className="text-on-surface space-y-1 text-sm">
              {capabilityGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message}</li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">{t('studio.packs.gapsEmpty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
