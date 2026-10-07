# Detailed Implementation Plan — OpenEdu Animation Specification (OAS v0.1)

For: implementing agent (deepseek-4-flash)
Source plan reviewed: `implementation_plan.md`
Spec: `docs/ANIMATION_SPEC.md` (already committed in this repo)
Repo: `open-edu` monorepo (pnpm workspaces, TypeScript, Vite, Vitest, Tailwind)

Read `AGENTS.md` and `openwiki/quickstart.md` first. Follow all repo conventions (conventional commits, tests with every story, i18n `t()` for user-facing strings, no inline styles, `cn()` from `@open-edu/design-system`, `--oe-*` tokens only).

---

## 0. Review findings — corrections to the source plan (read first)

The source plan is structurally sound. These corrections are REQUIRED before/while implementing:

1. **`core.stepper` does not exist.** Builtin widgets are: `core.matching`, `core.timeline`, `core.multiple-choice`, `science.process-diagram`, etc. (see `packages/widgets/src/builtins/index.ts`). Add the optional `animation` schema to **`science.process-diagram` and `core.timeline` only** — do not invent a stepper.
2. **No dotLottie dependency exists anywhere in the repo** (`pnpm-lock.yaml` has no `lottie`/`dotlottie`). You MUST add `@dotlottie/react-player@^1.6.19` to `@open-edu/runtime`.
3. **`useLiveRegion` already exists** in `@open-edu/accessibility` (`packages/accessibility/src/live-region.tsx`). Use it — do not recreate.
4. **`useReducedMotion` already exists** in `@open-edu/design-system` (`src/tokens/motion.ts`), but it reads a theme CSS var, NOT the OS setting. For OAS you need OS-level detection: use `window.matchMedia('(prefers-reduced-motion: reduce)')` (pattern already used in `apps/learner/src/components/Pipili.tsx:34`).
5. **Widgets already declare `supportsAnimation`** (see `ProcessDiagram.tsx` capabilities). The catalog work is adding the string `'Animation'` to catalog entries' `capabilities: string[]` in `widget-catalog-source.ts`, NOT a new capability key.
6. **`course-compiler` does NOT depend on `@open-edu/schemas`** (it has its own `src/schemas/course-model.ts`). Add `@open-edu/schemas: workspace:*` as a dependency to reuse `AnimationConfigSchema` in the new validator.
7. **`.lottie`/`.svg` asset preservation already works** in `oep-distribution` — `collectCourseFiles` in `packages/cli/src/commands/oep-build.ts:12` walks all files with no extension filter, and `OepWriter` zips arbitrary bytes. Phase 6 there is **tests only** (regression coverage), no production change.
8. **i18n namespaces are a fixed const** `['runtime','learner','widgets','schemas','studio']` (`packages/i18n/src/namespaces.ts`). Do NOT add a new namespace. New runtime strings go under `runtime.animation.*` in `packages/i18n/locales/en/runtime.json`; new widget strings under `widgets.*` in `widgets.json`.
9. **`pnpm --filter @open-edu/widgets generate:catalog` writes `packages/core/src/widget-catalog-data.json`** (from the canonical `widget-catalog-source.ts`). Regenerate it after adding `core.process-explainer`; it is committed and consumed by `@open-edu/core`.
10. **`scripts/lint-no-hardcoded-strings.mjs` scans `packages/runtime/src/components`, `renderers`, `layout` and `apps/learner/src`.** Every new runtime component MUST use `t()` from `@open-edu/i18n`. Widgets are not scanned, but still use `t()` per AGENTS.md.
11. **After adding/changing Tailwind classes in `packages/runtime/src`, regenerate dev-server CSS**: `pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css`.
12. **A `Pipili` primitive already exists** in `@open-edu/design-system` (`src/primitives/pipili.tsx`, moods `idle|thinking|curious|content|nodding|surprised`) and `apps/learner/src/components/Pipili.tsx`. The new `PipiliMascotAnimation.tsx` in `@open-edu/ai-companion` is ADDITIVE (dotLottie variant); do not delete or modify the existing primitive.

---

## 0.5 Recommended execution order & commits

Work top-down on the dependency graph, one conventional commit per step. Each step MUST land green before the next.

| #   | Scope                                               | Commit subject                                                                                         |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | schemas                                             | `feat(schemas): add OAS animation schemas`                                                             |
| 2   | design-system                                       | `feat(design-system): add OAS motion duration tokens and lottie theme helper`                          |
| 3   | runtime (dep + hook + player + wrapper)             | `feat(runtime): add OAS animation engine (useOasAnimation, DotLottiePlayer, OasAnimationWrapper)`      |
| 4   | ai-companion                                        | `feat(ai-companion): bind Pipili states to OAS dotLottie animations`                                   |
| 5   | widgets (schemas + new process-explainer + catalog) | `feat(widgets): add OAS animation support and core.process-explainer widget`                           |
| 6   | course-compiler                                     | `feat(course-compiler): validate OAS animation configs and assets`                                     |
| 7   | oep-distribution + examples                         | `test(oep-distribution): preserve lottie/svg assets` + `feat(examples): add animated water cycle node` |
| 8   | final verification                                  | `chore: verify full monorepo`                                                                          |

---

## Step 1 — Schemas & Types (`@open-edu/schemas`)

Create `packages/schemas/src/animation.ts` — replicate the Zod schema from `docs/ANIMATION_SPEC.md` §6 exactly, PLUS the dotLottie extras referenced in §7 (`loop`, `speed`, `segments`):

```ts
import { z } from 'zod';

export const AnimationBackendEnum = z
  .enum(['lottie', 'svg', 'css', 'canvas', 'webgpu'])
  .default('lottie');

export const AnimationEffectEnum = z.enum([
  'fade',
  'slide',
  'zoom',
  'pop',
  'appear',
  'highlight',
  'pulse',
  'shake',
  'glow',
  'focus',
  'flow',
  'grow',
  'trace',
  'draw',
  'orbit',
  'rotate',
  'assemble',
  'disassemble',
  'transform',
  'connect',
  'compare',
  'morph',
  'wave',
  'think',
  'celebrate',
  'hint',
  'confetti',
  'sparkle',
  'badge',
  'success',
]);

export const AnimationConfigSchema = z.object({
  backend: AnimationBackendEnum,
  src: z.string().optional().describe('Path to .lottie or .svg asset'),
  loop: z.boolean().optional(),
  speed: z.number().optional(),
  segments: z.tuple([z.number(), z.number()]).optional(),
  trigger: z
    .enum([
      'load',
      'visible',
      'click',
      'hover',
      'step',
      'answer-correct',
      'answer-wrong',
      'lesson-complete',
      'custom',
    ])
    .default('visible'),
  reducedMotion: z.enum(['instant', 'fade', 'static-steps', 'static-pose']).default('instant'),
  effects: z
    .array(
      z.object({
        step: z.number().optional(),
        target: z.string().describe('Target element ID or dotLottie layer key'),
        effect: AnimationEffectEnum,
        duration: z.union([z.enum(['instant', 'fast', 'normal', 'slow']), z.number()]).optional(),
        delay: z.number().optional(),
        easing: z.string().optional(),
        repeat: z
          .union([z.enum(['once', 'loop', 'pingpong']), z.object({ count: z.number() })])
          .optional(),
        direction: z.enum(['forward', 'reverse', 'alternate']).optional(),
      }),
    )
    .optional(),
});

export type AnimationBackend = z.infer<typeof AnimationBackendEnum>;
export type AnimationEffect = z.infer<typeof AnimationEffectEnum>;
export type AnimationConfig = z.infer<typeof AnimationConfigSchema>;
export type AnimationEffectConfig = NonNullable<AnimationConfig['effects']>[number];
```

- Add `export { ... }` + `export type { ... }` for all of the above to `packages/schemas/src/index.ts` (alphabetical placement near other schema groups; match existing export style).
- Create `packages/schemas/src/animation.test.ts` (Vitest, matches `*.test.ts` pattern in that dir). Cover:
  - default `backend` = `'lottie'` when omitted; default `trigger` = `'visible'`; default `reducedMotion` = `'instant'`.
  - a full dotLottie config (with `src`, `loop`, `speed`, `segments`) parses.
  - an SVG config with `effects[]` (target/effect/duration/repeat/direction) parses; `repeat: {count:3}` and `repeat:'loop'` both parse.
  - invalid backend / invalid effect / invalid trigger → `safeParse` returns `success:false`.
  - a config with ALL AI-companion effects (`wave`,`think`,`celebrate`,`hint`) parses.

Verify: `pnpm --filter @open-edu/schemas test && pnpm --filter @open-edu/schemas typecheck`

---

## Step 2 — Design System (`@open-edu/design-system`)

Edit `packages/design-system/src/tokens/motion.ts` (it already exports `motionTokens`, `motionSafe`, `useReducedMotion` — keep those). Add:

1. **OAS duration map**: `instant`→`0ms`, `fast`→`100ms`, `normal`→`200ms`, `slow`→`300ms`. Export `oasDurationToMs(duration: 'instant'|'fast'|'normal'|'slow'|number): string`.
2. **CSS-var mapping helper**: `oasDurationVar(duration): string` returning `var(--oe-motion-duration-${name})` for named durations (matching the semantic names), else the numeric `ms` value.
3. **dotLottie theme color helper** (pure, DOM-free — testable):
   ```ts
   export interface LottieThemeColorMap {
     [variable: string]: string;
   }
   export function lottieThemeColors(prefix = '--oe-color-'): LottieThemeColorMap;
   ```
   It takes an explicit `Record<string,string>` source (mapping a color name e.g. `primary` → a hex) and returns `{ ['--oe-color-' + name]: hex }` entries. Keep it pure; do NOT read `getComputedStyle` here (the wrapper/hook in runtime reads the DOM). Unit-test it in `packages/design-system/src/tokens/__tests__/` (check existing test layout in that dir first and match it).

Notes:

- Do NOT change existing token values or `useReducedMotion` behavior (other components depend on them).
- This file currently imports React (`useState/useEffect`); keep the new helpers side-effect-free.

Verify: `pnpm --filter @open-edu/design-system test && pnpm --filter @open-edu/design-system typecheck`

---

## Step 3 — Core Animation Engine (`@open-edu/runtime`) — the heart of the work

### 3.0 Dependency

Add to `packages/runtime/package.json` dependencies: `"@dotlottie/react-player": "^1.6.19"`.
Run `pnpm install` at repo root.

API facts for `@dotlottie/react-player@1.6.19` (verify against installed `.d.ts`):

- Named exports: `DotLottiePlayer`, `Controls`, `PlayerEvents`, `DotLottieRefProps` (type).
- CSS: `import '@dotlottie/react-player/dist/index.css'`.
- Props: `src` (required; string URL or data object), `autoplay`, `loop`, `speed`, `renderer` (`'svg'|'html'|'canvas'`), `direction` (`1|-1`), `playMode` (`'normal'|'bounce'`), `onEvent`, `lottieRef`, `defaultTheme`.
- Events (`onEvent(event: PlayerEvents)`): `complete`, `error`, `frame`, `freeze`, `loopComplete`, `pause`, `ready`, `stop`.
- `lottieRef` exposes imperative API (`.play()`, `.pause()`, `.stop()`, `.setSpeed(n)`, `.seek(frame)`).

### 3.1 `packages/runtime/src/components/useOasAnimation.ts`

Custom hook. Export:

```ts
export type OasAnimationStatus = 'idle' | 'started' | 'paused' | 'completed';
export interface OasAnimationController {
  status: OasAnimationStatus;
  reducedMotion: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  nextStep: () => void;
  prevStep: () => void;
}
export function useOasAnimation(
  config?: AnimationConfig,
  onStatusChange?: (s: OasAnimationStatus) => void,
): OasAnimationController;
```

Implementation requirements:

- Import `AnimationConfigSchema`/`AnimationConfig` from `@open-edu/schemas`; `safeParse` the config; if invalid or absent → `status` stays `'idle'`, all controls no-ops.
- **Reduced motion**: on mount and via `window.matchMedia('(prefers-reduced-motion: reduce)')` change listener, set `reducedMotion`. When reduced and config present → jump to `'completed'` immediately (static reveal), skip play/pause.
- **Lifecycle**: expose `status`; call `onStatusChange` on transitions. Map dotLottie events to statuses: `ready`/autoplay start → `'started'`, `pause` → `'paused'`, `complete` → `'completed'`. For multi-step configs, track `currentStep`; `nextStep`/`prevStep` clamp to `[0, effects.length]`, set status `'started'`, and call `onStatusChange('started')` (StepChanged).
- **Accessibility**: use `useLiveRegion()` from `@open-edu/accessibility` and announce step changes via `t('runtime.animation.step_changed', { step, total })`. Use the `t` from `useTranslation()` from `@open-edu/i18n`. Also announce completion: `t('runtime.animation.completed')`.
- SSR-safe: no `window`/`matchMedia` access during render — init state in `useEffect`/lazy initializer guarded by `typeof window === 'undefined'`.

### 3.2 `packages/runtime/src/components/DotLottiePlayer.tsx`

Thin, reusable wrapper. Props:

```ts
export interface OasDotLottiePlayerProps {
  src: string;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  segments?: [number, number];
  staticFallback?: ReactNode; // rendered when reducedMotion
  themeColors?: Record<string, string>; // var name -> color, injected as inline CSS vars
  ariaLabel: string; // used for role="img" fallback semantics
  className?: string;
  onEvent?: (status: OasAnimationStatus) => void; // maps PlayerEvents
  onError?: (err: unknown) => void;
}
```

Implementation requirements:

- Wrap `DotLottiePlayer` from `@dotlottie/react-player` (import its CSS once). Use `lottieRef` to drive `play/pause/stop/seek` and `playSegments` (or `seek`+`play`) when `segments` provided.
- Map `PlayerEvents` → `OasAnimationStatus`: `ready`→`started` (when autoplay), `pause`→`paused`, `complete`→`completed`, `error`→ call `onError` + render static fallback.
- **Theme injection**: if `themeColors` provided, wrap in a `<div style={{...themeColors}}>` (CSS-variable references are a sanctioned inline-style exception per AGENTS.md UI rules #10). Do NOT use non-`--oe-*` inline values.
- **Reduced motion**: when reduced, do NOT render the player; render `staticFallback` or a `role="img"` node with `aria-label={ariaLabel}`.
- Export `useOasDotLottiePlayer` helper returning the ref type if useful — optional.

### 3.3 `packages/runtime/src/components/OasAnimationWrapper.tsx`

Composition container for widgets. Props:

```ts
export interface OasAnimationWrapperProps {
  config?: unknown; // raw widget config.animation (validated here)
  assetBaseUrl?: string; // resolves relative `src`
  ariaLabel?: string;
  className?: string;
  onComplete?: () => void;
  staticChildren?: ReactNode; // static SVG/content shown when reduced-motion/instant
}
```

Behavior:

- `safeParse` config with `AnimationConfigSchema`.
- `backend === 'lottie' && src` → render `DotLottiePlayer` (resolve `src` against `assetBaseUrl`), pass `autoplay`/`loop`/`speed`/`segments` from config, theme colors from `lottieThemeColors` read from `document.documentElement` computed style (guard for SSR; safe fallback to `{}`).
- `backend === 'svg' && src` → render an `<img>`/inline `<svg>` (use inline `<img>` to keep it simple) with static reveal; apply reduced-motion instant reveal.
- No src / invalid config → render `staticChildren ?? null`.
- Render the shared control bar (Play / Pause / Resume / Step Back / Step Forward) only when the config declares `trigger`/`interactive`-style playback needs — keep it OPT-IN via a prop `showControls?: boolean` (default false) to avoid noise in observe-mode widgets. All button labels via `t('runtime.animation.*')`.
- Uses `useOasAnimation` for state; announce via `useLiveRegion`.
- a11y: control bar is a `role="group"` with `aria-label={t('runtime.animation.controls')}`; buttons are real `<button>` (use design-system `Button` when no compact icon requirement, or plain buttons with lucide icons — prefer `@open-edu/design-system` `Button`).

### 3.4 Exports

Add to `packages/runtime/src/index.ts`: `useOasAnimation`, `DotLottiePlayer`, `OasAnimationWrapper` + their prop/type exports.

### 3.5 i18n keys

Add to `packages/i18n/locales/en/runtime.json` (namespace `runtime.animation.*`):

```
"animation.play": "Play",
"animation.pause": "Pause",
"animation.resume": "Resume",
"animation.step_back": "Previous step",
"animation.step_forward": "Next step",
"animation.controls": "Animation controls",
"animation.step_changed": "Step {{step}} of {{total}}",
"animation.completed": "Animation complete",
"animation.static_fallback": "Static diagram"
```

Run the i18n key validation test: `node packages/i18n/src/i18n-keys.test.ts`.

### 3.6 Tests (all in `packages/runtime/src/components/__tests__/`, Vitest + @testing-library/react)

- `useOasAnimation.test.ts`:
  - valid config → starts `idle`, `play()` → `'started'`, `pause()` → `'paused'`, `stop()` → `'idle'`, simulate `complete` → `'completed'`.
  - reduced-motion: mock `window.matchMedia` to return `matches:true` → status becomes `'completed'`, no player events.
  - invalid config → stays `'idle'`, no throws.
  - step navigation clamps bounds and fires `onStatusChange`.
  - LiveRegion announcement called on step change (wrap in `LiveRegionProvider`).
- `DotLottiePlayer.test.tsx`:
  - **MUST mock `@dotlottie/react-player`** (`vi.mock('@dotlottie/react-player', ...)`) — the real component renders a web component not available in jsdom. Assert it renders with expected props (`src`, `autoplay`, `loop`, `speed`) and that `onEvent('complete')` maps to `OasAnimationStatus.completed`.
  - reduced-motion renders static fallback and NOT the mocked player.
  - theme colors are applied as inline CSS vars.
- `OasAnimationWrapper.test.tsx`:
  - lottie backend renders the (mocked) DotLottiePlayer.
  - missing src renders `staticChildren`.
  - showControls renders control buttons; click play/pause toggles status.
  - axe-core audit passes (there is an established a11y test pattern in this package — mirror it).

### 3.7 Post-change commands

```bash
pnpm --filter @open-edu/runtime test
pnpm --filter @open-edu/runtime typecheck
pnpm --filter @open-edu/runtime lint
pnpm --filter @open-edu/dev-server exec tailwindcss -c tailwind.config.js -i src/index.css -o src/tailwind.css  # only if new Tailwind classes were added
```

---

## Step 4 — AI Companion (Pipili) (`@open-edu/ai-companion`)

### 4.0 Package deps

Add to `packages/ai-companion/package.json`:

- `dependencies`: `@open-edu/runtime: workspace:*`
- `peerDependencies`: `react: ^18.0.0`, `react-dom: ^18.0.0`
- `devDependencies`: `@testing-library/react: ^14.0.0`, `@testing-library/jest-dom: ^6.0.0`, `@types/react: ^18.0.0`, `@types/react-dom: ^18.0.0`

Run `pnpm install`. (Confirm no circular dep: `@open-edu/runtime` does NOT import `@open-edu/ai-companion` — verified, safe.)

### 4.1 Extend `packages/ai-companion/src/pipili/types.ts`

Add (additive — do not disturb existing interfaces):

```ts
import type { AnimationConfig } from '@open-edu/schemas';

export type PipiliAnimationState = 'idle' | 'thinking' | 'celebrating' | 'hinting';

export interface PipiliAnimationBinding {
  state: PipiliAnimationState;
  animation: AnimationConfig;
}

export interface PipiliOasBindings {
  bindings: PipiliAnimationBinding[];
  /** Default animation used when no state-specific binding matches. */
  fallback?: AnimationConfig;
}
```

Pre-filled example bindings (documented in the file, matching spec §4.1):
`pipili-idle.lottie` (state `idle`, loop true, `reducedMotion:'static-pose'`), `pipili-thinking.lottie` (state `thinking`, loop true), `pipili-celebrate.lottie` (state `celebrating`, `trigger:'lesson-complete'`), `pipili-hint.lottie` (state `hinting`, `reducedMotion:'static-pose'`).

Re-export `PipiliAnimationState`, `PipiliAnimationBinding`, `PipiliOasBindings` from `packages/ai-companion/src/pipili/index.ts`.

### 4.2 `packages/ai-companion/src/pipili/PipiliMascotAnimation.tsx`

Props:

```ts
export interface PipiliMascotAnimationProps {
  state: PipiliAnimationState;
  bindings?: PipiliOasBindings; // optional; defaults to a documented example set
  assetBaseUrl?: string;
  size?: number; // px; inline style allowed for dynamic sizing only
  reducedMotion?: boolean; // override
  onComplete?: () => void;
}
```

Behavior:

- Find the binding for `state`; resolve `animation.src` against `assetBaseUrl`.
- Render `OasAnimationWrapper` (from `@open-edu/runtime`) with the resolved config; pass `onComplete`.
- When reduced motion or `reducedMotion:'static-pose'` → render a static pose: a `<div role="img" aria-label={...}>` with a simple Pipili face built from design-system tokens (or the existing design-system `Pipili` primitive with `mood` mapped: `idle`→`idle`, `thinking`→`thinking`, `celebrating`→`content`, `hinting`→`curious`). Prefer the existing `@open-edu/design-system` `Pipili` primitive for the static pose.
- i18n: `aria-label` via `useTranslation()` — add keys under a new `learner.animation.*` block OR reuse `runtime.animation.*`; prefer `runtime.animation.*` (runtime is the engine package). Add `"learner.pipili.static_pose": "Pipili"` to `packages/i18n/locales/en/learner.json` if a label is needed.

### 4.3 Tests (`packages/ai-companion/src/pipili/__tests__/` — check existing layout first)

- `PipiliMascotAnimation.test.tsx`: mock `@open-edu/runtime` (`vi.mock` the `OasAnimationWrapper`) and `@open-edu/i18n` provider; assert correct wrapper renders for each state; reduced-motion renders static pose; invalid bindings fall back to `fallback` or a benign null render (no throw).
- `types.test.ts` (if any existing test file pattern suggests it): assert the example binding set validates against `AnimationConfigSchema`.

Verify: `pnpm --filter @open-edu/ai-companion test && pnpm --filter @open-edu/ai-companion typecheck && pnpm --filter @open-edu/ai-companion lint`

---

## Step 5 — Content Widgets (`@open-edu/widgets`)

### 5.1 Add optional `animation` to existing widget schemas

- `packages/widgets/src/builtins/ProcessDiagram/ProcessDiagram.tsx`: add `animation: AnimationConfigSchema.optional()` to `processDiagramSchema` (import from `@open-edu/schemas`). When present, wrap the rendered SVG content in `OasAnimationWrapper` from `@open-edu/runtime`? — NO. Runtime is a peer of widgets already? Check: `@open-edu/widgets` deps are `@open-edu/design-system`, `zod`, `@dnd-kit/*`; runtime depends on widgets (so widgets importing runtime = circular). RESOLUTION: widgets must NOT import `@open-edu/runtime`. Instead, widgets import `AnimationConfigSchema` only (schemas, which is safe) and pass `config.animation` through unvalidated into the node config; the RENDERER (`WidgetRenderer` in runtime) / `WidgetCanvas` is where `OasAnimationWrapper` wraps. Simpler and decoupled:
  - Widgets validate & store `animation` in schema (type-level only, via `z.any()`/`AnimationConfigSchema`).
  - Add the visual integration in `packages/runtime/src/renderers/WidgetRenderer.tsx` (or `components/WidgetCanvas.tsx`): if the widget node's `config.animation` exists, wrap the rendered widget in `OasAnimationWrapper` with `staticChildren` = the widget itself. This keeps runtime→widgets direction only.
  - This is the CORRECT decoupled placement (matches OAS §3 architecture diagram). Document this decision in the PR.
- `packages/widgets/src/builtins/Timeline/Timeline.tsx`: add `animation: AnimationConfigSchema.optional()` to `timelineSchema` (same pattern).

### 5.2 New widget `core.process-explainer`

Create `packages/widgets/src/builtins/ProcessExplainer/ProcessExplainer.tsx` + `ProcessExplainer.test.tsx`. Follow the `ProcessDiagram` file structure exactly (WidgetDefinitionV2, `LearningIntent`, `useObserveMode`, `WidgetError`, design-system `Button`, `--oe-*` tokens only).

Schema:

```ts
const explainerStepSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  media: z.string().optional(), // .svg/.lottie/.png path
  icon: z.string().optional(),
});
const processExplainerSchema = z.object({
  title: z.string().optional(),
  steps: z.array(explainerStepSchema).min(2),
  stepByStep: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(false),
  animation: AnimationConfigSchema.optional(),
});
```

Render: step list with numbered badges; when `stepByStep` reveal one step at a time (`Reveal Next` button — i18n via `t('widgets.process_explainer.reveal_next', ...)` with keys added to `packages/i18n/locales/en/widgets.json`); step content uses inline SVG drawing for `media` `.svg` when present. The widget emits `widget.interaction` telemetry and calls `complete()` like `ProcessDiagram`. When `config.animation` present, it passes it through in config (rendered by the runtime wrapper per 5.1).

Widget metadata: `id: 'core.process-explainer'`, `domain: 'core'`, `capabilities` with `supportsAnimation: true`, `accessibility` with `reducedMotion: true`, `reward`, `ai` block with an `authoringPrompt` and `exampleConfigs` (water-cycle style example), `icon: 'list-video'` (or a lucide icon available in the repo), `status: 'stable'`. Match the exact field shapes used by neighboring entries (check `science.process-diagram` entry + `WidgetDefinitionV2` in `types.ts`).

Register:

1. `packages/widgets/src/builtins/index.ts` — add `export { processExplainer } from './ProcessExplainer/ProcessExplainer';`
2. `packages/widgets/src/registry.ts` — add `processExplainer` to the builtins import (top of file, alphabetical) AND to the `BUILTIN_WIDGETS` array (line ~160–172). `registerAllBuiltins` (line 174) iterates `BUILTIN_WIDGETS` to call `registry.register(widget)` — that's the seeding mechanism.
3. `packages/widgets/src/widget-catalog-source.ts` — add a `WidgetCatalogEntry` for `core.process-explainer`; also add `'Animation'` to `capabilities` of `science.process-diagram` and `core.timeline` catalog entries if not present.
4. Run `pnpm --filter @open-edu/widgets generate:catalog` (regenerates `packages/core/src/widget-catalog-data.json`).

### 5.3 Tests & i18n

- `ProcessExplainer.test.tsx`: renders steps; stepByStep reveals sequentially and calls `complete`; observe-mode acknowledges; invalid config → `WidgetError`; axe-core audit passes.
- `process-diagram` + `timeline` schema tests: config with `animation` parses; without still parses.
- Add `packages/i18n/locales/en/widgets.json` keys: `"process_explainer.reveal_next"`, `"process_explainer.step_of"`, `"process_explainer.all_steps"`, `"process_explainer.finish"`.

Verify:

```bash
pnpm --filter @open-edu/widgets test
pnpm --filter @open-edu/widgets typecheck
pnpm --filter @open-edu/widgets lint
pnpm --filter @open-edu/core typecheck    # catalog data regenerated must not break core
git diff --stat packages/core/src/widget-catalog-data.json   # confirm it changed
```

---

## Step 6 — Course Compiler (`@open-edu/course-compiler`)

### 6.0 Dep

Add `@open-edu/schemas: workspace:*` to `packages/course-compiler/package.json` dependencies. `pnpm install`.

### 6.1 Validator

Edit `packages/course-compiler/src/validators/semantic-validator.ts`:

- Import `AnimationConfigSchema` from `@open-edu/schemas`.
- Add `validateAnimationConfigs(model, diagnostics)` and call it from `validateCourseModel`.
- Logic: for every lesson, for each `activity` where `activity.type === 'widget'`:
  - if `activity.config.animation` present → `AnimationConfigSchema.safeParse(...)`; on failure add error diagnostic `INVALID_ANIMATION_CONFIG` with a hint naming the invalid fields.
  - if parse succeeds and `src` present and `lesson.assets` exists → check an asset whose `path` matches the `src` (allow `assets/`-prefixed or exact relative match); if no match add a `warning` diagnostic `UNDECLARED_ANIMATION_ASSET` (hint: declare it in lesson assets or place under `assets/`).
- Add unit tests in `packages/course-compiler/src/validators/semantic-validator.test.ts` covering: valid lottie config passes; invalid effect → error; missing asset → warning.

Verify: `pnpm --filter @open-edu/course-compiler test && pnpm --filter @open-edu/course-compiler typecheck`

---

## Step 7 — Distribution & Examples

### 7.1 `@open-edu/oep-distribution` (tests only)

Add regression test to `packages/oep-distribution/src/oep-writer.test.ts`:

- Build an archive with a `.lottie` and `.svg` file in `courseFiles`; read it back with `oep-reader` (or unzip) and assert both bytes survive byte-for-byte.
- No production code change expected. If a test reveals filtering, fix the cause.

Verify: `pnpm --filter @open-edu/oep-distribution test`

### 7.2 Example node

Create `examples/widget-showcase/nodes/animated-water-cycle.json`:

```json
{
  "type": "exercise",
  "title": "Animated Water Cycle",
  "widget": "core.process-explainer",
  "config": {
    "title": "The Water Cycle",
    "stepByStep": true,
    "interactive": true,
    "steps": [
      {
        "id": "evaporation",
        "title": "Evaporation",
        "description": "Sun heats water, turning it into vapor",
        "icon": "☀️"
      },
      {
        "id": "condensation",
        "title": "Condensation",
        "description": "Water vapor cools and forms clouds",
        "icon": "☁️"
      },
      {
        "id": "precipitation",
        "title": "Precipitation",
        "description": "Water falls as rain, snow, or hail",
        "icon": "🌧️"
      },
      {
        "id": "collection",
        "title": "Collection",
        "description": "Water gathers in oceans, lakes, and rivers",
        "icon": "🌊"
      }
    ],
    "animation": {
      "backend": "lottie",
      "src": "assets/animations/water-cycle.lottie",
      "trigger": "step",
      "reducedMotion": "static-steps",
      "effects": [
        { "step": 1, "target": "evaporation", "effect": "flow" },
        { "step": 2, "target": "condensation", "effect": "pulse" },
        { "step": 3, "target": "precipitation", "effect": "draw" },
        { "step": 4, "target": "collection", "effect": "flow" }
      ]
    }
  }
}
```

Also create a **minimal valid placeholder** `examples/widget-showcase/assets/animations/water-cycle.lottie` so the asset reference is real and offline-runnable. dotLottie is a ZIP of `manifest.json` + `animations/animations.json`. Create it with a one-off script using `fflate` (already a workspace dep of `@open-edu/oep-distribution`) — place the script under `/tmp` (use the opencode temp dir), do NOT commit it:

- `manifest.json`: `{ "version": 1, "author": "open-edu", "description": "Placeholder water cycle animation", "animations": [{ "id": "water-cycle", "loop": true }] }`
- `animations/animations.json`: a minimal valid Lottie: `{ "v": "5.7.4", "fr": 30, "ip": 0, "op": 60, "w": 200, "h": 200, "nm": "water-cycle", "ddd": 0, "assets": [], "layers": [] }`
- Zip with `zipSync` → `water-cycle.lottie`. Verify it unzips (read back).

### 7.3 Validation of the example

A single widget-showcase node JSON is NOT a course spec, so do NOT run it through `compile` (the course-compiler CLI accepts only full `course-spec.{md,json}` files). Instead validate with the schemas package — one-off script in the opencode temp dir (not committed):

```bash
# /tmp/oas-validate.mts
import { readFileSync } from 'node:fs';
import { WidgetNodeSchema } from '@open-edu/schemas';
const raw = readFileSync('examples/widget-showcase/nodes/animated-water-cycle.json', 'utf-8');
const result = WidgetNodeSchema.safeParse(JSON.parse(raw));
console.log(result.success ? 'VALID' : JSON.stringify(result.error, null, 2));
```

Verify it prints `VALID` and that `examples/widget-showcase/assets/animations/water-cycle.lottie` exists and unzips. This also exercises Phase 6 indirectly: course-compiler's validator imports the same `AnimationConfigSchema`. Add a course-compiler e2e case in `packages/course-compiler/src/e2e.test.ts` (follow the existing pattern) covering a widget activity with a valid `animation` block and one with an invalid effect, if one is not already added in Step 6.

---

## Step 8 — Full verification

Run from repo root, in order; ALL must pass:

```bash
pnpm install                      # once deps added (Steps 3.0/4.0/6.0)
pnpm test
pnpm typecheck
pnpm lint                         # includes lint-no-hardcoded-strings
pnpm format:check                 # run pnpm format if anything is off
```

Additional targeted checks:

- `node packages/i18n/src/i18n-keys.test.ts` (new i18n keys valid)
- `pnpm --filter @open-edu/widgets generate:catalog` then re-verify `@open-edu/core` builds
- dev-server tailwind regeneration if runtime Tailwind classes changed (Step 3.7)
- Confirm no circular imports were introduced: `@open-edu/runtime` must NOT import `@open-edu/ai-companion` or be imported by `@open-edu/widgets`.

---

## Risks & gotchas for the implementing agent

1. **jsdom cannot run the real dotLottie web component.** ALWAYS `vi.mock('@dotlottie/react-player')` in runtime widget tests. Mock `DotLottiePlayer` as a stub that renders a `div` and invokes `onEvent` per the test.
2. **SSR safety**: learner/dev-server are CSR, but guard all `window`/`matchMedia`/`getComputedStyle` access behind `typeof window !== 'undefined'` (or `useEffect`). `RuntimeThemeProvider` sets `--oe-color-*`; read them only in effects.
3. **i18n key tests** (`i18n-keys.test.ts`) validate that every key used via `t()` exists in the locale files — add keys in the SAME commit as the code that uses them.
4. **Catalog data file** `packages/core/src/widget-catalog-data.json` is generated and committed — always regenerate, never hand-edit.
5. **Keep `motion.ts` changes additive** — `useReducedMotion`, `motionSafe`, `motionTokens` are consumed across runtime/learner.
6. **Widgets must not import runtime** (circular). The `OasAnimationWrapper` integration for widget `config.animation` belongs in the runtime `WidgetRenderer`/`WidgetCanvas`.
7. **`@dotlottie/react-player` needs its CSS import** (`dist/index.css`) for controls; if unused (custom controls), you can skip importing it, but the wrapper's controls are custom buttons — verify no visual regression in dev-server.
8. **Tailwind class list changes** in `packages/runtime/src` require dev-server CSS regen (AGENTS.md UI rules #9).
9. Run `pnpm --filter <pkg> lint` per package; runtime lint includes the hardcoded-strings scan.

## Definition of Done (PR checklist — AGENTS.md)

- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check` green
- [ ] New i18n keys present in `packages/i18n/locales/en/{runtime,widgets,learner}.json` and `i18n-keys.test.ts` passes
- [ ] `@open-edu/schemas` `AnimationConfigSchema` is the single source of truth; no duplicated animation types
- [ ] axe-core audits pass for `OasAnimationWrapper`, `DotLottiePlayer` fallback, `ProcessExplainer`
- [ ] Reduced-motion path verified (static pose / static steps, no player mount)
- [ ] `core.process-explainer` registered in builtins, registry, catalog source, and `widget-catalog-data.json` regenerated
- [ ] No new cross-package imports outside declared package.json deps
- [ ] Conventional commit per step; one logical change per commit
- [ ] Example node + placeholder `.lottie` asset added under `examples/widget-showcase/`
