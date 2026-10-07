import { collectGeoSourceRefs, forEachInteractiveSpec } from './geo-assets.js';
import type { LoadedNode } from './types.js';

/**
 * Check whether a parsed node record (raw from `node.content`) has any
 * authored `openedu://geo/*` refs in its spec or engine specs.
 */
function hasAnyGeoSources(raw: Record<string, unknown>): boolean {
  let found = false;
  forEachInteractiveSpec(raw as { spec?: unknown; engines?: Array<{ spec?: unknown }> }, (spec) => {
    if (collectGeoSourceRefs(spec).length > 0) found = true;
  });
  return found;
}

/**
 * For each `.json` node whose raw content has `openedu://geo/*` refs, overlay
 * the resolved spec (and engine specs) from the loaded node onto the raw
 * content and serialize as pretty-printed UTF-8 bytes.
 *
 * Nodes without geo refs are omitted from the returned map — the caller should
 * keep the original on-disk bytes for those.
 */
export function serializeResolvedNodes(nodes: LoadedNode[]): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  const encoder = new TextEncoder();

  for (const loaded of nodes) {
    if (!loaded.relativePath.endsWith('.json')) continue;

    const raw = JSON.parse(loaded.content) as Record<string, unknown>;
    if (!hasAnyGeoSources(raw)) continue;

    const loadedNode = loaded.node as {
      spec?: Record<string, unknown>;
      engines?: Array<{ spec?: Record<string, unknown>; instanceId?: string }>;
    };

    // Overlay the resolved top-level spec
    if (loadedNode.spec) {
      raw.spec = loadedNode.spec;
    }

    // Overlay resolved engine specs (matched by instanceId so reordering/
    // insertion in the loaded node doesn't corrupt the wrong raw engine).
    const rawEngines = raw.engines;
    if (loadedNode.engines && Array.isArray(rawEngines)) {
      for (const loadedEngine of loadedNode.engines) {
        if (!loadedEngine.spec) continue;
        const match = (rawEngines as Record<string, unknown>[]).find(
          (re) =>
            (re as Record<string, unknown>).instanceId ===
            (loadedEngine as Record<string, unknown>).instanceId,
        );
        if (match) {
          match.spec = loadedEngine.spec;
        }
      }
    }

    result.set(loaded.relativePath, encoder.encode(JSON.stringify(raw, null, 2)));
  }

  return result;
}

/**
 * Return true if any loaded node still has unresolved `openedu://geo/*` refs
 * in its spec or engine specs. Used as a fail-closed guard after build-time
 * overlay to catch the case where `loadPackage` could not find a catalog.
 */
export function hasUnresolvedGeoSources(nodes: LoadedNode[]): boolean {
  for (const loaded of nodes) {
    let unresolved = false;
    forEachInteractiveSpec(
      loaded.node as { spec?: unknown; engines?: Array<{ spec?: unknown }> },
      (spec) => {
        if (collectGeoSourceRefs(spec).length > 0) unresolved = true;
      },
    );
    if (unresolved) return true;
  }
  return false;
}
