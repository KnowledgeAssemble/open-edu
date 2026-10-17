import type { AuthoringContext } from '@open-edu/packs';

export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchAuthoringObjectives(
  authoring: AuthoringContext,
  text: string,
): AuthoringContext['objectives'] {
  const norm = normalizeDescription(text);
  if (!norm) return [];
  const seen = new Set<string>();
  const out: AuthoringContext['objectives'] = [];
  for (const objective of authoring.objectives) {
    const objectiveNorm = normalizeDescription(objective.description);
    if (!objectiveNorm) continue;
    if (
      !seen.has(objective.id) &&
      (norm === objectiveNorm || norm.includes(objectiveNorm) || objectiveNorm.includes(norm))
    ) {
      seen.add(objective.id);
      out.push(objective);
    }
  }
  return out;
}
