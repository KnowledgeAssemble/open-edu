export const WIDGETS_VERSION = '0.2.0';

export type {
  WidgetCatalogEntry,
  WidgetGuideData,
  WidgetGuideConfigField,
} from '@open-edu/schemas';

export { renderWidgetGuideMarkdown } from './guide-markdown.js';

export type {
  WidgetRenderProps,
  WidgetDefinition,
  WidgetDefinitionV2,
  WidgetRegistry,
  WidgetSearchFilters,
  RemoteWidgetManifest,
  RemoteWidgetRegistration,
} from './types.js';
export { WidgetRegistrationError } from './types.js';
export { createWidgetRegistry, registerAllBuiltins, createDefaultRegistry } from './registry.js';
export { RemoteWidgetLoader, TRUSTED_REMOTE_API_VERSION } from './remote-loader.js';
export type { RemoteWidgetLoadResult, EvaluateModule } from './remote-loader.js';
export { assertTrustedRemoteAllowed, originOf, DEFAULT_WIDGET_POLICY } from './policy.js';
export {
  IntegrityError,
  canonicalIntegrity,
  parseIntegrity,
  verifyIntegrity,
} from './integrity.js';
export { useRemoteWidget } from './use-remote-widget.js';
export { normalizeWidgetReference } from './resolver/normalize-reference.js';
export type { NormalizeWarning } from './resolver/normalize-reference.js';
export { createWidgetResolver } from './resolver/widget-resolver.js';
export type {
  WidgetResolver,
  ResolvedWidget,
  ResolveFailure,
  WidgetResolverOptions,
  ResolverCatalog,
  CatalogWidgetMeta,
} from './resolver/widget-resolver.js';
export { fetchBytes } from './resolver/fetch-manifest.js';
export { WidgetCatalogFileSchema, loadStaticCatalog } from './resolver/catalog.js';
export type { WidgetCatalogFile } from './resolver/catalog.js';
export { createWidgetArtifactCache } from './artifact-cache.js';
export type { WidgetArtifactCache, CacheEntry } from './artifact-cache.js';
export type { UseRemoteWidgetResult } from './use-remote-widget.js';
export { Button } from '@open-edu/design-system';
export type { ButtonProps } from '@open-edu/design-system';
export { useObserveMode } from './use-observe-mode.js';
export type { ObserveModeOptions } from './use-observe-mode.js';
export {
  applyFallbackConfig,
  communityCounterToMultipleChoice,
  FALLBACK_ADAPTERS,
} from './fallback-transform.js';
export type { FallbackAdapter } from './fallback-transform.js';
export * as svgExplorer from './svg-explorer/index.js';

export {
  multipleChoicePractice,
  multipleChoice,
  visualCounting,
  matching,
  dragDrop,
  sequencing,
  fillBlank,
  storyQuestion,
  realWorld,
  fractionVisual,
  chartReader,
  gridArea,
  placeValueChart,
  measurementScale,
  clockTime,
  callout,
  imageCompare,
  hotspot,
  timeline,
  labelDiagram,
  imageLabel,
  audioPlayer,
  videoPlayer,
  flashcard,
  processDiagram,
  numberLine,
  socialMap,
} from './builtins/index.js';

export {
  WidgetDomain,
  WIDGET_ALIAS_MAP,
  resolveWidgetId,
  migrateWidgetId,
  getDomainPrefix,
} from './domains.js';

export { validateWidgetMetadata } from './validate-metadata.js';
export type { MetadataValidationResult } from './validate-metadata.js';

export { LearningIntent } from './metadata/learning-intents.js';
export {
  BUILTIN_WIDGETS,
  WIDGET_LEARNING_INTENTS,
  getLearningIntentsForWidget,
  getWidgetsByLearningIntent,
} from './builtin-roster.js';

export { assertPersistableState } from './state-migration.js';

export type {
  WidgetCapabilities,
  AccessibilityMetadata,
  AnalyticsMetadata,
  RewardMetadata,
  AIMetadata,
  BloomsLevel,
  CognitiveLoad,
  DifficultyLevel,
} from './metadata/index.js';
