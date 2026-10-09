import type { WidgetCatalogEntry } from '@open-edu/schemas';
import type { WidgetDefinitionV2 } from './types';

// NOTE: the parameter type must be `object`, NOT `Record<string, unknown>` —
// WidgetCapabilities / AccessibilityMetadata / AnalyticsMetadata are interfaces
// without index signatures and are not assignable to Record<string, unknown>.
function trueKeys(obj: object | undefined): string[] {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

/** Derive a JSON-safe catalog entry from a V2 definition (L4). */
export function toCatalogEntry(w: WidgetDefinitionV2): WidgetCatalogEntry {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    domain: w.domain,
    status: w.status,
    deprecated: w.deprecated,
    replacement: w.replacement,
    keywords: w.keywords,
    learningIntents: w.learningIntents,
    capabilities: trueKeys(w.capabilities),
    accessibility: trueKeys(w.accessibility),
    analytics: trueKeys(w.analytics),
    reward: w.reward
      ? {
          completionXP: w.reward.completionXP,
          positiveMessage: w.reward.positiveMessage,
          achievement: w.reward.achievement,
        }
      : undefined,
    ai: w.ai
      ? {
          difficulty: w.ai.difficulty,
          estimatedMinutes: w.ai.estimatedMinutes,
          bloomsLevel: w.ai.bloomsLevel,
          cognitiveLoad: w.ai.cognitiveLoad,
          recommendedAge: w.ai.recommendedAge,
          readingLevel: w.ai.readingLevel,
          subjectTags: w.ai.subjectTags,
          learningObjectives: w.ai.learningObjectives,
          commonMisconceptions: w.ai.commonMisconceptions,
          generationHints: w.ai.generationHints,
        }
      : undefined,
    guide: w.guide,
  };
}

export function toWidgetCatalogEntries(widgets: WidgetDefinitionV2[]): WidgetCatalogEntry[] {
  return widgets.map(toCatalogEntry);
}
