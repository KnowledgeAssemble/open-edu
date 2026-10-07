export const CORE_VERSION = '0.1.0';

export {
  coreLoaderLogger,
  coreValidatorLogger,
  coreScannerLogger,
  corePatcherLogger,
} from './logger.js';

export { loadPackage } from './loader.js';
export type { LoadOptions } from './loader.js';
export { loadPackageFromFiles } from './file-loader.js';
export type { PackageFileSource } from './types.js';
export type { LoadedPackage, LoadedNode, LoadedBundle } from './types.js';
export {
  PackageLoadError,
  ManifestValidationError,
  NodeLoadError,
  AssetNotFoundError,
  WorkflowValidationError,
  RewardsValidationError,
  CardsValidationError,
  WorkflowRouteError,
  EntryNodeNotFoundError,
} from './errors.js';
export type { ErrorDiagnostics } from './errors.js';
export { lintPackage } from './content-lint.js';
export type { LintWarning, LintResult } from './content-lint.js';
export { loadManifest, parseManifest } from './manifest.js';
export { loadWorkflow, parseWorkflow } from './workflow.js';
export { loadRewards, parseRewards } from './rewards.js';
export { loadCards, parseCards } from './cards.js';
export { loadNodes } from './nodes-fs.js';
export { loadNodesFromSource, parseNodeContent } from './nodes.js';
export {
  forEachInteractiveSpec,
  parseGeoUri,
  collectGeoSourceRefs,
  inlineGeoSources,
  findGeoAssetsDir,
  loadGeoAssetFeatures,
  resolveGeoUrisInSpec,
  resolveGeoUrisInNode,
  resolveGeoUrisInNodes,
  GEO_URI_PREFIX,
} from './geo-assets.js';
export type { GeoSourceRef, GeoSourceDataLoader } from './geo-assets.js';
export {
  resolveAssets,
  resolveAssetPath,
  collectAssetsFromSource,
  normalizeAssetPath,
} from './assets.js';
export { ASSET_MIME_TYPES } from './asset-mime-types.js';
export { computeFileHash, verifyIntegrity } from './integrity.js';
export type {
  IntegrityResult,
  IntegrityMismatch,
  BuildManifest,
  BuildManifestEntry,
} from './integrity.js';
export { generateAgentPrompt } from './agent-prompt.js';
export { generateWidgetCatalog, getDefaultWidgetCatalog } from './widget-catalog.js';
export type { WidgetCatalogEntry, WidgetCatalogInput } from './widget-catalog.js';
export { WIDGET_ALIAS_MAP } from './widget-catalog.js';
export { applyPatch } from './patcher.js';
export type { PatchOperation, PatchReport, PatchOperationResult } from './patcher.js';
export { scanPackages } from './scanner.js';
export type { PackageSummary } from './scanner.js';
export { loadBundle } from './bundle-loader.js';
export { scanBundles, scanAll } from './bundle-scanner.js';
export type { BundleSummary } from './bundle-scanner.js';
export {
  BundleValidationError,
  ModuleNotFoundError,
  ModuleMismatchError,
  CircularDependencyError,
  MissingPrerequisiteError,
} from './errors.js';
export { importLearnEasy } from './learn-easy-importer.js';
export type { ImportOptions, ImportResult } from './learn-easy-importer.js';
export { serializeResolvedNodes, hasUnresolvedGeoSources } from './node-serialize.js';
