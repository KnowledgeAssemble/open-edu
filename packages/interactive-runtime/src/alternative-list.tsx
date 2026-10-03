export interface AlternativeRowLike {
  kind?: string;
  id?: string;
  label?: string;
  description?: string;
  members?: string[];
}

export interface AlternativeRowView {
  id: string;
  kind: 'cycle' | 'node';
  text: string;
}

/**
 * Keep only the alternative rows that add information beyond svgResult.a11y:
 * cycle rows (no a11y counterpart) and node rows carrying a description
 * (a11y node rows carry a label only). Edge rows are always excluded — the
 * a11y edge label already announces the relationship. Rows without `kind`
 * (geomap) are intentionally skipped.
 */
export function extractAlternativeRows(
  alternative: AlternativeRowLike[] | undefined,
): AlternativeRowView[] {
  const rows: AlternativeRowView[] = [];
  for (const row of alternative ?? []) {
    if (row.kind === 'cycle') {
      rows.push({
        id: row.id ?? `cycle-${rows.length}`,
        kind: 'cycle',
        text: row.label ?? (row.members ?? []).join(' → '),
      });
    } else if (row.kind === 'node' && row.description) {
      rows.push({ id: row.id ?? `node-${rows.length}`, kind: 'node', text: row.description });
    }
  }
  return rows;
}

export interface AlternativeListProps {
  title: string;
  cycleLabel: string;
  rows: AlternativeRowView[];
}

export function AlternativeList({
  title,
  cycleLabel,
  rows,
}: AlternativeListProps): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <details
      className="border-outline-variant bg-surface mt-4 rounded-lg border px-4 py-3"
      data-testid="interactive-alternative"
    >
      <summary className="text-on-surface cursor-pointer text-sm font-medium">{title}</summary>
      <ul className="text-body-ui text-muted-foreground mt-2 list-disc space-y-1 pl-5">
        {rows.map((row) => (
          <li key={row.id} data-kind={row.kind}>
            {row.kind === 'cycle' && (
              <span className="border-outline-variant text-muted-foreground mr-2 rounded-sm border px-1.5 py-0.5 text-xs uppercase tracking-wide">
                {cycleLabel}
              </span>
            )}
            {row.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
