# @open-edu/interactive-runtime

Host bridge and React mount wrappers for interactive engine nodes (`{ type: "interactive" }`).

## Role

This package is a **thin bridge layer** between OpenEdu and [`@knowledgeassemble/interactive-react`](https://github.com/knowledgeassemble/interactive-react). It does NOT contain engine logic, SVG rendering, or scoring.

## What it provides

- `buildOpenEduBridge(inputs)` — constructs an `OpenEduBridge` from host-provided seams (locale, tokens, i18n, a11y, telemetry, asset resolution)
- `buildSemanticTokens()` — reads CSS custom properties (`--oe-*`) into a token map engines can reference
- `InteractiveNodeView` — React component that mounts a single-engine interactive node
- `InteractiveLessonView` — React component that mounts a composed (multi-engine) interactive lesson

## What it does NOT do

- **Learner chrome** (title, prompt, Mark complete button) lives in `@open-edu/runtime` → `InteractiveRenderer`
- **SVG interaction / rendering** lives in `@knowledgeassemble/interactive-react`
- **Scoring / answer keys** — not implemented (planned for Phase OC-4)

## Geo assets (`openedu://geo/`)

Interactive `geomap` nodes reference shared geography via `openedu://geo/{asset-id}`
URIs (engine-native `uri` field or `asset: { uri, version }` convention) instead
of embedding raw TopoJSON/GeoJSON. `@open-edu/core` resolves these at **Node
load time** (`loadPackage` / `loadNodes`) so packages loaded that way carry a
GeoJSON `FeatureCollection` inlined into `geography.sources[].data`.

**Resolution is Node-load-time only.** The browser bundle never resolves geo
URIs, and neither does `loadPackageFromFiles`, which keep authored URIs as-is.
`oep:build` / `oep:build-bundle` inline geo data into the archive at build
time using the same catalog discovery (vendored `geo-assets/`, `--geo-assets-dir`,
or `OPEN_EDU_GEO_ASSETS_DIR`); browser paths and `loadPackageFromFiles` keep
authored URIs as-is.

The geo-assets dist directory (containing `catalog.json`) is located in this
order:

1. An explicit `geoAssetsDir` option passed to `loadPackage` (authoritative)
2. A `geo-assets/` directory vendored inside the course package itself
   (`<packageDir>/geo-assets`)
3. The `OPEN_EDU_GEO_ASSETS_DIR` environment variable
4. A `<ancestor>/openedu-geo-assets/dist` sibling checkout (walking up from cwd)

When a catalog is found, unknown asset ids or version mismatches fail fast with
an `@open-edu/core` `NodeLoadError`. When **no** catalog is found at all, the
URIs are left in place (best-effort, CI-safe), and a warning is logged. An
explicit `geoAssetsDir` that lacks a catalog is always an immediate error.

## Usage

```tsx
import {
  buildOpenEduBridge,
  buildSemanticTokens,
  InteractiveNodeView,
} from '@open-edu/interactive-runtime';

const bridge = buildOpenEduBridge({
  locale: 'en',
  tokens: buildSemanticTokens(),
  reducedMotion: false,
  t: (key, vars) => translate(key, vars),
  announce: (msg) => liveRegion.announce(msg),
  onEvent: (event) => telemetry.send(event),
  resolveAsset: (id) => `/assets/${id}`,
});

<InteractiveNodeView
  spec={node.spec}
  engineType={node.engine ?? 'visual'}
  bridge={bridge}
  onReady={() => setIsReady(true)}
/>;
```

## Dependencies

- `@knowledgeassemble/interactive-react` — engine React components
- `@open-edu/schemas` — shared Zod types
