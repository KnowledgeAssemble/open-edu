# OpenEdu Marketing Website — Implementation Plan

> **Archived / superseded (October 2026):** The in-repo `apps/website` marketing app was removed. Future marketing will live in a separate repository. This document is retained for historical context only.

## Overview

Build `apps/website` — a high-impact marketing site for the OpenEdu framework using **React 18**, **Vite**, **TypeScript**, **Tailwind CSS**, **React Router v6** (matching the learner app convention), **OpenEdu design tokens & primitives**, **`@open-edu/runtime`** (RuntimeThemeProvider), and **`@open-edu/i18n`**. The design mirrors the prototype with 10 interactive landing page sections, 3-theme support (Light/Dark/Zen), and full a11y/i18n compliance.

**Router Decision:** The existing codebase uses React Router v6 (`react-router-dom ^6.30.0`). For consistency with the learner app and to avoid introducing a new major dependency (`@react-router/dev`, `@react-router/node`), the website will use React Router v6 with `createBrowserRouter` and `RouterProvider`. This keeps the build pipeline identical (Vite + `@vitejs/plugin-react`) and avoids the RRv7 Framework Mode migration cost. If RRv7 is desired later, it becomes a follow-up migration.

---

## Architecture

```
apps/website/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── postcss.config.js
├── tailwind.config.ts
├── vitest.config.ts
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                      # Entry point — createBrowserRouter + RouterProvider
    ├── index.css                     # Tailwind directives + --oe-* variable mappings
    ├── App.tsx                       # Root layout: I18nProvider > RuntimeThemeProvider > Navbar > Outlet > Footer
    ├── routes/
    │   ├── HomePage.tsx              # Landing page (composes all sections)
    │   ├── CoursesPage.tsx           # /courses
    │   ├── WidgetsPage.tsx           # /widgets
    │   ├── DocsPage.tsx              # /docs
    │   └── CommunityPage.tsx         # /community
    ├── components/
    │   ├── Navbar.tsx                # Sticky nav + theme toggle
    │   ├── Footer.tsx                # Multi-column footer
    │   └── sections/
    │       ├── InteractiveHero.tsx
    │       ├── WhyOpenEdu.tsx
    │       ├── ExploreCourses.tsx
    │       ├── TryWidgets.tsx
    │       ├── AiCompanionDemo.tsx
    │       ├── OfflineDemo.tsx
    │       ├── BuiltForEveryone.tsx
    │       ├── OpenSourceCommunity.tsx
    │       └── GetStartedCTA.tsx
    ├── ui/
    │   ├── PrismLessonCard.tsx
    │   ├── CourseCard.tsx
    │   ├── StatCounter.tsx
    │   └── ChatBubbleDemo.tsx
    ├── data/
    │   ├── courses.ts
    │   └── widgets.ts
    └── __tests__/
        ├── App.test.tsx
        ├── Navbar.test.tsx
        ├── Footer.test.tsx
        ├── InteractiveHero.test.tsx
        └── HomePage.test.tsx
```

### Dependencies (workspace:\*)

| Package                         | Purpose                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| `@open-edu/design-system`       | Primitives (Button, Card, Badge, Tag, Progress, Skeleton), `cn()`, tokens |
| `@open-edu/runtime`             | `RuntimeThemeProvider`, `useTheme`, theme switching                       |
| `@open-edu/i18n`                | `I18nProvider`, `useTranslation`, `website` namespace                     |
| `lucide-react`                  | Icons                                                                     |
| `clsx`, `tailwind-merge`, `cva` | Styling utilities                                                         |
| `react-router-dom`              | Routing (v6, matching learner app)                                        |

### Content paths in tailwind.config

```ts
content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/design-system/src/**/*.{ts,tsx}'];
```

_(Unlike the learner app, the website does NOT need `packages/runtime/src/**` — it doesn't render course content.)_

---

## Epics

### Epic 1: Package Scaffold & Build Pipeline

**Goal:** A compiling, empty Vite + React + TS app with all config files and `pnpm --filter @open-edu/website dev` working.

**Files:**

| File                                      | Key Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/website/package.json`               | Name `@open-edu/website`, private. Dependencies: `@open-edu/design-system`, `@open-edu/runtime`, `@open-edu/i18n`, `react`, `react-dom`, `react-router-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `cva`. DevDeps: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/react`, `@types/react-dom`, `@types/axe-core`, `axe-core`, `jsdom`, `@vitejs/plugin-react`, `autoprefixer`, `postcss`, `tailwindcss`, `tailwindcss-animate`, `typescript`, `vite`, `vitest` |
| `apps/website/vite.config.ts`             | `@vitejs/plugin-react`, alias `@` → `./src`, port 4002, security headers                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/website/tsconfig.json`              | Extends `../../tsconfig.base.json`, jsx react-jsx, paths `@/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/website/tailwind.config.ts`         | All design system token extensions (identical pattern to learner), plus `tailwindcss-animate` plugin                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/website/postcss.config.js`          | Tailwind + Autoprefixer (identical to learner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/website/vitest.config.ts`           | jsdom environment, globals, `src/**/*.test.{ts,tsx}`, setup file                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/website/index.html`                 | Standard Vite HTML shell, favicon, `#root` div                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/website/src/main.tsx`               | `createBrowserRouter` with 5 routes, `RouterProvider`, render to `#root`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/website/src/index.css`              | `@tailwind base/components/utilities`, `--oe-*` CSS custom properties                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/website/src/App.tsx`                | `I18nProvider` > `RuntimeThemeProvider` > layout with Navbar + `<Outlet />` + Footer                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/website/src/test-setup.ts`          | `@testing-library/jest-dom` import, i18n mock bootstrap                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/website/src/__tests__/App.test.tsx` | Renders without crash, basic smoke test                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Verification:**

```bash
pnpm --filter @open-edu/website dev     # starts on port 4002
pnpm --filter @open-edu/website typecheck
pnpm --filter @open-edu/website test
```

**Dependencies:** None (pure foundation)

---

### Epic 2: i18n — `website` Namespace & String Extraction

**Goal:** All 150+ user-facing strings extracted into `packages/i18n/locales/en/website.json` with semantic keys, registered with `@open-edu/i18n` namespace system.

**Files:**

| File                                    | Key Details                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/i18n/locales/en/website.json` | Namespace with sections: `nav.*`, `hero.*`, `prism.*`, `why.*`, `courses.*`, `widgets.*`, `ai.*`, `offline.*`, `everyone.*`, `community.*`, `cta.*`, `footer.*` |

**Key conventions:**

- Keys use dot notation: `hero.headline`, `prism.question`, `why.interactive.title`
- Interpolation via `{{ variable }}` syntax (Handlebars-style, matching existing i18n engine)
- Pluralization handled via separate keys (e.g., `courses.count_one`, `courses.count_other`)
- Register `website` in `packages/i18n/src/namespaces.ts` `NAMESPACES` array

**Verification:**

```bash
pnpm lint:hardcoded-strings      # must pass after all UI strings use t()
```

**Dependencies:** Epic 1 (scaffold)

---

### Epic 3: Layout Shell — Navbar & Footer

**Goal:** Sticky top navigation bar and footer rendered on every page via `App.tsx` layout route. Theme switcher works across Light/Dark/Zen.

**Files:**

| File                        | Key Details                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/Navbar.tsx` | Logo (OpenEduLogo from design-system), nav links (Home, Courses, Widgets, Docs, Community), GitHub star count link, theme toggle (Light/Dark/Zen), `Get Started` CTA button. Sticky with `position: sticky top-0 z-50`. Mobile hamburger menu via state toggle + AnimatePresence. Uses `useTheme()` + `RuntimeThemeProvider` setter. |
| `src/components/Footer.tsx` | 4-column grid: Product (Features, Widgets, Pricing), Resources (Docs, API, GitHub), Community (Discord, Twitter, Blog), Legal (Privacy, Terms, License). Copyright line. All links use `t()` keys.                                                                                                                                   |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- Navbar  # a11y + rendering tests
pnpm --filter @open-edu/website test -- Footer
```

- Manual: Theme toggle cycles Light → Dark → Zen, applies `data-theme` attr, CSS variables update
- Manual: Mobile nav hamburger opens/closes, links navigate correctly

**Dependencies:** Epic 1 (scaffold), Epic 2 (i18n keys for nav/footer strings)

---

### Epic 4: Hero Section — InteractiveHero + PrismLessonCard

**Goal:** Dual-column hero with headline, CTA, landscape SVG footer art (left), and interactive ROYGBIV prism mini-lesson card (right).

**Files:**

| File                                          | Key Details                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/sections/InteractiveHero.tsx` | Responsive 2-col grid (stacks on mobile). Left: `t('hero.headline')`, `t('hero.subtitle')`, "Start Learning" primary button + "Explore Courses" outline button, landscape SVG footer. Right: renders `<PrismLessonCard />` with "Try it now" badge tab and handwritten callout arrow.                                                                                                                                      |
| `src/ui/PrismLessonCard.tsx`                  | Stateful interactive component. Renders: `🔬 Science` Badge, step `1 / 3` Progress bar, `t('prism.question')`, `t('prism.instructions')`. SVG light ray → rainbow prism illustration. 7 draggable color tiles (ROYGBIV) + 7 drop slots. `Check Answer` button validates order. Shows success/failure feedback with animation (`GlowPulse` from design-system effects). Drag-and-drop uses HTML5 DnD API (no external lib). |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- PrismLesson  # a11y + interaction tests
pnpm --filter @open-edu/website test -- InteractiveHero
```

- Manual: Drag red to slot 1, complete ROYGBIV order, click Check Answer → success feedback
- Manual: Wrong order → error feedback with shake animation

**Dependencies:** Epic 3 (Navbar renders above), Epic 2 (hero/prism i18n keys)

---

### Epic 5: Feature Cards — WhyOpenEdu

**Goal:** 6-card grid highlighting platform capabilities with icons and descriptions.

**Files:**

| File                                     | Key Details                                                                                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/sections/WhyOpenEdu.tsx` | Section heading, 3×2 responsive grid. Each card: Lucide icon (e.g., `Puzzle`, `WifiOff`, `Bot`, `Code2`, `Accessibility`, `Globe`), title, description. Uses `Card`/`CardContent` from design-system. Uses `StaggerReveal` effect for entrance animation. |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- WhyOpenEdu
```

- Manual: All 6 cards visible, responsive reflow to 1-col on mobile

**Dependencies:** Epic 2 (why.\* i18n keys), design-system Card primitives

---

### Epic 6: Course Carousel — ExploreCourses + CourseCard

**Goal:** Horizontally scrollable course cards with category filter pills. Sample course data.

**Files:**

| File                                         | Key Details                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/data/courses.ts`                        | Array of `CourseMeta` objects: id, title, category, lessonCount, ageRange, description, color, icon. 5 sample courses (Indian Tribal Art, World of Atoms, Ancient Civilizations, Shapes in Real World, Mindful Moments). |
| `src/ui/CourseCard.tsx`                      | Card with icon, category Badge, title, description, lesson count, age range. Uses design-system Card components. Hover lift effect.                                                                                      |
| `src/components/sections/ExploreCourses.tsx` | Section heading. Filter pill bar (All, Art & Culture, Science, History, Math, Life Skills). Horizontally scrollable card row with `< >` prev/next chevrons. Filter state via `useState`.                                 |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- ExploreCourses  # filter + render tests
```

- Manual: Click "Science" filter → only "World of Atoms" visible. Click `<` `>` to scroll. All 5 cards render.

**Dependencies:** Epic 2 (courses.\* i18n keys)

---

### Epic 7: Widget Sandbox — TryWidgets

**Goal:** 5 live interactive widget demo cards: Quiz, Timeline, Image Compare, Hotspot, Label Diagram.

**Files:**

| File                                     | Key Details                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/widgets.ts`                    | Array of widget metadata: id, title, description, icon, demoComponent (lazy-loaded).                                                                           |
| `src/components/sections/TryWidgets.tsx` | Section heading + subtitle. 5 sandbox cards in a responsive grid. Each card renders the widget's live demo using React.lazy + Suspense with Skeleton fallback. |

Each widget card is a self-contained interactive component:

1. **Quiz** (`src/ui/demos/QuizDemo.tsx`): `2 + 3 = ?` with 3 option buttons (4, 5, 6). Clicking shows correct/incorrect feedback.
2. **Timeline** (`src/ui/demos/TimelineDemo.tsx`): Horizontal timeline with 4 clickable milestone nodes (1947, 1965, 1991, 2000). Clicking expands description panel.
3. **ImageCompare** (`src/ui/demos/ImageCompareDemo.tsx`): Side-by-side image with a draggable slider splitter (CSS clip-path approach, no lib).
4. **Hotspot** (`src/ui/demos/HotspotDemo.tsx`): Volcano SVG diagram with pulsing clickable hotspot pins. Clicking shows tooltip with info.
5. **LabelDiagram** (`src/ui/demos/LabelDiagramDemo.tsx`): Flower anatomy SVG with labeled drop targets. Drag label to correct part.

**Verification:**

```bash
pnpm --filter @open-edu/website test -- TryWidgets  # render + basic interaction tests
```

- Manual: Each widget card is interactive and shows correct feedback

**Dependencies:** Epic 2 (widgets.\* i18n keys)

---

### Epic 8: AI Companion Demo — AiCompanionDemo + ChatBubbleDemo

**Goal:** Simulated Pipili AI chat window with pre-scripted conversation. Simulates typing, responses, and follow-up prompts.

**Files:**

| File                                          | Key Details                                                                                                                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/ChatBubbleDemo.tsx`                   | Staggered animated chat conversation. Pre-scripted messages with typing indicator simulation (`setTimeout`/`setInterval`). Pipili avatar (Pipili primitive from design-system), user messages, AI responses with markdown formatting.                 |
| `src/components/sections/AiCompanionDemo.tsx` | Section heading. Chat window card with mock message list. "Suggested questions" chips below (e.g., "Why is the sky blue?", "How do volcanoes form?"). Clicking a chip simulates sending and receiving a response. Uses `Card` for the chat container. |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- AiCompanion  # mock interaction tests
```

- Manual: Click "Why is the sky blue?" chip → typing indicator → AI response appears

**Dependencies:** Epic 2 (ai.\* i18n keys), design-system Pipili primitive

---

### Epic 9: Offline Demo — OfflineDemo

**Goal:** Toggle-based simulation showing offline .oep course functionality.

**Files:**

| File                                      | Key Details                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/sections/OfflineDemo.tsx` | Card with toggle switch (`Switch` from design-system) labeled "Simulate Offline Mode". Visual state changes: when toggled, show offline indicator (WifiOff icon), course content card still accessible, status bar showing "100% available offline". Illustrates .oep archive concept. |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- OfflineDemo
```

- Manual: Toggle on → UI shifts to "offline" visual state, course content still renders

**Dependencies:** Epic 2 (offline.\* i18n keys), design-system Switch primitive

---

### Epic 10: BuiltForEveryone, OpenSourceCommunity, GetStartedCTA

**Goal:** Remaining 3 sections — audience cards, GitHub stats, bottom CTA banner.

**Files:**

| File                                              | Key Details                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/sections/BuiltForEveryone.tsx`    | 4 role cards (Learners, Educators, Parents, Developers). Each: Lucide icon, title, description. 2×2 responsive grid. Uses `StaggerReveal`.                                                                                                                                                                         |
| `src/components/sections/OpenSourceCommunity.tsx` | Section heading. GitHub card with star & contribute buttons. Stat counters via `<StatCounter />`: 120+ Contributors, 85+ Packages, 50+ Courses, 15k+ Stars. Counter uses `StatCounter` component with count-up animation (`useEffect` + `requestAnimationFrame` or `setInterval`). GitHub mascot SVG illustration. |
| `src/ui/StatCounter.tsx`                          | Receives `value: number`, `label: string`, `duration?: number`. Animates from 0 to value on mount using `requestAnimationFrame`. Memoized to prevent re-trigger on re-render.                                                                                                                                      |
| `src/components/sections/GetStartedCTA.tsx`       | Full-width banner with gradient background. Heading + subtext + "Start Learning Now →" primary button.                                                                                                                                                                                                             |

**Verification:**

```bash
pnpm --filter @open-edu/website test -- BuiltForEveryone
pnpm --filter @open-edu/website test -- OpenSourceCommunity
pnpm --filter @open-edu/website test -- GetStartedCTA
```

- Manual: StatCounter animates from 0 to target. CTA button links to learner app.

**Dependencies:** Epic 2 (everyone._, community._, cta.\* i18n keys)

---

### Epic 11: Secondary Pages — Courses, Widgets, Docs, Community

**Goal:** Stub pages for the other 4 routes. Each renders a title + placeholder content. Full pages are future work.

**Files:**

| File                           | Key Details                                   |
| ------------------------------ | --------------------------------------------- |
| `src/routes/CoursesPage.tsx`   | "Explore Courses" heading + placeholder grid  |
| `src/routes/WidgetsPage.tsx`   | "Widgets Playground" heading + placeholder    |
| `src/routes/DocsPage.tsx`      | "Documentation" heading + link to actual docs |
| `src/routes/CommunityPage.tsx` | "Community" heading + GitHub link             |

**Verification:**

```bash
pnpm --filter @open-edu/website test   # all route smoke tests pass
```

- Manual: Navigate to each route via Navbar links, page renders without error

**Dependencies:** Epic 1 (routing scaffold)

---

### Epic 12: Testing, A11y Audit & Polish

**Goal:** Full test coverage, axe-core audits pass, responsive behavior verified.

**Files:**

| File                                     | Key Details                                                     |
| ---------------------------------------- | --------------------------------------------------------------- |
| `src/__tests__/Navbar.test.tsx`          | Render, all nav links, theme toggle cycles, mobile hamburger    |
| `src/__tests__/Footer.test.tsx`          | Render, all link columns, copyright                             |
| `src/__tests__/InteractiveHero.test.tsx` | Hero renders, PrismLessonCard mounts, CTA buttons clickable     |
| `src/__tests__/PrismLessonCard.test.tsx` | Drag tiles, correct order → success, wrong order → error, reset |
| `src/__tests__/WhyOpenEdu.test.tsx`      | 6 cards render                                                  |
| `src/__tests__/ExploreCourses.test.tsx`  | Filter pills work, cards filter correctly                       |
| `src/__tests__/HomePage.test.tsx`        | All sections render, no console errors                          |

**A11y audit checklist:**

- All interactive elements have accessible names
- Theme contrast ratios meet WCAG AA (Light, Dark, Zen)
- Keyboard navigation works through all sections
- Focus rings visible on all interactive elements
- `axe-core` audit on each section component

**Verification:**

```bash
pnpm --filter @open-edu/website test        # all tests pass
pnpm --filter @open-edu/website typecheck   # no errors
pnpm lint                                   # no lint errors (includes i18n hardcoded string check)
pnpm --filter @open-edu/website build       # production build succeeds
```

**Dependencies:** All prior epics

---

## Dependency Graph

```
Epic 1 (Scaffold & Build)
  ├── Epic 2 (i18n Namespace)
  │     ├── Epic 3 (Navbar + Footer)
  │     │     └── Epic 4 (Hero + Prism)
  │     │           └── Epic 5 (WhyOpenEdu)
  │     ├── Epic 6 (Course Carousel)
  │     ├── Epic 7 (Widget Sandbox)
  │     ├── Epic 8 (AI Companion Demo)
  │     ├── Epic 9 (Offline Demo)
  │     └── Epic 10 (BuiltForEveryone, Community, CTA)
  └── Epic 11 (Secondary Pages — parallel with any epic)

Epic 12 (Testing & Polish) ← Depends on all above
```

Epics 3–10 can start in parallel once Epic 2 is done, but are listed in display order.

---

## Estimated File Count

| Epic      | New Files                                |
| --------- | ---------------------------------------- |
| Epic 1    | 12                                       |
| Epic 2    | 1 (+ 1 edit to namespaces.ts)            |
| Epic 3    | 2                                        |
| Epic 4    | 2                                        |
| Epic 5    | 1                                        |
| Epic 6    | 3                                        |
| Epic 7    | 7 (section + 1 data + 5 demo components) |
| Epic 8    | 2                                        |
| Epic 9    | 1                                        |
| Epic 10   | 4                                        |
| Epic 11   | 4                                        |
| Epic 12   | 7 (test files)                           |
| **Total** | **~46 files**                            |

---

## Verification Checklist (Final)

- [ ] `pnpm --filter @open-edu/website dev` starts on port 4002
- [ ] `pnpm --filter @open-edu/website typecheck` passes
- [ ] `pnpm --filter @open-edu/website test` — all tests pass
- [ ] `pnpm lint` — no lint errors (includes i18n hardcoded string check)
- [ ] `pnpm --filter @open-edu/website build` — production build succeeds
- [ ] Theme switcher cycles Light → Dark → Zen, CSS variables update
- [ ] Responsive layout works on Desktop, Tablet, Mobile
- [ ] All PrismLessonCard interactions work (drag, check answer, feedback)
- [ ] Course carousel filters and scrolls
- [ ] Widget sandbox demos are interactive
- [ ] AI companion chat simulation works
- [ ] Offline toggle shows correct visual state
- [ ] Stat counters animate on scroll
- [ ] axe-core audits pass on all pages
- [ ] No hardcoded user-facing strings — all use `t()`
