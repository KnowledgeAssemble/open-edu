import type { OpenEduBridge } from '@knowledgeassemble/interactive-react';

export type { OpenEduBridge } from '@knowledgeassemble/interactive-react';

/**
 * Plain, framework-agnostic inputs needed to build an {@link OpenEduBridge}.
 * The consuming host (learner app / studio preview / runtime renderer) is
 * responsible for providing these from its own seams (i18n, theme tokens,
 * live region, telemetry, asset resolution).
 */
export interface OpenEduBridgeInputs {
  locale: string;
  /**
   * Design-system token map (e.g. keyed by semantic names like `emphasis`,
   * `danger`). Values are the design system's strings — engines never see
   * literal colors in specs.
   */
  tokens: Record<string, string>;
  reducedMotion: boolean;
  /** i18n translate; never hard-code user-facing strings. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** a11y live-region announce. */
  announce: (message: string) => void;
  /** Telemetry sink; receives the raw semantic engine event stream. */
  onEvent: (event: { seq: number; name: string; instanceId: string; action?: unknown }) => void;
  /** Resolve an asset id to a URL string or raw bytes. */
  resolveAsset: (id: string) => string | Uint8Array;
}

/** Build an `OpenEduBridge` from plain host inputs. */
export function buildOpenEduBridge(inputs: OpenEduBridgeInputs): OpenEduBridge {
  return {
    locale: inputs.locale,
    tokens: inputs.tokens,
    reducedMotion: inputs.reducedMotion,
    t: inputs.t,
    announce: inputs.announce,
    onEvent: inputs.onEvent,
    resolveAsset: inputs.resolveAsset,
  };
}

/** Read design tokens from the document's `--oe-*` CSS custom properties. */
export function readCssTokens(root: Document = document): Record<string, string> {
  const result: Record<string, string> = {};
  const styles = getComputedStyle(root.documentElement);
  if (!styles) return result;
  for (let i = 0; i < styles.length; i++) {
    const name = styles.item(i);
    if (name.startsWith('--oe-')) {
      const value = styles.getPropertyValue(name).trim();
      if (value) result[name] = value;
    }
  }
  return result;
}

const SEMANTIC_TOKEN_ALIASES: Record<string, string> = {
  emphasis: '--oe-color-primary',
  danger: '--oe-color-error',
  focus: '--oe-color-primary',
  success: '--oe-color-success',
  surface: '--oe-color-surface',
  'on-surface': '--oe-color-on-surface',
  background: '--oe-color-background',
  'on-background': '--oe-color-on-background',
  outline: '--oe-color-outline',
};

/**
 * Build the token map engines consume: raw `--oe-*` vars plus semantic aliases
 * (`emphasis`, `danger`, …) resolved from the active theme.
 */
export function buildSemanticTokens(root: Document = document): Record<string, string> {
  const cssTokens = readCssTokens(root);
  const styles = getComputedStyle(root.documentElement);
  const tokens: Record<string, string> = { ...cssTokens };

  for (const [semantic, cssVar] of Object.entries(SEMANTIC_TOKEN_ALIASES)) {
    const value = styles.getPropertyValue(cssVar).trim() || cssTokens[cssVar];
    if (value) tokens[semantic] = value;
  }

  return tokens;
}
