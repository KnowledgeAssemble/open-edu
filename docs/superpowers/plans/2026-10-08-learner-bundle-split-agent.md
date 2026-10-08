# Learner Bundle Split & Workbox Headroom — Agent Execution Plan (deepseek-4-flash)

> **For the implementing agent.** This is a turn-key, prescriptive plan. It resolves every open
> question, pre-decides all choices, and lists every file, verification command, and commit. Follow
> the phases in order. Do NOT improvise changes, dependencies, or files. When something fails, fix
> it within scope — do not redesign. When an instruction is unclear, STOP and report.
>
> - Goal: unblock the failing Vercel deploy (`maximumFileSizeToCacheInBytes` error: entry chunk
>   2.1 MB > 2 MiB default), then split the bundle so no single file approaches the limit.
> - Repo rules: `AGENTS.md` (read it). This plan already encodes its constraints.
> - Every fact in §2 was verified against the code on this branch. Cite them; do not re-grep.

---

## 0. Environment & non-negotiables

### 0.1 What you will touch (only this)

| Phase                                  | Files                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (A: headroom)                        | `apps/learner/vite.config.ts` (add `workbox.maximumFileSizeToCacheInBytes` + `build` block)                                                                                                                 |
| 2 (B1: vendor split)                   | `apps/learner/vite.config.ts` (`manualChunks` inside the `build` block)                                                                                                                                     |
| 3 (B2: lazy routes, **gated** — §1 L7) | `apps/learner/src/AppShell.tsx` (top-level imports + two `Suspense` boundaries); `apps/learner/src/AppShell.test.tsx` **only** to convert failing `getBy` → `findBy` assertions caused by your lazy changes |

**Do NOT modify:** anything under `packages/**`, `apps/dev-server/**`, `apps/learner/src/**`
outside `AppShell.tsx`/`AppShell.test.tsx`, `apps/learner/vercel.json`, `apps/learner/package.json`,
`apps/learner/tailwind.config.ts`, `playwright.config.ts`, `tests/e2e/**`, any i18n locale file,
any spec/plan file.

If you believe a file outside this list must change, **STOP and report instead of editing.**

### 0.2 Hard rules

1. **No new dependencies.** No `pnpm add`, no `npx` installs.
   `pnpm --filter @open-edu/learner pwa:analyze` may be unavailable (it runs
   `npx vite-bundle-visualizer`); if it prompts to install or fails, **skip it** — rely on the
   size script in §0.4.
2. **Do not change** workbox `globPatterns`, `navigateFallback`, `navigateFallbackDenylist`,
   `runtimeCaching`, `manifest`, `registerType`, or anything outside the two prescribed additions.
3. **No Tailwind/runtime changes** → the dev-server CSS regeneration step is **not needed**. Do
   not run it.
4. **No hardcoded user-facing strings.** The only new UI string (Phase 3 fallback) must be
   `{t('runtime.loading')}` — an existing key (`packages/i18n/locales/en/runtime.json:2`,
   precedent: `CourseRuntime.tsx:524`). Do not add locale keys.
5. **No comments, no emoji, no `console.log`, no dead code.**
6. **One conventional commit per phase**, made locally. **Do not push.** Do not create PRs.
7. Run `pnpm format` at the end of each phase; `pnpm format:check` must pass in §0.3.
8. If `build:deploy` fails after Phase 1 with any error **other than** the workbox one → STOP and
   report.

### 0.3 Verification loop (all green before the next phase)

```bash
pnpm --filter @open-edu/learner build:deploy    # must exit 0 after Phase 1
pnpm --filter @open-edu/learner test
pnpm --filter @open-edu/learner typecheck
pnpm lint
pnpm format:check
```

### 0.4 Size gate (run after Phases 1, 2, and 3)

```bash
node -e "
const fs=require('fs'),d='apps/learner/dist/assets';
const f=fs.readdirSync(d).filter(n=>n.endsWith('.js'))
  .map(n=>({n,s:fs.statSync(d+'/'+n).size})).sort((a,b)=>b.s-a.s);
f.slice(0,8).forEach(x=>console.log(String(x.s).padStart(9),x.n));
if(f[0].s>3*1024*1024){console.error('FAIL: largest chunk exceeds 3 MiB');process.exit(1);}
console.log('OK: largest chunk under 3 MiB');"
```

- **Hard gate (must pass):** largest `.js` < 3,145,728 bytes (3 MiB).
- **Desired:** largest `.js` < 2,097,152 bytes (2 MiB), so the 3 MiB limit is headroom, not
  load-bearing.
- **Phase 3 trigger:** see §1 L7.

---

## 1. Locked decisions (do not revisit)

| #   | Question                                          | Locked decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Where does the 3 MiB headroom go?                 | `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` as the **first property** of the existing `workbox: {` block at `apps/learner/vite.config.ts:388`. Nothing else in that block changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| L2  | Where does the `build` key go?                    | New top-level `build` property in the config object returned at `vite.config.ts:381`, inserted **between line 432** (`].filter((plugin)…`) **and line 433** (`resolve: {`). Contents: `chunkSizeWarningLimit: 1024` and `rollupOptions.output.manualChunks` (L3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| L3  | `manualChunks` grouping                           | Function form, **ordered if/else chain, first match wins, `return undefined` at the end**. Exact implementation: <br>`if (id.includes('virtual:edu-data')) return 'edu-data';` <br>→ `if (id.includes('/node_modules/react/') \|\| id.includes('/node_modules/react-dom/') \|\| id.includes('/node_modules/react-router/') \|\| id.includes('/node_modules/react-router-dom/') \|\| id.includes('/node_modules/scheduler/')) return 'vendor-react';` <br>→ `if (id.includes('/node_modules/@ai-sdk/') \|\| id.includes('/node_modules/ai/')) return 'ai-sdk';` <br>→ `if (id.includes('/node_modules/@radix-ui/')) return 'vendor-radix';` <br>→ `if (id.includes('/node_modules/rxjs/') \|\| id.includes('/node_modules/zod/') \|\| id.includes('/node_modules/minisearch/') \|\| id.includes('/node_modules/lucide-react/')) return 'vendor-lib';` |
| L4  | Are `@open-edu/*` workspace packages chunked?     | **No, not in Phase 2.** pnpm symlinks resolve to real paths under `packages/**` (no `node_modules` in the id), so the L3 matchers deliberately miss them; they stay in the entry. This avoids alias pitfalls (`@open-edu/telemetry` and `@open-edu/rewards` are aliased to `src/`, `vite.config.ts:443-447`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| L5  | Do the AI SDK / Pipili providers get lazy-loaded? | **No.** `CompanionProvider` > `PipiliChatProvider` wrap the entire app at `AppShell.tsx:191-192`; the AI SDK loads eagerly by design. Phase 2 moves `ai`/`@ai-sdk` into a separate **eager** chunk (smaller entry file) — that is the whole fix. Do not restructure the provider tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| L6  | Which pages become `React.lazy` (Phase 3 only)?   | Exactly these, converted with `lazy(() => import('./X').then(m => ({ default: m.X })))`: `CourseRuntime` (import at `AppShell.tsx:30`), `ProgressDashboard` (`:33`), `SettingsPage` (`:34`), `BundleOverviewPage` (`:39`), `CollectionBinderPage` (`:40`), `NotesDashboardPage` (`:41`), `NoteEditorPage` (`:42`), `CatalogInstallView` (`:43`). **Stay eager:** `App`, `AppShell` itself, `HomePage` (`:31`), `CatalogPage` (`:32`), `BreakPage`, all dialogs, all providers, `CourseRightSidebar`, `Pipili`. Wrap each **branch** (not each component) in one `<Suspense>`: one around `<CourseRuntime>` inside the course branch (`:680-707`), one around the conditional-content `<div>` inside `AppLayout` (`:747-822` region).                                                                                                                 |
| L7  | Exact Phase 3 gate                                | Run Phase 3 **only if** the Phase 2 size gate shows the largest chunk ≥ **1,572,864 bytes (1.5 MiB)**. If the largest chunk is < 1.5 MiB after Phase 2, skip Phase 3 entirely, proceed to Phase 4, and report the gate result.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L8  | Suspense fallback (if Phase 3 runs)               | Exactly: `<div role="status" className="flex min-h-[40vh] items-center justify-center"><span className="sr-only">{t('runtime.loading')}</span><span aria-hidden="true" className="border-t-primary h-8 w-8 animate-spin rounded-full border-4 border-transparent" /></div>` — tokens only (`border-t-primary` precedent: `src/ai/WordTapHandler.tsx:223`), `role="status"` + `sr-only` for a11y, existing i18n key (§0.2 rule 4). `t` is already in scope in `AppShellInner`.                                                                                                                                                                                                                                                                                                                                                                        |
| L9  | Test fallout from Phase 3                         | Run `pnpm --filter @open-edu/learner test`. Convert **only failing** assertions in `AppShell.test.tsx` from `getBy*` → `await screen.findBy*` (same query text — do not weaken or delete assertions). Tests that render `CourseRuntime`/pages directly (e.g. `CourseRuntime.test.tsx`, `notes/__tests__/*`) are unaffected — leave them alone. If a failure looks unrelated to lazy loading → STOP and report.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L10 | Which branch?                                     | Create `fix/learner-workbox-bundle` **from the current `feat/pack-system-phase-1-packs` branch** (operator's explicit choice; the pack branch's `apps/learner` is identical to `main`, so size measurements are unaffected, and the fix can ship in PR #623's tree or be cherry-picked). `git checkout -b fix/learner-workbox-bundle` from where you are; do not touch `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 2. Pre-verified facts (cite these; do not re-grep)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Evidence                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Vercel build command fails at `vite build` with workbox "Unable to precache assets … exceeds maximumFileSizeToCacheInBytes" (2 MiB default = 2,097,152)                                                                                                                                                                                                                                                                                                                                                                                          | Vercel log (operator-provided); `apps/learner/vercel.json` build = `pnpm -r build && pnpm --filter @open-edu/learner build:deploy` |
| Entry chunk is 2,179,594 bytes; total `.js` in `dist` = 3,982,090 bytes; 8 lottie chunks (168–322 KB) are **already** split by `@dotlottie/react-player` dynamic imports                                                                                                                                                                                                                                                                                                                                                                         | `ls -la apps/learner/dist/assets/*.js` (stale Oct 3 build), §0.4 script                                                            |
| `vite.config.ts` has **no** `build:` key anywhere; `VitePWA` at `:384`, `workbox: {` at `:388`; config object returned at `:381`; plugins array ends `:432`; `resolve:` at `:433`; no `maximumFileSizeToCacheInBytes` / `chunkSizeWarningLimit` / `manualChunks` in the repo                                                                                                                                                                                                                                                                     | grep (empty) + direct reads                                                                                                        |
| `apps/learner` has **zero diff** vs `origin/main` (`git diff origin/main...HEAD -- apps/learner` empty) → measurements on this branch equal `main`                                                                                                                                                                                                                                                                                                                                                                                               | git                                                                                                                                |
| No `React.lazy` / `Suspense` anywhere in `apps/learner/src`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | grep (empty)                                                                                                                       |
| `AppShell.tsx` = 959 lines, statically imports every page: `CourseRuntime :30`, `HomePage :31`, `CatalogPage :32`, `ProgressDashboard :33`, `SettingsPage :34`, `BundleOverviewPage :39`, `CollectionBinderPage :40`, `NotesDashboardPage :41`, `NoteEditorPage :42`, `CatalogInstallView :43`, `Pipili :44`; render sites: course branch `:680-707`, `catalog-install :753`, `catalog :756`, `home :772`, `bundleOverview` IIFE `:777-791`, `progress :793`, `settings :801`, `collection :811`, `notes :817`, `note-editor :818`, `break :821` | direct reads                                                                                                                       |
| Provider tree (cannot be lazy): `CompanionProvider > PipiliChatProvider > RuntimeThemeProvider > I18nProvider > LoggerProvider > FontSizeProvider > AppShellInner`                                                                                                                                                                                                                                                                                                                                                                               | `AppShell.tsx:191-215`                                                                                                             |
| AppShell itself statically imports `@open-edu/runtime` (`RuntimeThemeProvider`, `TopAppBar` — `:3-9`) and `@open-edu/workflow` (`getOrderedNodes :15`, used `:915`) → runtime/workflow remain in the entry even after Phase 3; **widgets, telemetry, accessibility, rewards are only imported via `CourseRuntime`** (`CourseRuntime.tsx:2-34`) → they move out with Phase 3                                                                                                                                                                      | direct reads + grep                                                                                                                |
| AI SDK entry points: `src/ai/PipiliChatProvider.tsx:10-11` (`@ai-sdk/react`, `ai`), `src/pipili/handler.ts`, `src/pipili/tools.ts`                                                                                                                                                                                                                                                                                                                                                                                                               | grep                                                                                                                               |
| `minisearch` used by `notesService.ts:1`, `searchService.ts:1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | grep                                                                                                                               |
| Virtual edu-data JSON (`scanAll`/`loadPackage`/`loadBundle` over `../../examples`) is stringified into one module and statically imported by `App.tsx` from `virtual:edu-data`; example JSON+MD ≈ 548 KB (assets are emitted separately via `generateBundle`, `vite.config.ts:141-172`)                                                                                                                                                                                                                                                          | `vite.config.ts:124-231`, `App.tsx:4`, `du` over `examples/`                                                                       |
| i18n: learner bundles 5 namespaces × 3 locales via `i18n-dictionaries.ts`; `runtime.loading` = `"Loading…"` already exists and is already consumed by `CourseRuntime.tsx:524`                                                                                                                                                                                                                                                                                                                                                                    | direct reads                                                                                                                       |
| Scripts: `build:deploy` = `vite build` (`package.json:10`), `test` = `vitest run` (`:12`), `typecheck` = dual `tsc` (`:13`), `pwa:analyze` (`:15`); `vite-plugin-pwa ^1.3.0`                                                                                                                                                                                                                                                                                                                                                                     | `apps/learner/package.json`                                                                                                        |
| `AppShell.test.tsx` has 42 `getBy`/`findBy` usages, 14 `waitFor`/`findBy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | count                                                                                                                              |
| E2E: Playwright starts learner dev :4001 + dev-server :4002 (`playwright.config.ts:24-42`); `learner-experience.spec.ts` = canonical smoke (8 tests); `community-widget.spec.ts` covers offline/service-worker paths (8 tests)                                                                                                                                                                                                                                                                                                                   | direct reads                                                                                                                       |
| AGENTS.md Cursor note: run `pnpm test:e2e:install` once per environment before E2E                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `AGENTS.md`                                                                                                                        |

---

## 3. Phase 0 — Branch setup

**No commit.**

```bash
git status                                  # must be clean; if not, STOP and report
git checkout -b fix/learner-workbox-bundle  # from feat/pack-system-phase-1-packs (§1 L10)
```

---

## 4. Phase 1 — A: 3 MiB workbox headroom (unblocks the deploy)

**Commit:** `fix(learner): raise workbox precache limit to 3 MiB`

1. **Baseline (expected failure):** run `pnpm --filter @open-edu/learner build:deploy`. Confirm it
   fails with the workbox `maximumFileSizeToCacheInBytes` error (this reproduces Vercel). Record
   the error text. (If it unexpectedly fails earlier/differently → STOP.)
2. Edit `apps/learner/vite.config.ts`:
   - Insert after `workbox: {` (line 388): `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,`
   - Insert between line 432 and 433:
     ```ts
     build: {
       chunkSizeWarningLimit: 1024,
     },
     ```
3. Run §0.3 verification loop + §0.4 size gate. Record the **baseline sizes** (largest chunk,
   total) — this is your "before B" number for the final report.
4. `pnpm format`, then commit (§0.2 rule 6).

---

## 5. Phase 2 — B1: vendor `manualChunks`

**Commit:** `perf(learner): split vendor chunks with manualChunks`

1. Inside the `build` block from Phase 1, add `rollupOptions: { output: { manualChunks: … } }`
   with the **exact** function from §1 L3 (ordered if/else, first match wins, `return undefined`
   default).
2. Run §0.3 verification loop + §0.4 size gate. Record new sizes.
3. **Gate check (L7):** largest chunk ≥ 1.5 MiB → continue to Phase 3. Otherwise skip Phase 3, go
   to Phase 4.
4. `pnpm format`, commit.

---

## 6. Phase 3 — B2: lazy pages (only if gate trips)

**Commit:** `perf(learner): lazy-load secondary learner pages`

1. In `AppShell.tsx`, replace the 8 static page imports listed in §1 L6 with `lazy(...)` wrappers;
   add `lazy, Suspense` to the `react` import (line 1).
2. Add exactly two `<Suspense fallback={…}>` boundaries per §1 L6, fallback JSX per §1 L8.
3. Run §0.3 verification loop + §0.4 size gate. Fix failing tests per §1 L9.
4. `pnpm format`, commit.

---

## 7. Phase 4 — Full verification

```bash
pnpm --filter @open-edu/learner build:deploy
node -e "…§0.4 script…"        # hard gate: < 3 MiB, report vs 2 MiB
pnpm --filter @open-edu/learner test
pnpm --filter @open-edu/learner typecheck
pnpm lint
pnpm format:check
pnpm test:e2e:install           # once per environment
pnpm test:e2e tests/e2e/learner-experience.spec.ts
pnpm test:e2e tests/e2e/community-widget.spec.ts   # offline / service-worker paths
```

Do **not** run the dev-server Tailwind regeneration (§0.2 rule 3).

---

## 8. Final report (return this to your operator)

1. Before/after table: largest `.js`, entry chunk size, total `.js`, phases executed, Phase 3 gate
   result.
2. `git log --oneline` for the new commits + `git status` (clean).
3. Which verification commands passed; paste the §0.4 output.
4. Note: do **not** push — integration (PR/merge) is handled separately.
