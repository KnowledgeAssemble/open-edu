import type { WidgetCatalogEntry } from '@open-edu/schemas';

export function renderWidgetGuideMarkdown(entry: WidgetCatalogEntry): string {
  const g = entry.guide;
  if (!g) return '';
  const id = entry.id;
  const name = entry.name ?? entry.id;
  const domain = entry.domain ?? 'core';
  const status = entry.status ?? 'stable';
  return (
    [
      `# ${name}`,
      ``,
      `**Widget ID:** \`${id}\` | **Domain:** ${domain} | **Status:** ${status}`,
      ``,
      `> ${g.oneLiner}`,
      ``,
      `## What it does`,
      ``,
      g.whatItDoes,
      ...(g.whenToUse.length > 0
        ? [``, `## When to use this widget`, ``, ...g.whenToUse.map((item) => `- ${item}`)]
        : []),
      ``,
      `## Setting it up`,
      ``,
      ...g.setupSteps.map((step, i) => `${i + 1}. ${step}`),
      ``,
      `## Configuration fields`,
      ``,
      `| Field | Type | Required | Description |`,
      `|-------|------|----------|-------------|`,
      ...g.configFields.map(
        (f) => `| \`${f.name}\` | ${f.type} | ${f.required ? 'Yes' : 'No'} | ${f.description} |`,
      ),
      ``,
      `## Example`,
      ``,
      '```json',
      g.exampleJson.trim(),
      '```',
      ...(g.tips.length > 0 ? [``, `## Tips`, ``, ...g.tips.map((tip) => `- ${tip}`)] : []),
      ...(g.relatedWidgets && g.relatedWidgets.length > 0
        ? [
            ``,
            `## See also`,
            ``,
            ...g.relatedWidgets.map((r) =>
              r.domain === domain
                ? `- [${r.name}](${r.slug}.md)`
                : `- [${r.name}](../${r.domain}/${r.slug}.md)`,
            ),
          ]
        : []),
    ].join('\n') + '\n'
  );
}
