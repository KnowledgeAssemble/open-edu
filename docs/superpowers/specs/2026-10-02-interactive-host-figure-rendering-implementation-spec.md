# Host-Side Figure Rendering — Implementation Spec (OpenEdu)

> **Status:** Draft — for review
> **Date:** 2026-10-02
> **Repo:** `open-edu` (packages `@open-edu/interactive-runtime`, `@open-edu/runtime`, `@open-edu/schemas`)
> **Depends on:** `@knowledgeassemble/interactive-react` (consumed via `file:` link, root `package.json:89` `pnpm.overrides`); `openedu-interactive` `main`
> **Type:** Host integration spec
> **Distinct from:** `docs/superpowers/plans/2026-09-10-interactive-learner-chrome-implementation-plan.md` (learner chrome: prompt, debug UI, schema, e2e). That plan does not touch assets.
>
> **Path convention:** paths under `packages/{diagram,geomap,visual,chart,timeline}-engine/` and
> `packages/interactive-react/` refer to the sibling checkout `../openedu-interactive`, not to `open-edu`.
> Paths under `packages/{runtime,core,schemas,interactive-runtime}/` refer to this repo.

---

## Purpose

Let a course ship figures (images, SVG diagrams) that appear alongside engine-rendered interactives, without any engine knowing assets exist.

Engines are asset-free by contract (`openedu-interactive` DESIGN §9; verified: `rg "<image|xlink:href" packages/*/src` returns zero hits across all five engines). The host owns resolution, layout, alt text, and failure. This spec defines that host work.

---

## Corrections to prior analysis

Four claims from earlier drafts of this spec were wrong. All are load-bearing, so they are corrected here rather than quietly fixed.

| Prior claim                                                                                                             | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "`InteractiveNodeView`/`InteractiveLessonView` have zero call sites in `open-edu`"                                      | **Wrong.** `packages/runtime/src/renderers/InteractiveRenderer.tsx:3-8` imports all four symbols. The host is wired; the earlier grep was truncated by `head -20`.                                                                                                                                                                                                                                                                                                                                                                                                       |
| "`resolveAsset` is declared but not implemented"                                                                        | **Half wrong.** It is implemented and passed at `InteractiveRenderer.tsx:102` — but with the wrong semantics (D2).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| "Overlay positioning can read coordinates from `snapshot().scene.semantics`"                                            | **Wrong source.** `semantics[*]` has no geometry (verified programmatically against `packages/diagram-engine/fixture/cycle/expected.scene.json`: no `bounds` key on any `semantics` entry). Geometry lives on `snapshot().nodes[].bounds` — the **tree**, not the flat map.                                                                                                                                                                                                                                                                                              |
| "The text-alternative channel is delivered in the snapshot and rendered by nobody, so figures must wait for it" (D4/T1) | **Wrong, and following it would ship an accessibility regression.** The node label channel is **`svgResult.a11y`**, and it **is already rendered** — `interactive-react/src/InteractiveNode.tsx:36-49` (`flattenA11y`) writes it into a visually-hidden `aria-live="polite"` region at `:190-205`, refreshed on every dispatch via `refresh()` (`:66-79`). `svgResult.alternative` is a _different_ structure (a relation table), absent from three of five engines; node `description`s flow exclusively into _it_ and reach nobody. See "The two a11y channels" below. |

### The two a11y channels (do not conflate)

| Channel                 | Type                                                                                                                                                                        | Engines                   | Rendered today?                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `svgResult.a11y`        | Tree of `{id, role, label, children}` — one entry per interactive node/edge; **no `description`** (`svg-kit/src/a11y.ts:20-22` `a11yButton`, diagram `render/svg.ts:80-86`) | **all five**              | **Yes** — `InteractiveNode.tsx:36-49` → `aria-live` region `:190-205`                                             |
| `svgResult.alternative` | Flat relation table — `RelRow[]` (diagram: `render/types.ts:5`) / `EntityRow[]` (geomap: `render/types.ts:5`)                                                               | **geomap + diagram only** | **No** — `rg "alternative" packages/interactive-react/src` → zero hits (correct, but it is not the label channel) |

Proof the two are disjoint in content: `packages/diagram-engine/fixture/cycle/expected.a11y.json` contains 4 node/edge label rows; `.../expected.alternative.json` contains those _plus_ a `cycle-b-a` row that has no `a11y` counterpart. `alternative` adds **cycles and node `description`s**, not labels — the edge relationship is already announced (the `a11y` edge label is `${fromLabel} ${rel} ${toLabel}`, `render/svg.ts:113`), while node `description` flows exclusively into `alternative` rows (`render/svg.ts:96`, geomap `render/svg.ts:154`).

**Consequences for this spec:**

1. T1 must render `alternative`-only content. Rendering `alternative` wholesale beside the live region would double-announce every node and edge.
2. There is a real but _narrow and engine-side_ gap: the engine never puts `description` into `a11y` at all — `a11yButton` (`svg-kit/src/a11y.ts:20-22`) emits `{id, role, label, children}` — so node descriptions flow exclusively into `alternative` rows, which nobody renders. T1 covers the two engines that emit `alternative`; the general engine-side fix is T6 (engine repo, out of this slice).
3. D9 ("a figure never carries meaning") still holds, but for a different reason than originally argued: it rests on `a11y` + `alternative` covering labels, relationships and descriptions, not on `alternative` being the sole meaning channel.

---

## Current state (verified)

| Fact                                                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host bridge is complete and wired                                                          | `InteractiveRenderer.tsx:86-102` — `locale`, `tokens`, `reducedMotion`, `t`, `announce`, `onEvent`, `resolveAsset` all supplied                                                                                                                                                                                                                         |
| `resolveAsset` delegates to the widget resolver                                            | `InteractiveRenderer.tsx:102` → `RuntimeContext.tsx:244-268`                                                                                                                                                                                                                                                                                            |
| Widget resolver returns a **URL string**, never bytes                                      | `RuntimeContext.tsx:257` (`URL.createObjectURL`) or `:265` (`/assets/${normalized}`)                                                                                                                                                                                                                                                                    |
| `assetMap` holds `ArrayBuffer`, not `Uint8Array`                                           | `packages/core/src/types.ts:30` — `assetMap?: Map<string, ArrayBuffer>`                                                                                                                                                                                                                                                                                 |
| `resolveAsset` strips a leading `assets/` before lookup                                    | `RuntimeContext.tsx:249` — so `foo.json` and `assets/foo.json` are the same key                                                                                                                                                                                                                                                                         |
| Assets already ship inside course packages                                                 | `loadedPackage.assetMap`; MIME map at `RuntimeContext.tsx:26-40` already covers `.svg`, `.png`, `.webp`, `.avif`                                                                                                                                                                                                                                        |
| **The host has no re-render signal from engine interaction**                               | `InteractiveNode` holds the instance in a ref and calls `refresh()` internally (`:133,217,223`), updating only its own local state. `InteractiveRenderer` never re-renders.                                                                                                                                                                             |
| Both view components already accept an unused `onEvent` prop                               | `packages/interactive-runtime/src/views.tsx:15` and `:52`                                                                                                                                                                                                                                                                                               |
| Every dispatch emits three events                                                          | `interactive-engine/src/runtime/instance.ts:75-88` — `interaction-started`, `state-changed`, `interaction-completed`                                                                                                                                                                                                                                    |
| The SVG container is destroyed on every state change                                       | `interactive-react/src/svg-surface.ts:56-58` `container.innerHTML = svg`, called from `InteractiveNode.tsx:72` and `:129`                                                                                                                                                                                                                               |
| Placement geometry is on the scene **tree**, populated at layout time                      | diagram fixture → `nodes[0].children[0].bounds`, `positionSource: "illustrative"`; assigned by each engine's layout pass — diagram `layout/engine.ts:118`, geomap `:132-163`, timeline `:132-137`, chart `:99-109`. In the diagram fixture only `kind: "node"` carries `bounds` (root/edges: `undefined`)                                               |
| `bounds` are assigned at layout time                                                       | `diagram-engine/src/layout/engine.ts:118` (`positionSource: 'illustrative' as const`)                                                                                                                                                                                                                                                                   |
| `semantics` entries are the _same objects_ as tree nodes                                   | `diagram-engine/src/scene/build.ts:53-54` — `semantics[sn.id] = sn; semantics[entry.id] = sn;` — so `metadata` (incl. `links`) and `bounds` travel together                                                                                                                                                                                             |
| Each engine exposes the authored node id under a **different** scene-node field            | diagram `metadata.nodeId` (cycle fixture: `node-a` → `metadata: {nodeId: "a"}`); geomap `metadata.entityId` (`scene/build.ts:301`); timeline `node.id` itself (`scene/build.ts:69` — `id: event.id`); chart `metadata.rowId` (`scene/build.ts:86`, N:1 — one row expands to one node per measure, `barId = ${meas.id}-bar-${rowId}`). See the D11 table |
| Canvas dimensions are **not** in the snapshot                                              | `bounds` are viewBox user units; `W`/`H` live only in the SVG string                                                                                                                                                                                                                                                                                    |
| SVG renders 1 user unit = 1 CSS px today                                                   | `svg-kit/src/shell.ts:13` — `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`                                                                                                                                                                                                                                                      |
| `links` is an opaque host-resolved map with a documented convention                        | `diagram-engine/src/skills/diagram/SKILL.md:46`; `links-passthrough.test.ts:54` asserts `{ someHostKey: 'opaque-ref' }` passes through untouched                                                                                                                                                                                                        |
| **`openedu-geo-assets` is not in `package.json`, but the resolution layer already exists** | `packages/core/src/geo-assets.ts` — 438 lines: `GEO_URI_PREFIX`, catalog discovery, semver `version`, per-asset load, inlining                                                                                                                                                                                                                          |

---

## Decisions (resolved)

| #       | Question                                                    | Decision                                                                                                                                                                                                                                                                            | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D0**  | How does the host learn that the snapshot changed?          | **New T0 — pass `onEvent` from `InteractiveRenderer` into the view components**                                                                                                                                                                                                     | `snapshot()` is a pull; there is no push. Without this, every host-side layer freezes at mount. The props already exist and are unused (`views.tsx:15,52`), and `instance.ts:75-88` emits on **every** dispatch, so `onEvent` is a sufficient and exact signal. This gates T1 and T3.                                                                                                                                                                                                                                                                                                                                                                          |
| **D1**  | Where do figures render?                                    | **Sibling overlay**, `position: relative` wrapper + absolutely-positioned `<img>` outside the SVG subtree                                                                                                                                                                           | `renderSvgInto` wipes the container on every dispatch; injected `<image>` nodes cannot survive. Keeps `svgResult.svg` byte-identical to engine goldens, so `honesty-audit.test.ts` and fixture goldens stay green                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **D1a** | Where does the percentage denominator come from?            | **Read `viewBox` off the live `<svg>` element** (`svg.getAttribute('viewBox')`), fall back to `svgResult.svg`, fall back to hiding the overlay                                                                                                                                      | `canvasWidth` is not in the snapshot. `svgShell` emits `viewBox="0 0 W H" width="W" height="H"` (`svg-kit/src/shell.ts:13`), so user units equal CSS px **only while no CSS overrides the SVG's width/height**. That correspondence is silent-load-bearing and must be asserted, not assumed.                                                                                                                                                                                                                                                                                                                                                                  |
| **D2**  | How is `resolveAsset` fixed?                                | **One host resolver with a closed extension discriminator**: `.json`/`.geojson`/`.topojson` → return file **contents** as a decoded string; everything else → return a **URL** string                                                                                               | See "Live defect found". Both branches return `string`, so the return type cannot disambiguate — the id must                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **D3**  | Where does placement data come from?                        | Walk `snapshot().nodes` recursively; **anchor only to nodes that have `bounds`** (empirically `kind: "node"`)                                                                                                                                                                       | The tree visits each scene node once and carries `bounds` on the same object as `metadata`. `semantics` carries no geometry and is dual-registered under both scene and authored ids, so walking it needs a dedupe and still cannot place anything                                                                                                                                                                                                                                                                                                                                                                                                             |
| **D4**  | Build the text-alternative channel first?                   | **Yes — but as `alternative`-only content (T1), not as a re-rendering of node labels**                                                                                                                                                                                              | The label and relationship channels (`a11y` labels, including edge relationships at `render/svg.ts:113`) are already live. Only `alternative`-unique content (cycles, node descriptions) is missing, and only in 2 of 5 engines. Rendering `alternative` wholesale would duplicate live-region announcements — the regression this item was meant to prevent.                                                                                                                                                                                                                                                                                                  |
| **D5**  | Does this need an `openedu-interactive` change?             | **No** for the host work. **Yes, small**, for T6 (a11y rows omit `description`; live region re-announces the full tree per dispatch) — separate PR in the engine repo                                                                                                               | Everything the host does uses existing snapshot fields (`nodes[].bounds`, per-engine authored-id fields, `metadata.links`, `svgResult.alternative`, `svgResult.a11y`). No new engine contract, no new link key. T6 is a defect fix, not a dependency.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **D6**  | Visual `kind: "illustration"`?                              | **Excluded from v1**                                                                                                                                                                                                                                                                | Geometry-less by contract (`visual-engine/src/scene/build.ts:95-105` emits a group of labelled entities, no `bounds`). The host has nothing to position against, and re-implementing layout is what the engine deliberately refuses. Documented as open (Q3)                                                                                                                                                                                                                                                                                                                                                                                                   |
| **D7**  | Where do asset manifests live?                              | **Course package `assetMap` for v1.** The registry pattern is **not** deferred-as-speculative — it already ships in `packages/core/src/geo-assets.ts`; v1 simply does not add a _second_ one                                                                                        | Corrected: the earlier rationale ("`openedu-geo-assets` is not a dependency → defer the registry") was half-true and misleading. `geo-assets.ts` already implements prefix URIs, catalog discovery, semver versions and inlining. Reusing it for figures is a follow-up, not a prerequisite                                                                                                                                                                                                                                                                                                                                                                    |
| **D8**  | Alt text: literal or key?                                   | **Literal `alt`** authored in the figure spec (revised at PR review)                                                                                                                                                                                                                | Figure alt text is **course content**, like `title`, `prompt` and engine `description`s, which the runtime renders verbatim. The earlier draft chose an i18n key, but no mechanism loads locale files from a learning package, framework locale files must not accumulate example-specific strings, and nothing validates example-authored keys (`i18n-keys.test.ts` scans source, not `examples/*.json`) — a typo would render the raw key as alt text. `lint-no-hardcoded-strings.mjs --strict` scans source JSX only, so authored package data is out of its scope, exactly like every other course string. Decorative figure → `""` + `aria-hidden="true"` |
| **D9**  | Does a figure ever carry meaning?                           | **Never.** Alt text plus `a11y` + `alternative` are the meaning channels                                                                                                                                                                                                            | Resting on both channels being present, not on `alternative` alone. A figure that is the only thing distinguishing two nodes is a spec bug, not a host concern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **D10** | Where does `FigureOverlay` live?                            | **`packages/interactive-runtime/src`** — the package that owns the engine seam                                                                                                                                                                                                      | `lint-no-inline-styles.mjs:7` scans only `packages/runtime/src`, `packages/design-system/src`, `apps/website/src`; `interactive-runtime/src` is genuinely unscanned. Note the fallback is _not_ clean: `ALLOWLIST_BLOCK_PATTERNS` (`:12-27`) exempts an entire style block whose text contains `left:` or `top:`, so "keep positioning within the allowlist" would route around the linter rather than comply with it. Prefer placing it in the unscanned package.                                                                                                                                                                                             |
| **D11** | How does a host-authored figure reach an engine scene node? | **Join on each engine's authored-id field (table below).** T4 authors `figures: Record<authoredId, FigureSpec>` on the _OpenEdu_ node config; T3 matches each scene node's authored id against that map — **at most one figure per key**, anchored at the first match in tree order | Corrects the original T3/T4 gap, then over-corrects it: `metadata.nodeId` was generalized from the cycle fixture and would silently break three of four figure-capable engines. Each engine exposes the authored id under a different field, and `sceneNode.id` is engine-minted for diagram/geomap/chart (timeline is the exception — its marker `id` _is_ the authored `event.id`). Chart's `rowId` is N:1 (one row → one node per measure, `chart-engine/src/scene/build.ts:70`), hence the one-figure-per-key rule                                                                                                                                         |

### D11 join keys (verified per engine)

| Engine   | Authored-id field on the scene node              | Evidence                                                                                        |
| -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| diagram  | `metadata.nodeId`                                | `diagram-engine/fixture/cycle/expected.scene.json` — `node-a` carries `metadata: {nodeId: "a"}` |
| geomap   | `metadata.entityId`                              | `geomap-engine/src/scene/build.ts:301`                                                          |
| timeline | `node.id` itself (authored `event.id`)           | `timeline-engine/src/scene/build.ts:69` — `id: event.id`; registered as `semantics[event.id]`   |
| chart    | `metadata.rowId` — **N:1**: one node per measure | `chart-engine/src/scene/build.ts:86`; `barId = ${meas.id}-bar-${rowId}` at `:70`                |
| visual   | none — geometry-less by contract (D6)            | `visual-engine/src/scene/build.ts:95-105`                                                       |

All four figure-capable engines populate `bounds` at layout time (see "Current state"), so gate (a) of T3 holds everywhere the join key exists.

---

## Live defect found (fix in T2)

`geomap-engine/src/scene/build.ts:23-37` (`resolveSourceData`):

```ts
const resolved = resolveAsset(source.uri);
if (typeof resolved === 'string') {
  try { return JSON.parse(resolved); }
  catch { throw new EngineError('RESOURCE_ERROR', ...); }
}
throw new EngineError('RESOURCE_ERROR', ... 'could not be resolved');
```

The host returns a **URL** (or a `blob:` URL). `JSON.parse("blob:https://…")` throws → `RESOURCE_ERROR`.

**Precise blast radius** (corrected — the earlier draft claimed "any geomap spec using `source.uri` fails at mount today"):

| `source.uri` form                                                         | Behaviour today                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openedu://geo/…`                                                         | **Works.** `inlineGeoSources` sets `source.data` and **deletes** `uri`/`asset` at load time (`packages/core/src/geo-assets.ts:147-149`), so `resolveAsset` is never called. The only geomap URI in this repo — `examples/interactive-demo/nodes/geomap-identify-odisha.json:32` — uses this form. |
| package-relative, e.g. `data/india/states.geojson` (`geomap/SPEC.md:541`) | **Fails at mount.** `parseGeoUri` rejects it (`:64`), `collectGeoSourceRefs` skips it (`:95`), so `uri` survives into the engine. This is deliberate: the module docstring states "Non-geo URIs are left untouched for the bridge's own `resolveAsset` handling" (`:110-112`).                    |

So: a **real, latent bug with zero current blast radius** — it fires only for the package-relative form that the engine SPEC documents and that nothing in this repo ships. Fix it, but do not describe it as an outage.

Note the `Uint8Array` branch (line 34) also throws — the engine never accepts bytes despite the `string | Uint8Array` return type in `interactive-engine/src/core/host.ts:9`. The union is misleading, and **the host must never return bytes**. Noted for the engine repo; not a blocker.

**T2 must not add an `openedu://` fetch fallback.** By the time the bridge runs, no `openedu://` URI exists — `inlineGeoSources` deleted it. Such a branch is unreachable dead code.

---

## Architecture

```
InteractiveRenderer
└── <div class="open-edu-interactive" role="region">
    ├── InteractiveNodeView ──► InteractiveNode ──► [engine SVG]   ← engine-owned, never touched
    ├── AlternativeList       ← NEW: sibling; cycles + node descriptions, no live region
    └── FigureOverlay         ← NEW: sibling, position:absolute, %-based
```

Both new layers are siblings of the engine surface, re-derived from `handle.snapshot()` on each **T0-driven** host re-render. Neither writes into the engine's DOM.

**Overlay sizing:** percentages (`left: (x / viewBoxWidth * 100)%`), denominator per D1a. Read `positionSource` and treat `illustrative` as non-authoritative for any purpose beyond placement.

**Anchor limitation (must be stated in the authoring docs):** only scene nodes carrying `bounds` can host a figure. In the cycle fixture that is `kind: "node"` exclusively — the root and all edges have `bounds: undefined`. A figure anchored to an edge will not render; T4's schema must not imply otherwise.

---

## Work items

### T0 — Give the host a change signal (blocking prerequisite for T1 and T3)

- Pass `onEvent` from `InteractiveRenderer` into `InteractiveNodeView` / `InteractiveLessonView` (props already declared at `packages/interactive-runtime/src/views.tsx:15,52`) and trigger a re-read of `handle.snapshot()`.
- Throttle/coalesce: `instance.ts:75-88` emits **three** events per dispatch. Re-read once per `state-changed`, not per event.
- For `InteractiveLessonView`, the handle is per-`instanceId` (`snapshot(instanceId)`) — aggregate across instances or scope the overlay to the single-engine case in v1.
- **DoD:** a host-side layer reflecting `snapshot()` updates after an engine `select`; no extra renders beyond the coalesced one; unit test asserting re-read count per dispatch.

### T1 — Render the `alternative`-only channel

- Add `<AlternativeList>` to `InteractiveRenderer`, rendering **only** the `alternative` rows that carry content absent from `svgResult.a11y`:
  - `kind === "cycle"` rows — no `a11y` counterpart (`cycle-b-a` exists only in `alternative`)
  - node rows' `description` — `a11y` rows carry `label` only (`svg-kit/src/a11y.ts:20-22`); descriptions flow exclusively into `alternative` node rows (`render/svg.ts:96`, geomap `:154`)
  - **skip edge rows** — the `a11y` edge label is already `${fromLabel} ${rel} ${toLabel}` (`render/svg.ts:113`), so alternative edge rows add nothing; rendering them would re-announce
- **Must not duplicate live-region content.** `InteractiveNode.tsx:190-205` already announces `a11y` via `aria-live="polite"`. `AlternativeList` must be a plain (non-live) region; expanding a disclosure must not re-announce.
- `kind` (`node`/`edge`/`cycle`) as a semantic marker, never colour-only.
- Reachable by keyboard and present in the a11y tree. Render nothing at all when `alternative` is absent — that is the case for `visual`, `chart` and `timeline` (Q1).
- **DoD:** for a mounted diagram, every `cycle` row and node `description` appears; no edge content is announced twice; a screen reader encounters node/edge labels **once**; engines without `alternative` render no empty container; `InteractiveRenderer.test.tsx` asserts both the presence and the no-duplication.

### T2 — Correct `resolveAsset` semantics

- New `resolveEngineAsset(id)` in `interactive-runtime`, bridge-level, closed extension discriminator per D2.
- `.json`/`.geojson`/`.topojson` → **contents** string: `assetMap.get(key)` is an `ArrayBuffer` (`packages/core/src/types.ts:30`), so decode with `TextDecoder`. Normalize the key exactly as `RuntimeContext.tsx:246-249` does (strip leading `/`, leading `./`/`../`, and a leading `assets/`) so both `foo.json` and `assets/foo.json` resolve.
- otherwise → **URL** string (existing blob-URL cache + `ASSET_MIME_TYPES`).
- Unknown extension → warn with the id and the available `assetMap` keys; return the URL.
- Reuse the blob cache and the revoke-on-unmount cleanup at `RuntimeContext.tsx:233-242`. Do not duplicate.
- Keep `RuntimeContext.resolveAsset` as the widget seam; have it delegate rather than fork the logic.
- **No `openedu://` branch** (see "Live defect found").
- **DoD:** a geomap fixture with a **package-relative** `source.uri` mounts and renders features (regression test — this is the bug); an image id resolves to a usable URL; no byte returns; `assets/`-prefixed and bare ids both resolve.

### T3 — `FigureOverlay`

- Walk `snapshot().nodes` recursively (D3). For each node that (a) has `bounds`, (b) resolves an authored id per the D11 table, and (c) whose authored id is a key in the host's `figures` map — **at most one figure per `figures` key**, anchored at the first match in tree order (chart rows expand to one node per measure):
  - resolve `ref` via `resolveEngineAsset`
  - position a `<figure>` at `bounds`, percentage-based, denominator per D1a
  - `<img alt={spec.alt}>` (literal authored copy) or `aria-hidden` when decorative
  - `<figcaption>` bound via `aria-describedby`
- Lives in `interactive-runtime/src` (D10).
- **Fails soft:** on load error, render the caption alone. A missing figure must never remove text.
- Never emits a D5 action for a figure — engines don't know figures exist. Load failures go to host telemetry, not the engine event stream.
- **DoD:** figure renders beside its node at correct relative position, including after a reflow that changes the rendered width; an edge-anchored or authored-id-less node renders no figure; a chart row's N matching nodes render **one** figure; missing asset degrades to caption; decorative figure is `aria-hidden`; zero engine events emitted; `pnpm lint` clean (inline-styles + hardcoded-strings `--strict`); unit tests for each.

### T4 — Authoring surface

- `packages/schemas/src/nodes.ts`: add to the interactive node config a `figures` map keyed by **authored engine node id**, preserving the existing `.strict()` (`InteractiveNodeConfigSchema`, `nodes.ts:164-167` — the Zod equivalent of `additionalProperties: false`):
  ```ts
  figures: z.record(
    z.string(),
    z.discriminatedUnion('decorative', [
      z.object({ ref: z.string().min(1), decorative: z.literal(true) }).strict(),
      z
        .object({
          ref: z.string().min(1),
          alt: z.string().min(1),
          decorative: z.literal(false).optional(),
        })
        .strict(),
    ]),
  ).optional();
  ```
  A discriminated union with `.strict()` options, not three optional fields. **The `.strict()` is load-bearing** (verified against zod 3.25.76): a plain `z.object` strips unknown keys, so without it `{ref, decorative: true, alt}` parses and **silently drops `alt`** — shipping a decorative figure the author marked meaningful. With `.strict()` on both options that case is rejected, while `{ref, alt}` (no `decorative`) still parses — the optional discriminator is fine in zod 3.25. This schema is agent-authored, so the invalid combinations must be unrepresentable.
- Course packages ship assets under `assets/`; `ref` is package-relative and matches the `assets/`-stripping normalization in D2.
- **DoD:** schema accepts `{ref, alt}`, `{ref, alt, decorative: false}`, and `{ref, decorative: true}`; rejects `{ref, decorative: true, alt}` (silently drops `alt` without `.strict()` — the case that matters); rejects `{ref}` alone; rejects unknown keys; a fixture package with a figure mounts end-to-end and the overlay resolves it.

### T5 — Docs + e2e

- Document the seam in `docs/ARCHITECTURE.md` and in the **engine repo's** `../openedu-interactive/docs/DEVELOPER-GUIDE.md` host-integration section.
- e2e in `tests/e2e/package-execution.spec.ts`: figure visible, alt text in the a11y tree, missing-asset path degrades to caption.
- **DoD:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, e2e green.

### T6 — Engine repo, separate PR (tracked, not blocking)

Two defects in the same seam, both engine-side:

1. **`description` never enters the `a11y` channel.** `svg-kit/src/a11y.ts:20-22` (`a11yButton`) emits `{id, role, label, children}`, and diagram's inline push (`render/svg.ts:80-86`) does the same — so node descriptions flow exclusively into `alternative` rows (`render/svg.ts:96`, geomap `render/svg.ts:154`), which nobody renders. The fix is upstream of `flattenA11y`: include `description` in a11y rows (+ `render/types.ts:3`, + fixture goldens `expected.a11y.json`). Until then, T1 covers only the two engines that emit `alternative`.
2. **The live region re-announces the full tree per dispatch.** `refresh()` calls `setA11yText(flattenA11y(fullTree))` (`InteractiveNode.tsx:66-79`), rewriting the entire `aria-live` content (`:190-205`) on every interaction — screen readers may announce everything repeatedly. Announce deltas or selection changes instead.

Do not hold T1 for either; file both against `openedu-interactive`.

---

## Non-goals (v1)

- Any change to `openedu-interactive` beyond T6 (no new link key, no engine contract, no renderer change).
- An asset registry / `openedu://` URI scheme for figures (D7 — the equivalent already exists for geo at `packages/core/src/geo-assets.ts`; extending it is a follow-up).
- Visual `kind: "illustration"` figures (D6).
- Serving, transcoding, or uploading assets; OpenEdu consumes, never hosts binaries.
- Any figure that carries meaning not present in text (D9).
- Replacing legacy widgets that already render images (`ImageLabel`, `LabelDiagram`, `ImageCompare`).

---

## Risks

| Risk                                              | Mitigation                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host layers freeze at mount                       | T0 is blocking and precedes T1/T3; every snapshot-derived layer depends on it                                                                                   |
| Duplicate screen-reader announcements             | T1 renders `alternative`-only rows in a non-live region; the `a11y` live region at `InteractiveNode.tsx:190-205` stays the sole announcer of labels             |
| Overlay drifts from engine layout on resize       | Percentage positioning with an explicit `viewBox` denominator (D1a); `positionSource: 'illustrative'` treated as non-authoritative; reflow asserted in T3's DoD |
| Silent breakage if CSS overrides SVG width/height | Breaks the user-unit ≡ CSS-px assumption that D1a depends on; assert the correspondence in a test rather than documenting it                                    |
| Overlay breaks engine hit-testing                 | Overlay is a sibling, `pointer-events: none` except on explicit controls; never overlaps the SVG's hit targets                                                  |
| Figures authored against edges or synthetic nodes | T3 requires `bounds` **and** a per-engine authored id (D11 table); chart's N:1 `rowId` resolves to one figure per key; T4 docs state bounds-carrying nodes only |
| `resolveAsset` returns bytes and geomap throws    | D2 forbids bytes; asserted in T2 DoD                                                                                                                            |
| Figure ids silently unresolvable                  | T2 warns with available keys; T3 degrades to caption; no silent blank                                                                                           |
| Spec surface grows before a consumer needs it     | Non-goals list; D7 declines a _second_ registry rather than the first                                                                                           |

---

## Open questions for review

1. **T1 presentation** — the label and relationship channels are already live, so this is now a small "descriptions and cycles" supplement, not a full text alternative. Recommendation: visible `<details>` disclosure rendered as a plain region (no `aria-live`), defaulting to collapsed. Hidden-only is no longer defensible for cycles and descriptions, which carry meaning absent from `a11y`. Confirm.
2. **Figure key placement (D11 supersedes the earlier recommendation)** — the earlier draft proposed a host-side `figures` map _because_ `links` is reserved for cross-engine entity references. That reasoning holds: `diagram-engine/src/skills/diagram/SKILL.md:46` defines `links` values as "opaque references the host resolves" naming "an entity in another engine instance", and existing values (`visualEntityId: "water-figure"`) point at nodes in a _composed lesson's_ visual instance, not at host assets. But note `links` is convention-only, not schema-enforced — `links-passthrough.test.ts:54` asserts `{ someHostKey: 'opaque-ref' }` passes through untouched. So a `links.figure` key would not be _rejected_ by any engine, only discouraged by a skill doc. `figures` map + per-engine authored-id join (D11) is the enforceable option. Confirm.
3. **Visual `illustration` (D6)** — exclude (recommended), or have the host lay out a row/grid of entity figures itself?
4. **Manifest provenance (D7)** — is per-package asset licensing/attribution already handled by the pack system, or does v1 need an `attributionKey` beside `alt`?

---

## Verification

| Check                    | Command                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Types                    | `pnpm typecheck`                                                                                                                         |
| Lint                     | `pnpm lint` — includes `lint-no-inline-styles.mjs` and `lint-no-hardcoded-strings.mjs --strict`                                          |
| Unit                     | `pnpm test` (root `test` = `pnpm -r run test`; `pnpm -w test` is equivalent)                                                             |
| E2E                      | `pnpm test:e2e` (`tests/e2e/package-execution.spec.ts`)                                                                                  |
| Engine goldens unchanged | **In the sibling checkout:** `pnpm -w test` in `../openedu-interactive` — must stay green for the host work (D5 guarantee)               |
| T6 landed separately     | `../openedu-interactive` PR; it _does_ update `expected.a11y.json` (adds `description`) — no golden may change from the host work itself |

**Exit gate for the slice:** all five green, and (a) a geomap fixture with a **package-relative** `source.uri` mounting successfully (the T2 regression), (b) a mounted diagram exposing node labels to assistive tech **exactly once**, with cycles and node descriptions also present (T1), (c) a figure resolving, reflowing, and degrading to caption (T3).
