export { buildOpenEduBridge, buildSemanticTokens, readCssTokens } from './bridge.js';
export type { OpenEduBridgeInputs, OpenEduBridge } from './bridge.js';
export { InteractiveNodeView, InteractiveLessonView } from './views.js';
export type {
  InteractiveNodeViewProps,
  InteractiveLessonViewProps,
  InteractiveNodeHandle,
  InteractiveLessonHandle,
} from './views.js';

export { AlternativeList, extractAlternativeRows } from './alternative-list.js';
export type {
  AlternativeListProps,
  AlternativeRowLike,
  AlternativeRowView,
} from './alternative-list.js';

export { normalizeAssetKey, isDataAssetId } from './asset-resolution.js';

export { FigureOverlay, collectFigurePlacements, authoredIdOf } from './figure-overlay.js';
export type {
  FigureOverlayProps,
  FigurePlacement,
  FigureSpecView,
  SceneBounds,
  SceneNodeLike,
} from './figure-overlay.js';

export type {
  InteractiveEngineType,
  InteractiveActionType,
  InteractiveNode,
  InteractiveNodeConfig,
} from '@open-edu/schemas';
