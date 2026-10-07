# Host-Side Figure Rendering — Agent Execution Plan (deepseek-4-flash)

> **For the implementing agent.** This is a turn-key, prescriptive plan. It resolves every open
> question from the spec, pre-decides all ambiguous choices, and lists every file, i18n key, test,
> and verification command. Follow the phases in order. Do NOT improvise features, dependencies,
> or engine changes. When something fails, fix it within scope — do not redesign.
>
> - Spec: `docs/superpowers/specs/2026-10-02-interactive-host-figure-rendering-implementation-spec.md`
>   (read first; this plan encodes its decisions D0–D11 and work items T0–T5)
> - Repo rules: `AGENTS.md` (read it). This plan already encodes the AGENTS.md constraints.
> - T6 (engine-repo fixes in `../openedu-interactive`) is **out of scope** — see §0.1.
> - Every fact in §2 was verified against the code on this branch. Cite them; do not re-derive.

---

## 0. Environment & non-negotiables

### 0.1 What you will touch (only this)

| Area                        | Files                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alternative list (T1)       | new `packages/interactive-runtime/src/alternative-list.tsx`, new `packages/interactive-runtime/test/alternative-list.test.tsx`                                                                             |
| Change signal (T0) + wiring | `packages/runtime/src/renderers/InteractiveRenderer.tsx`, `packages/runtime/src/renderers/InteractiveRenderer.test.tsx`                                                                                    |
| Schema (T4)                 | `packages/schemas/src/nodes.ts`, `packages/schemas/src/nodes.test.ts`                                                                                                                                      |
| Asset resolution (T2)       | new `packages/interactive-runtime/src/asset-resolution.ts`, new `packages/interactive-runtime/test/asset-resolution.test.ts`, `packages/runtime/src/context/RuntimeContext.tsx`                            |
| Figure overlay (T3)         | new `packages/interactive-runtime/src/figure-overlay.tsx`, new `packages/interactive-runtime/test/figure-overlay.test.tsx`                                                                                 |
| Package exports             | `packages/interactive-runtime/src/index.ts`                                                                                                                                                                |
| i18n                        | `packages/i18n/locales/en/runtime.json` (additive, flat keys)                                                                                                                                              |
| Tailwind content globs      | `apps/learner/tailwind.config.ts`, `apps/dev-server/tailwind.config.js`, regenerated `apps/dev-server/src/tailwind.css`                                                                                    |
| Example fixture             | new `examples/interactive-demo/nodes/diagram-figure.json`, new `examples/interactive-demo/assets/water-cycle.svg`, `examples/interactive-demo/workflow.json`, `examples/interactive-demo/validate.test.ts` |
| E2E                         | `tests/e2e/package-execution.spec.ts` (interactive-demo block only)                                                                                                                                        |
| Docs (T5)                   | `docs/ARCHITECTURE.md` (one new section)                                                                                                                                                                   |

**Do NOT modify:** `packages/interactive-runtime/src/views.tsx` (its `onEvent` props are dead code —
§1 L1), `packages/interactive-runtime/src/bridge.ts`, `packages/runtime/src/layout/**`,
`packages/design-system/**`, `packages/widgets/**`, any engine package, anything under
`../openedu-interactive` (T6 is a separate PR by a different executor), any other spec/plan file.

If you believe a file outside this list must change, STOP and report instead of editing.

### 0.2 Hard rules

1. **Tokens only.** Tailwind token utilities (`bg-surface`, `text-on-surface`, `text-foreground`,
   `border-outline-variant`, `text-muted-foreground`, `text-body-ui`, plus Tailwind defaults like
   `text-sm`/`text-xs`). No hex/rgb, no palette classes. Verified token names live in
   `packages/design-system/src/tokens/tailwind.ts` (`surface:3`, `foreground:78`,
   `on-surface:11`, `outline-variant:19`, `muted-foreground:94`, `body-ui:190`).
2. **Inline styles** are allowed **only** in the two new component files under
   `packages/interactive-runtime/src`, and only for the overlay's dynamic percentage positioning.
   The inline-style lint scans `packages/runtime/src`, `packages/design-system/src`,
   `apps/website/src` (`scripts/lint-no-inline-styles.mjs:7`) — so `packages/runtime/src` must stay
   free of `style={{`, and the overlay's styles are invisible to the lint by design (spec D10).
3. **i18n for chrome only.** Framework UI strings (e.g. the alternative-list title) go through
   `t('runtime.interactive.<key>')`, with the flat key added to
   `packages/i18n/locales/en/runtime.json` in the same commit. Course content — figure `alt` text
   and engine-authored snapshot content (labels, descriptions, cycle text) — is authored literally
   and rendered verbatim; it never enters the framework locale files.
4. **No new dependencies.** No installs of any kind.
5. **Tests.** Every new module and every changed path gets tests.
6. **No emoji, no debug `console.log`** (the one prescribed `console.warn` is intentional), no dead
   code, no comments beyond what this plan shows.
7. **Conventional commits**, one per phase.
8. Run `pnpm format` at the end of each phase.

### 0.3 Verification loop (all green before the next phase)

```bash
pnpm --filter @open-edu/interactive-runtime test
pnpm --filter @open-edu/interactive-runtime typecheck
pnpm --filter @open-edu/runtime test
pnpm --filter @open-edu/runtime typecheck
pnpm --filter @open-edu/schemas test
pnpm --filter @open-edu/schemas typecheck
pnpm lint
pnpm format:check
```

Phase 5 adds:

```bash
pnpm --filter @open-edu/example-interactive-demo test    # example package validation
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
pnpm test:e2e -- package-execution
```

---

## 1. Locked decisions (do not revisit)

| #   | Question / ambiguity                                           | Locked decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | T0 signal: spec says "pass `onEvent` into the view components" | **No.** `views.tsx:15,52` declare `onEvent` but never use it — passing it does nothing. The real signal exists: engines emit to `host.onEvent` (`InteractiveNode.tsx:95-97`), which `buildOpenEduBridge` wires to the renderer's `handleEngineEvent` (`InteractiveRenderer.tsx:101`). Wire T0 there. **Do not touch `views.tsx`.**                                                                                                                                                                                                                                          |
| L2  | Where the scene lives in a snapshot                            | **`snapshot().scene.nodes`** — every engine returns `{...state, scene, svgResult}` (`diagram/engine.ts:455-458`, `geomap:394-398`, `chart:189-192`, `timeline:196-200`, `visual:170-173`). There is **no root-level `nodes`**. `svgResult` _is_ at the root (`InteractiveNode.tsx:69,74` reads `snap.svgResult`).                                                                                                                                                                                                                                                           |
| L3  | When to re-read the snapshot                                   | On `event.name === 'engine-ready'` (emitted at mount, `instance.ts:63-64`) and on any name ending in `state-changed` (`instance.ts:85`, `diagram/engine.ts:348-350` — engines emit the **bare** name). Never on `interaction-started` / `interaction-completed`. Implement as the exported pure helper `shouldRefreshSnapshot` (§3.1) so it is unit-testable.                                                                                                                                                                                                               |
| L4  | Where the handle comes from                                    | `InteractiveNodeView`'s `onReady` receives an `InteractiveNodeHandle` (`views.tsx:17,31`); `InteractiveLessonView`'s receives an `InteractiveLessonHandle` (`views.tsx:54,71`). **These are different types** — you need two separate callbacks or `tsc` fails (§3.2). At `onReady` time no engine instance exists yet, so do **not** read the snapshot there; the first read happens on `engine-ready`.                                                                                                                                                                    |
| L5  | Composed lessons (`engines` array)                             | **v1 renders no AlternativeList and no FigureOverlay for composed lessons.** Wire only the single-engine branch (`node.engine` + `node.spec`); keep `isComposedLesson(node)` guards. The lesson-view `onReady` must NOT populate the handle ref.                                                                                                                                                                                                                                                                                                                            |
| L6  | Q1 — AlternativeList presentation                              | Collapsed `<details>` disclosure, plain region, **no `aria-live`** (`InteractiveNode.tsx:190-205` is the only announcer). Keyboard-reachable via `<summary>`. Render `null` when there are no rows — which is the case for visual/chart/timeline engines (they emit no `alternative` rows).                                                                                                                                                                                                                                                                                 |
| L7  | Q1 — which rows render                                         | `kind === 'cycle'` rows and `kind === 'node'` rows that carry a `description`. **Never edge rows** — the a11y edge label already announces the relationship (`diagram/render/svg.ts:113` = `` `${fromLabel} ${rel} ${toLabel}` ``); rendering them would duplicate announcements (spec T1 DoD).                                                                                                                                                                                                                                                                             |
| L8  | geomap `alternative` rows                                      | geomap rows have **no `kind` field** (`geomap/render/svg.ts:150-183`: `{entityId, type, name, description, …}`) and geomap emits no cycles → the filter yields **zero rows for geomap**, which is correct and intended. Do not add a geomap branch.                                                                                                                                                                                                                                                                                                                         |
| L9  | Q2/Q3/Q4                                                       | `figures` map on the OpenEdu node config (D11); visual `illustration` excluded (D6); no `attributionKey` in v1 (Q4 deferred).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| L10 | D11 join, per engine                                           | diagram → `metadata.nodeId`; geomap → `metadata.entityId`; chart → `metadata.rowId` (**N:1** — one authored row expands to one scene node per measure, so render at most one figure per `figures` key, first match in tree order); timeline → `node.id` **only when `kind === 'event-marker'`** (other timeline kinds carry engine-minted ids like `${eventId}-span`). **Skip `hidden` scene nodes** — engines omit them from the SVG (`svg.ts:74-75`), so a figure anchored to one would float over nothing.                                                               |
| L11 | Figure markup                                                  | Meaningful: `<img alt={spec.alt}>` (literal authored copy; the schema makes `alt` mandatory on meaningful figures, so it is never empty). Decorative: `alt=""` + `aria-hidden="true"`, no caption. Load error (`onError`) → render the caption **text alone** for meaningful figures, nothing for decorative. Overlay layer: `position: absolute; inset: 0; pointer-events: none`. Figures NEVER dispatch engine actions (D9/T3). **The fail-soft caption must NOT be a `<figcaption>`** — a `figcaption` outside a `figure` is invalid HTML and fails axe. Use a `<span>`. |
| L12 | Percentage denominator (D1a)                                   | Read `viewBox` off the live `<svg>` inside the wrapper (`wrapper.querySelector('svg')?.getAttribute('viewBox')`), parse `0 0 W H`; absent/invalid → render nothing. Re-read whenever the snapshot changes. `svgShell` always emits `viewBox="0 0 W H"` (`svg-kit/src/shell.ts:13`).                                                                                                                                                                                                                                                                                         |
| L13 | Example fixture alt text                                       | Ships as the literal `alt` value on the figure spec in `examples/interactive-demo/nodes/diagram-figure.json`. Course copy never enters the framework locale files.                                                                                                                                                                                                                                                                                                                                                                                                          |
| L14 | T6 (engine repo)                                               | **Out of scope.** Do not edit `../openedu-interactive`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## 2. Pre-verified facts (cite these; do not re-grep)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Every engine snapshot is `{...state, scene, svgResult}`; `svgResult.a11y` rows are `{id, role, label, children}` (label only)                                                                                                                                                                                                                                                                                 | engine `snapshot()` bodies cited in L2; `svg-kit/src/a11y.ts:19-21`                                                                      |
| diagram's `alternative` rows: `{kind:'node', id, nodeId, label, description}`, `{kind:'edge', …}`, `{kind:'cycle', id:'cycle-a-b', members:['a','b'], label:'Cycle: a → b'}`                                                                                                                                                                                                                                  | `diagram/render/svg.ts:91-97, 118-127, 138-145`; row type `diagram/render/types.ts:8-21`                                                 |
| `SceneNode` = `{id, bounds?, label?, description?, metadata?: Record<string, unknown>, children: SceneNode[], hidden?}`                                                                                                                                                                                                                                                                                       | `diagram/src/scene/types.ts:12-24`                                                                                                       |
| `assetMap` is `Map<string, ArrayBuffer>`; `resolveAsset` normalizes `/`, `./`, `../`, `assets/` and caches blob URLs                                                                                                                                                                                                                                                                                          | `packages/runtime/src/context/RuntimeContext.tsx:233-268`                                                                                |
| `RuntimeContext`'s context value is a `useMemo` with an **explicit dependency array** — a new member must be added there                                                                                                                                                                                                                                                                                      | `RuntimeContext.tsx:277-296` (value) and `:304-322+` (deps, `resolveAsset` listed at `:322`)                                             |
| geomap `source.uri` does `JSON.parse(resolved)` and throws `RESOURCE_ERROR` on any non-JSON — so a blob URL breaks it                                                                                                                                                                                                                                                                                         | `geomap/src/scene/build.ts:25-36`                                                                                                        |
| The loader inlines `openedu://geo/…` URIs into `source.data` and deletes the uri, so **no `openedu://` branch is needed** at the bridge                                                                                                                                                                                                                                                                       | `packages/core` geo-asset resolution; proven by `examples/interactive-demo/validate.test.ts:71-75`                                       |
| `InteractiveNodeConfigSchema` and `InteractiveNodeSchema` are both `.strict()` and both spread `interactiveConfigShape`                                                                                                                                                                                                                                                                                       | `packages/schemas/src/nodes.ts:107-115, 164-167, 211-213`                                                                                |
| The shell renders its "Next" button **only for `type: 'lesson'` nodes** (`showNextButton = isLesson && …`); interactive nodes have their own "Mark complete", which auto-advances                                                                                                                                                                                                                             | `packages/runtime/src/layout/LayoutShell.tsx:49, 86-98`; `InteractiveRenderer.tsx:169-173`                                               |
| `examples/interactive-demo/workflow.json` chain: intro.md → number-line → number-line-practice → composed-lesson → geomap-identify-odisha → practice-1789269990946 → `COMPLETED`                                                                                                                                                                                                                              | `examples/interactive-demo/workflow.json:2-21`                                                                                           |
| `examples/interactive-demo/validate.test.ts:12` asserts `pkg.nodes` length **5** — adding a node breaks it unless updated                                                                                                                                                                                                                                                                                     | same file                                                                                                                                |
| **E2E baseline on this branch (measured):** in the `interactive-demo` describe, 2 pass and **2 fail** — "number-line practice shows prompt and label click" and "completes the full interactive journey". Both fail for the same reason: they click the shell "Next" button on an **interactive** node, where it does not exist (fact above). Correct idiom: `Mark complete`, then the runtime auto-advances. | `tests/e2e/package-execution.spec.ts:405-442`, reproduced with `pnpm test:e2e tests/e2e/package-execution.spec.ts -g "interactive-demo"` |
| The hardcoded-strings lint scans only `packages/runtime/src/{renderers,layout,components}`; the inline-styles lint scans only runtime/design-system/website — `packages/interactive-runtime/src` is unscanned by both                                                                                                                                                                                         | `scripts/lint-no-hardcoded-strings.mjs:21-27`, `scripts/lint-no-inline-styles.mjs:7`                                                     |
| `scripts/check-tailwind-css.mjs` only scans `packages/runtime/src` — nothing will warn you that interactive-runtime classes are missing from the generated CSS; you must add the content glob and regenerate manually                                                                                                                                                                                         | `scripts/check-tailwind-css.mjs:7`                                                                                                       |
| Neither Tailwind config scans `packages/interactive-runtime/src` today                                                                                                                                                                                                                                                                                                                                        | `apps/learner/tailwind.config.ts:23-29`; `apps/dev-server/tailwind.config.js`                                                            |

---

## 3. Phase 1 — T0 change signal + T1 alternative list

**Commits:** `feat(runtime): refresh the engine snapshot on lifecycle events` and
`feat(interactive-runtime): render alternative-only content (cycles + descriptions)`.

This phase is first because T1 is the snapshot's first consumer: it makes T0 observable and gives
the phase real tests. T4 (schema) and T2 (resolver) are only needed by T3.

### 3.1 `packages/runtime/src/renderers/InteractiveRenderer.tsx`

1. Extend the imports (line 3-9) with the type `InteractiveNodeHandle` and, in Phase 1, the
   component/helpers from `@open-edu/interactive-runtime`.
2. Add the snapshot type + refresh predicate near the existing `EngineEvent` type (line 22-27).
   Note `scene.nodes`, not `nodes` (L2):

   ```tsx
   interface EngineSceneNode {
     id: string;
     kind?: string;
     bounds?: { x: number; y: number; width: number; height: number };
     metadata?: Record<string, unknown>;
     children?: EngineSceneNode[];
     hidden?: boolean;
   }

   interface EngineSnapshot {
     scene?: { nodes?: EngineSceneNode[] };
     svgResult?: { alternative?: unknown[] };
   }

   /** Lifecycle events after which the host re-reads the engine snapshot (L3). */
   export function shouldRefreshSnapshot(eventName: string): boolean {
     return eventName === 'engine-ready' || eventName.endsWith('state-changed');
   }
   ```

3. Add the handle ref, state, and the refresh callback **above** `handleEngineEvent` (line 68):

   ```tsx
   const engineHandleRef = useRef<InteractiveNodeHandle | null>(null);
   const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot | null>(null);

   const refreshSnapshot = useCallback(() => {
     const snapshot = engineHandleRef.current?.snapshot() as EngineSnapshot | undefined;
     setEngineSnapshot(snapshot ?? null);
   }, []);
   ```

4. **Two** `onReady` callbacks (L4 — the handle types differ, one callback will not typecheck):

   ```tsx
   const handleNodeReady = useCallback((handle: InteractiveNodeHandle) => {
     engineHandleRef.current = handle; // single-engine only (L5)
     setIsReady(true);
   }, []);

   const handleLessonReady = useCallback(() => {
     setIsReady(true); // composed: no handle, no layers (L5)
   }, []);
   ```

   Pass `onReady={handleNodeReady}` to `InteractiveNodeView` and
   `onReady={handleLessonReady}` to `InteractiveLessonView` (lines 158, 165).

5. First statement of `handleEngineEvent` (line 69):

   ```tsx
   if (shouldRefreshSnapshot(event.name)) refreshSnapshot();
   ```

   Add `refreshSnapshot` to that `useCallback`'s dependency array.

6. Point the bridge at the new resolver **later** (Phase 3, step 3) — for now leave line 102 alone.

7. Render the alternative list after the `WidgetErrorBoundary` block (line 168), before the
   "Mark complete" row:

   ```tsx
   {
     !isComposedLesson(node) && (
       <AlternativeList
         title={t('runtime.interactive.alternative.title')}
         cycleLabel={t('runtime.interactive.alternative.cycleLabel')}
         rows={extractAlternativeRows(
           engineSnapshot?.svgResult?.alternative as AlternativeRowLike[],
         )}
       />
     );
   }
   ```

   `AlternativeList` returns `null` for an empty row list, so visual/chart/timeline engines and a
   not-yet-ready snapshot render nothing (L6).

### 3.2 i18n — `packages/i18n/locales/en/runtime.json` (additive, flat)

```json
"interactive.alternative.title": "Text alternative",
"interactive.alternative.cycleLabel": "Cycle",
```

### 3.3 New `packages/interactive-runtime/src/alternative-list.tsx`

```tsx
export interface AlternativeRowLike {
  kind?: string;
  id?: string;
  label?: string;
  description?: string;
  members?: string[];
}

export interface AlternativeRowView {
  id: string;
  kind: 'cycle' | 'node';
  text: string;
}

/**
 * Keep only the alternative rows that add information beyond svgResult.a11y:
 * cycle rows (no a11y counterpart) and node rows carrying a description
 * (a11y node rows carry a label only). Edge rows are always excluded — the
 * a11y edge label already announces the relationship. Rows without `kind`
 * (geomap) are intentionally skipped.
 */
export function extractAlternativeRows(
  alternative: AlternativeRowLike[] | undefined,
): AlternativeRowView[] {
  const rows: AlternativeRowView[] = [];
  for (const row of alternative ?? []) {
    if (row.kind === 'cycle') {
      rows.push({
        id: row.id ?? `cycle-${rows.length}`,
        kind: 'cycle',
        text: row.label ?? (row.members ?? []).join(' → '),
      });
    } else if (row.kind === 'node' && row.description) {
      rows.push({ id: row.id ?? `node-${rows.length}`, kind: 'node', text: row.description });
    }
  }
  return rows;
}

export interface AlternativeListProps {
  title: string;
  cycleLabel: string;
  rows: AlternativeRowView[];
}

export function AlternativeList({
  title,
  cycleLabel,
  rows,
}: AlternativeListProps): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <details
      className="border-outline-variant bg-surface mt-4 rounded-lg border px-4 py-3"
      data-testid="interactive-alternative"
    >
      <summary className="text-on-surface cursor-pointer text-sm font-medium">{title}</summary>
      <ul className="text-body-ui text-muted-foreground mt-2 list-disc space-y-1 pl-5">
        {rows.map((row) => (
          <li key={row.id} data-kind={row.kind}>
            {row.kind === 'cycle' && (
              <span className="border-outline-variant text-muted-foreground mr-2 rounded-sm border px-1.5 py-0.5 text-xs uppercase tracking-wide">
                {cycleLabel}
              </span>
            )}
            {row.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
```

Export `AlternativeList`, `extractAlternativeRows`, and the two types from
`packages/interactive-runtime/src/index.ts`.

`JSX.Element` matches the existing convention (`InteractiveRenderer.tsx:52`); if `tsc` rejects the
global `JSX` namespace in this package, use `React.JSX.Element` — do not restructure the component.

### 3.4 Tailwind content globs (do this in this phase — the classes above need them)

Add to the `content` array in BOTH configs, keeping existing entries:

- `apps/learner/tailwind.config.ts`: `'../../packages/interactive-runtime/src/**/*.{ts,tsx}',`
- `apps/dev-server/tailwind.config.js`: `resolve(__dirname, '../../packages/interactive-runtime/src/**/*.{ts,tsx}'),`

Regenerate the dev-server CSS at the end of this phase (not just Phase 5):

```bash
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

Commit the regenerated `apps/dev-server/src/tailwind.css`.

### 3.5 Tests

New `packages/interactive-runtime/test/alternative-list.test.tsx` (the package already runs jsdom

- Testing Library via `src/test-setup.ts`; test globs cover `test/**/*.test.{ts,tsx}`):

* `extractAlternativeRows`: cycle row with `label`; cycle row without `label` falls back to
  `members.join(' → ')`; node row with `description` included; node row without `description`
  excluded; **edge row excluded**; row with no `kind` (geomap shape) excluded; `undefined`/empty →
  `[]`.
* `AlternativeList`: `null` for empty rows; `<details>` + summary renders `title`; cycle row shows
  the badge and `data-kind="cycle"`; node row has no badge; axe audit on the rendered list.

Extend `packages/runtime/src/renderers/InteractiveRenderer.test.tsx`:

- `shouldRefreshSnapshot`: `engine-ready` → true; `state-changed` → true;
  `interaction-started` / `interaction-completed` / `engine-mounted` → false.
- Diagram node (use the exact fixture spec from §7.2, with descriptions on both nodes):
  after mount, `interactive-alternative` is in the document and contains the cycle text
  `Cycle: a → b` (cycle labels use authored ids, §2) — this proves `engine-ready` → snapshot →
  render end-to-end.
- **No-duplication guard:** inside the alternative region, the node label `Stage A` does **not**
  appear (the engine's live region announces it) — `within(region).queryByText('Stage A')` is null
  while `container.textContent` contains it.
- Visual node (existing number-line case): **no** `interactive-alternative` element.
- Composed-lesson node (existing case): still renders, no alternative region, no crash.

**Phase exit:** §0.3 loop green.

---

## 4. Phase 2 — T4: `figures` schema (`packages/schemas`)

**Commit: `feat(schemas): add figures map to interactive node config`**

### 4.1 `packages/schemas/src/nodes.ts`

1. Above `interactiveConfigShape` (line 107), add:

   ```ts
   const FigureSpecSchema = z.discriminatedUnion('decorative', [
     z.object({ ref: z.string().min(1), decorative: z.literal(true) }).strict(),
     z
       .object({
         ref: z.string().min(1),
         alt: z.string().min(1),
         decorative: z.literal(false).optional(),
       })
       .strict(),
   ]);

   export type FigureSpec = z.infer<typeof FigureSpecSchema>;
   ```

2. Add to `interactiveConfigShape` (line 107-115):
   `figures: z.record(z.string(), FigureSpecSchema).optional(),`
3. **Also add `figures?: Record<string, FigureSpec>;` to the hand-mirrored
   `InteractiveConfigValue` type (line 117-125).** It is a manual mirror of the shape used by the
   refine function; leaving it stale violates the repo's "schemas are the source of truth" rule.
4. Do **not** touch `refineInteractiveNodeConfig` (line 127) — `figures` is orthogonal to the
   single/composed discrimination and is legal on both forms (only single-engine nodes use it).

**Why `.strict()` on both union options is load-bearing** (verified against zod 3.25.76): with a
plain `z.object`, unknown keys are stripped, so `{ref, decorative: true, alt}` parses and
**silently drops `alt`** — shipping a figure the author marked decorative while their alt text
disappears.

### 4.2 `packages/schemas/src/nodes.test.ts`

Extend the interactive-node describe with this exact matrix (parse a minimal single-engine node):

| Input                                           | Expect                                     |
| ----------------------------------------------- | ------------------------------------------ |
| `{ ref: 'a.svg', alt: 'k' }`                    | pass                                       |
| `{ ref: 'a.svg', alt: 'k', decorative: false }` | pass                                       |
| `{ ref: 'a.svg', decorative: true }`            | pass                                       |
| `{ ref: 'a.svg', decorative: true, alt: 'k' }`  | **fail** (the case `.strict()` exists for) |
| `{ ref: 'a.svg' }`                              | fail                                       |
| `{ ref: '', alt: 'k' }`                         | fail                                       |
| `{ alt: 'k' }` (no `ref`)                       | fail                                       |
| `{ ref: 'a.svg', alt: 'k', surprise: 1 }`       | fail (unknown key)                         |
| node without `figures`                          | pass (optional)                            |

Also assert the inferred type is usable: parse a node and read
`node.figures?.['a']?.alt`.

**Phase exit:** §0.3 loop green (`@open-edu/runtime` still typechecks — nothing reads `figures` yet).

---

## 5. Phase 3 — T2: `resolveEngineAsset`

**Commits:** `feat(interactive-runtime): add engine asset resolution helpers`,
`feat(runtime): route engine asset resolution through the runtime context`.

### 5.1 New `packages/interactive-runtime/src/asset-resolution.ts`

```ts
const DATA_ASSET_EXTENSIONS = ['.json', '.geojson', '.topojson'];

/**
 * Normalize an asset id exactly as RuntimeContext.resolveAsset does: strip a
 * leading "/", leading "./" or "../" segments, and a leading "assets/".
 */
export function normalizeAssetKey(path: string): string {
  return (path ?? '')
    .replace(/^\//, '')
    .replace(/^(?:\.\.?\/)*/, '')
    .replace(/^assets\//, '');
}

/** Data assets resolve to decoded file contents; everything else to a URL. */
export function isDataAssetId(id: string): boolean {
  const lower = (id ?? '').toLowerCase();
  return DATA_ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
```

### 5.2 New `packages/interactive-runtime/test/asset-resolution.test.ts`

Cover: `assets/foo.json` → `foo.json`; `./x.geojson` → `x.geojson`; `/assets/y.png` → `y.png`;
`../z.topojson` → `z.topojson`; bare `foo.json` unchanged; `''` → `''`. `isDataAssetId`: true for
`.json` / `.geojson` / `.topojson` including uppercase `DATA.JSON`; false for `.png`, `.svg`, no
extension, and `''`.

### 5.3 `packages/runtime/src/context/RuntimeContext.tsx`

1. Import the helpers from `@open-edu/interactive-runtime` (the runtime package already depends on
   it).
2. Add `resolveEngineAsset: (id: string) => string;` to `RuntimeContextValue` next to
   `resolveAsset` (line 69). This interface has exactly one implementation (the provider) — no
   no-op/fallback context to update.
3. Implement directly below `resolveAsset` (which ends at line 268), delegating to it rather than
   forking the cache:

   ```tsx
   const resolveEngineAsset = useCallback(
     (id: string): string => {
       const normalized = normalizeAssetKey(id);
       if (!normalized) return '';
       if (isDataAssetId(normalized)) {
         const data = loadedPackage.assetMap?.get(normalized);
         if (data) return new TextDecoder().decode(data);
         console.warn(
           `[resolveEngineAsset] data asset "${normalized}" not found for "${loadedPackage.manifest.id}". Available keys:`,
           loadedPackage.assetMap ? Array.from(loadedPackage.assetMap.keys()) : 'no assetMap',
         );
         return '';
       }
       return resolveAsset(normalized);
     },
     [loadedPackage.assetMap, loadedPackage.manifest.id, resolveAsset],
   );
   ```

4. Add `resolveEngineAsset` to the context `value` object (next to `resolveAsset`, line 296) **and
   to that `useMemo`'s dependency array** (the `resolveAsset` entry is at line 322). Skipping the
   dep array yields a stale resolver.

**Why `''` for a missing data asset:** geomap does `JSON.parse(resolved)` and throws its own
`RESOURCE_ERROR` on anything non-JSON (`geomap/src/scene/build.ts:25-36`), so an empty string
yields the engine's own correct error. Never return bytes — the `string | Uint8Array` union in the
engine host type is misleading; the bytes branch also throws.

### 5.4 `packages/runtime/src/renderers/InteractiveRenderer.tsx`

Point the bridge at the new seam (line 102):

```tsx
resolveAsset: (id) => runtimeRef.current?.resolveEngineAsset(id) ?? `/assets/${id}`,
```

**No `openedu://` branch, no fetch fallback.** By bridge time those URIs no longer exist — the
loader inlines the data at load time (§2), so such a branch would be dead code.

### 5.5 Tests

In `InteractiveRenderer.test.tsx`, extend the existing `makePackage` helper to build an `assetMap`
(`new Map([['figure.svg', new TextEncoder().encode('<svg/>').buffer]])`-style) and add:

- a geomap node whose `content.geography.sources[0]` is `{ id, type: 'geojson', uri: 'assets/data.geojson' }`
  with that file in the assetMap → the engine mounts with **no** `RESOURCE_ERROR` (this is the real
  regression this phase fixes: today the host hands geomap a `blob:` URL and `JSON.parse` throws);
- an image id resolves to a URL (assert it starts with `blob:` or `/assets/`);
- both `assets/foo.json` and `foo.json` keys resolve;
- the resolver always returns a `string` (never bytes).

If `RuntimeContext` has its own test file, mirror the data-asset case there too.

**Phase exit:** §0.3 loop green.

---

## 6. Phase 4 — T3: `FigureOverlay`

**Commit: `feat(interactive-runtime): position host figures beside engine scene nodes`**

### 6.1 New `packages/interactive-runtime/src/figure-overlay.tsx`

```tsx
import { useEffect, useRef, useState, type RefObject } from 'react';

export interface SceneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneNodeLike {
  id: string;
  kind?: string;
  bounds?: SceneBounds;
  metadata?: Record<string, unknown>;
  children?: SceneNodeLike[];
  hidden?: boolean;
}

export interface FigureSpecView {
  ref: string;
  alt?: string;
  decorative?: boolean;
}

export interface FigurePlacement {
  key: string;
  spec: FigureSpecView;
  left: number;
  top: number;
  width: number;
  height: number;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The authored id, per engine (L10). */
export function authoredIdOf(node: SceneNodeLike): string | undefined {
  const meta = node.metadata ?? {};
  const metaId = asString(meta.nodeId) ?? asString(meta.entityId) ?? asString(meta.rowId);
  if (metaId) return metaId;
  if (node.kind === 'event-marker') return asString(node.id);
  return undefined;
}

/** Depth-first over the scene tree; one figure per figures key, first match wins. */
export function collectFigurePlacements(
  nodes: SceneNodeLike[] | undefined,
  figures: Record<string, FigureSpecView>,
  canvas: { width: number; height: number },
): FigurePlacement[] {
  const placements: FigurePlacement[] = [];
  const used = new Set<string>();
  const walk = (list: SceneNodeLike[] | undefined): void => {
    for (const node of list ?? []) {
      const id = authoredIdOf(node);
      if (id && !used.has(id) && figures[id] && node.bounds && !node.hidden) {
        used.add(id);
        const b = node.bounds;
        placements.push({
          key: id,
          spec: figures[id],
          left: (b.x / canvas.width) * 100,
          top: (b.y / canvas.height) * 100,
          width: (b.width / canvas.width) * 100,
          height: (b.height / canvas.height) * 100,
        });
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return placements;
}

export interface FigureOverlayProps {
  figures: Record<string, FigureSpecView>;
  snapshotNodes: SceneNodeLike[] | undefined;
  /** Ref to the wrapper element that contains the engine's live <svg>. */
  surfaceRef: RefObject<HTMLElement | null>;
  resolve: (ref: string) => string;
}

export function FigureOverlay({
  figures,
  snapshotNodes,
  surfaceRef,
  resolve,
}: FigureOverlayProps): JSX.Element | null {
  const [canvas, setCanvas] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const failureVersion = useRef(0);

  useEffect(() => {
    failureVersion.current += 1;
    setFailed(new Set());
    const viewBox = surfaceRef.current?.querySelector('svg')?.getAttribute('viewBox');
    const parts = (viewBox ?? '').split(/[\s,]+/).map(Number);
    const width = parts[2];
    const height = parts[3];
    setCanvas(
      parts.length === 4 &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width! > 0 &&
        height! > 0
        ? { width: width!, height: height! }
        : null,
    );
  }, [surfaceRef, snapshotNodes]);

  if (!canvas) return null;
  const placements = collectFigurePlacements(snapshotNodes, figures, canvas);

  return (
    <div
      data-testid="figure-overlay"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
    >
      {placements.map(({ key, spec, left, top, width, height }) => {
        const style = {
          position: 'absolute' as const,
          left: `${left}%`,
          top: `${top}%`,
          margin: 0,
        };
        if (failed.has(key)) {
          if (spec.decorative === true || !spec.alt) return null;
          return (
            <span
              key={key}
              style={style}
              data-testid="figure-caption"
              className="text-body-ui text-muted-foreground"
            >
              {spec.alt}
            </span>
          );
        }
        return (
          <figure key={key} style={{ ...style, width: `${width}%`, height: `${height}%` }}>
            <img
              src={resolve(spec.ref)}
              alt={spec.decorative === true ? '' : (spec.alt ?? '')}
              aria-hidden={spec.decorative === true || undefined}
              className="h-full w-full object-contain"
              onError={() => setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))}
            />
          </figure>
        );
      })}
    </div>
  );
}
```

Notes — do not deviate:

- All inline styles are confined to this file (rule 2).
- The effect resets the failed set whenever a new snapshot arrives, so a transient load error does
  not permanently hide a figure (`failureVersion` exists so the reset is unconditional; if `tsc`
  flags it as unused, delete the ref and keep the `setFailed(new Set())` reset).
- No caption in the success path (the `alt` attribute is the text channel, D8/D9); the caption is
  the fail-soft fallback only (L11), rendered as a `<span>`, never a bare `<figcaption>`.
- The overlay never dispatches engine actions (spec T3).

Export `FigureOverlay`, `collectFigurePlacements`, `authoredIdOf` and their types from `index.ts`.

### 6.2 `packages/runtime/src/renderers/InteractiveRenderer.tsx`

1. `const surfaceRef = useRef<HTMLDivElement>(null);`
2. Wrap the existing `WidgetErrorBoundary` block (lines 148-168) in a positioned container and add
   the overlay as its sibling — **note `snapshot.scene.nodes`, not `snapshot.nodes`** (L2):

   ```tsx
   <div className="relative" ref={surfaceRef}>
     <WidgetErrorBoundary widgetId={interactiveId} message={t('runtime.interactive.load_error')}>
       {/* existing InteractiveLessonView / InteractiveNodeView branch, unchanged */}
     </WidgetErrorBoundary>
     {!isComposedLesson(node) && engineSnapshot && node.figures && (
       <FigureOverlay
         figures={node.figures}
         snapshotNodes={engineSnapshot.scene?.nodes}
         surfaceRef={surfaceRef}
         resolve={(ref) => runtimeRef.current?.resolveEngineAsset(ref) ?? `/assets/${ref}`}
       />
     )}
   </div>
   ```

   Figure `alt` text is literal authored copy (L13), so the overlay needs no `translate`/`t()`
   wiring here. Keep the "Mark complete" row outside this wrapper.

### 6.3 Tests

New `packages/interactive-runtime/test/figure-overlay.test.tsx`:

- `authoredIdOf`: diagram `metadata.nodeId`; geomap `metadata.entityId`; chart `metadata.rowId`;
  timeline `event-marker` → its `id`; timeline `event-span` → `undefined`; no metadata → `undefined`.
- `collectFigurePlacements`: percentage math (`x 610 / W 760` → `80.26…`); **one figure per key** —
  two nodes sharing `rowId` `r1` yield ONE placement (first in tree order); node without `bounds`
  skipped; **`hidden: true` node skipped**; unmatched figure key skipped; nested `children` walked.
- `FigureOverlay` DOM (pass a plain lambda for `resolve`; no engine mount needed):
  with a wrapper containing `<svg viewBox="0 0 760 400">`, the `img` renders with the resolved
  `src`; a decorative figure has `alt=""` **and** `aria-hidden`; **absent/invalid viewBox → renders
  nothing**; `fireEvent.error(img)` on a meaningful figure → `figure-caption` with the alt text and
  no `img`; `fireEvent.error` on a decorative figure → nothing rendered.
- axe audit on the rendered overlay.

Extend `InteractiveRenderer.test.tsx` (diagram node from §3.5, now with
`figures: { a: { ref: 'assets/water-cycle.svg', alt: 'Simple sketch of the water cycle' } }`
and `water-cycle.svg` bytes in the assetMap):

- `figure-overlay` testid is present and the `img` `alt` equals the literal authored string
  (`'Simple sketch of the water cycle'`);
- clicking the figure emits **zero** engine events (spy `runtime.emitTelemetry` around a
  `fireEvent.click(img)`; no `interactive_interaction` event);
- an unresolvable `ref` degrades to the caption with no `img`;
- the composed-lesson node renders **no** `figure-overlay` (L5).

**Phase exit:** §0.3 loop green.

---

## 7. Phase 5 — Example fixture, e2e, docs

**Commits:** `feat(examples): add a diagram figure node to interactive-demo`,
`test(e2e): cover the figure overlay and alternative list`, `docs: describe the host figure seam`.

### 7.1 `examples/interactive-demo/assets/water-cycle.svg` (new)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" width="120" height="60" role="img">
  <title>Water cycle sketch</title>
  <circle cx="20" cy="30" r="10" fill="none" stroke="currentColor"/>
  <path d="M40 30 H 80" stroke="currentColor" fill="none"/>
  <rect x="90" y="20" width="20" height="20" fill="none" stroke="currentColor"/>
</svg>
```

### 7.2 `examples/interactive-demo/nodes/diagram-figure.json` (new)

Adapted from the engine's validated `cycle` fixture (`diagram-engine/fixture/cycle/input.diagram.json`
— `validation.json` = valid), with descriptions on both nodes (so the AlternativeList exercises
node descriptions) and a figure on authored node `a`:

```json
{
  "type": "interactive",
  "title": "Two-stage water cycle",
  "engine": "diagram",
  "figures": {
    "a": { "ref": "assets/water-cycle.svg", "alt": "Simple sketch of the water cycle" }
  },
  "spec": {
    "type": "diagram",
    "version": "1.0.0",
    "id": "simple-cycle-figure",
    "metadata": { "title": "Two-stage water cycle" },
    "purpose": { "learningObjective": "Understand a cyclical process" },
    "content": {
      "kind": "cycle",
      "nodes": [
        { "id": "a", "label": "Stage A", "description": "Water enters the cycle." },
        { "id": "b", "label": "Stage B", "description": "Water leaves the cycle." }
      ],
      "edges": [
        { "from": "a", "to": "b", "relationship": "leads-to" },
        { "from": "b", "to": "a", "relationship": "leads-to" }
      ]
    },
    "interaction": { "mode": "explore", "actions": ["select", "deselect", "focus", "reset"] },
    "questions": [],
    "sources": [{ "class": "illustrative" }],
    "accessibility": { "label": "Simple cycle between Stage A and Stage B" }
  }
}
```

### 7.3 `examples/interactive-demo/workflow.json`

Insert the node after geomap and re-point geomap's `onComplete` (lines 15-17 become):

```json
"nodes/geomap-identify-odisha.json": {
  "onComplete": "nodes/diagram-figure.json"
},
"nodes/diagram-figure.json": {
  "onComplete": "nodes/practice-1789269990946.json"
},
```

Leave `nodes/practice-1789269990946.json → COMPLETED` unchanged.

### 7.4 `examples/interactive-demo/validate.test.ts` (must be updated — node count)

- `expect(pkg.nodes).toHaveLength(5)` → `toHaveLength(6)`.
- Add a routing assertion for `nodes/diagram-figure.json`.
- Add a block asserting the new node survived schema validation **through the real loader** (this
  is the end-to-end proof that `figures` is accepted by the strict schema):

  ```ts
  const figure = pkg.nodes.find((n) => n.relativePath === 'nodes/diagram-figure.json');
  expect(figure?.node.type).toBe('interactive');
  if (figure?.node.type === 'interactive') {
    expect(figure.node.engine).toBe('diagram');
    expect(figure.node.figures?.a?.ref).toBe('assets/water-cycle.svg');
    expect(figure.node.figures?.a?.alt).toBe('Simple sketch of the water cycle');
  }
  ```

### 7.5 i18n — `packages/i18n/locales/en/runtime.json`

The figure's alt text ships as the literal `alt` on the node's `figures` spec (§7.1), not here.
Only framework chrome keys belong in the runtime namespace — for this feature that means the
`interactive.alternative.*` keys from §3.2.

### 7.6 `tests/e2e/package-execution.spec.ts` — interactive-demo block only

**Navigation rule (verified, §2):** the shell's "Next" button renders only on `type: 'lesson'`
nodes, so it exists on `intro.md` and nowhere else. Interactive nodes expose "Mark complete", and
completing auto-advances. The two currently-failing tests fail precisely because they click "Next"
on interactive nodes. **Use `Mark complete` and let the runtime advance — do not click "Next" after
the first step.** Fixing those two tests is required to reach the new node anyway; do not attempt
any other change to the preview chrome.

1. `number-line practice shows prompt and label click` (line 405): replace the
   `Mark complete → Next` pair (lines 411) with a single `Mark complete` click, then assert the
   next node arrived:

   ```ts
   await page.getByRole('button', { name: 'Mark complete' }).click();
   await expect(page.getByRole('heading', { name: 'Timeline drives visual focus' })).toBeVisible({
     timeout: 5000,
   });
   ```

   (composed-lesson.json's title, per its manifest — verify the exact string in the file.)

2. `completes the full interactive journey` (line 420): walk the whole chain with `Mark complete`,
   asserting each heading, and end on the exercise node:

   ```ts
   await page.goto(server.url);
   await openStudioPreview(page);
   await page.getByRole('button', { name: 'Next' }).click(); // intro → number-line
   for (const heading of [
     'Number line',
     'Number line practice',
     'Timeline drives visual focus',
     'Identify Odisha (guided)',
     'Two-stage water cycle',
   ]) {
     await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 });
     const markComplete = page.getByRole('button', { name: 'Mark complete' });
     await expect(markComplete).toBeEnabled({ timeout: 5000 });
     await markComplete.click();
   }
   await expect(page.getByRole('heading', { name: 'Identify the Capital of Odisha' })).toBeVisible({
     timeout: 5000,
   });
   ```

   The old final assertion ("You have completed this learning experience.") is not reachable from
   this walk — the chain ends on an `exercise` node with its own control. Do not assert it here;
   the loop above is the journey guarantee.

3. New test for the feature (place it after the journey test):

   ```ts
   test('renders host figures and the text alternative beside diagram nodes', async ({ page }) => {
     await page.goto(server.url);
     await openStudioPreview(page);
     await page.getByRole('button', { name: 'Next' }).click();
     for (const heading of [
       'Number line',
       'Number line practice',
       'Timeline drives visual focus',
       'Identify Odisha (guided)',
     ]) {
       await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 });
       const markComplete = page.getByRole('button', { name: 'Mark complete' });
       await expect(markComplete).toBeEnabled({ timeout: 5000 });
       await markComplete.click();
     }

     await expect(page.getByRole('heading', { name: 'Two-stage water cycle' })).toBeVisible({
       timeout: 5000,
     });

     const img = page.locator('[data-testid="figure-overlay"] img');
     await expect(img).toBeVisible();
     await expect(img).toHaveAttribute('alt', 'Simple sketch of the water cycle');

     const alternative = page.getByTestId('interactive-alternative');
     await alternative.locator('summary').click();
     await expect(alternative).toContainText('Cycle');
     await expect(alternative).toContainText('Water enters the cycle.');
   });
   ```

   Missing-asset degradation is covered by unit tests (§6.3) — do not add a deliberately broken
   fixture to the shipped example.

### 7.7 Docs — `docs/ARCHITECTURE.md`

Add one section near the existing runtime/interactive seam, matching the file's heading style:

- Engines are asset-free by contract; the host owns resolution, layout, alt text, and failure.
- `resolveEngineAsset`: `.json` / `.geojson` / `.topojson` → decoded contents string; everything
  else → URL via `resolveAsset`; never bytes; no `openedu://` branch (the loader inlines those).
- `figures` map on the interactive node config; per-engine authored-id join (D11); one figure per
  key; bounds-only anchoring (`kind: "node"` in diagram); hidden scene nodes skipped.
- `AlternativeList`: cycles + node descriptions only, never edges (a11y already announces them);
  plain region, no `aria-live`; composed lessons get neither layer in v1.

### 7.8 Regenerate dev-server CSS if you touched runtime classes

```bash
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css
```

Commit `apps/dev-server/src/tailwind.css` if it changed.

---

## 8. Test matrix (all mandatory)

| File                                                          | New coverage                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/runtime/src/renderers/InteractiveRenderer.test.tsx` | `shouldRefreshSnapshot` truth table; alternative list renders for diagram (cycles + descriptions); no-duplication guard; absent for visual; absent for composed; geomap data-asset regression mounts; image URL branch; `assets/` normalization; resolver returns a string; figure alt text; figure emits zero engine events; degrade-to-caption; no overlay for composed |
| `packages/interactive-runtime/test/alternative-list.test.tsx` | row filter (cycles, node descriptions, edges excluded, geomap rows excluded, empty) · render/null · badge · axe                                                                                                                                                                                                                                                           |
| `packages/interactive-runtime/test/asset-resolution.test.ts`  | normalization (all forms incl. empty) · data-extension discriminator, case-insensitive                                                                                                                                                                                                                                                                                    |
| `packages/interactive-runtime/test/figure-overlay.test.tsx`   | `authoredIdOf` per engine · placement math · one-per-key (chart N:1) · hidden skipped · no-bounds skipped · viewBox missing → null · `onError` → caption (`<span>`) · decorative aria · axe                                                                                                                                                                               |
| `packages/schemas/src/nodes.test.ts`                          | the 9-row `figures` matrix (§4.2)                                                                                                                                                                                                                                                                                                                                         |
| `examples/interactive-demo/validate.test.ts`                  | node count 6 · new routing entry · `figures` survives real-loader schema validation                                                                                                                                                                                                                                                                                       |
| `tests/e2e/package-execution.spec.ts`                         | two pre-existing failures fixed to the `Mark complete` idiom · full journey across all 6 nodes · figure alt text + alternative list                                                                                                                                                                                                                                       |

No test outside these files should change. If one does, re-read §0.1 before editing anything else.

---

## 9. Final acceptance gate

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:e2e -- package-execution
```

All green, then confirm the spec's exit gate concretely:

- [ ] A geomap node whose `source.uri` points at a package-relative `.geojson` mounts — today it
      gets a `blob:` URL and dies in `JSON.parse` (§2, Phase 3 test).
- [ ] A mounted diagram announces each node label exactly once, with cycles and descriptions
      available in the disclosure.
- [ ] A figure resolves, positions from live `viewBox` + scene bounds, and degrades to caption text
      on load error.
- [ ] `pnpm test:e2e tests/e2e/package-execution.spec.ts -g "interactive-demo"` reports **4 passed**
      (baseline today: 2 passed / 2 failed).
- [ ] `git status` shows changes only inside the §0.1 table; nothing under `../openedu-interactive`
      was touched (L14).

Optional manual smoke: `pnpm --filter @open-edu/learner dev`, open the interactive-demo package,
walk to "Two-stage water cycle", confirm the figure sits beside Stage A and the disclosure lists the
cycle plus both descriptions in Light, Dark, and Zen.

Commit per phase with conventional messages. Do not force-push, amend shared history, or open PRs
unless asked.
