# Course Creator Studio — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `apps/dev-server` into OpenEdu Course Creator Studio so a teacher can open Creator mode (default), start from a template, edit via an Outline + form editors, preview without DevTools, and export a shareable `.oep` — while Developer mode preserves today’s file tree + inspectors.

**Architecture:** Add a Creator façade under `apps/dev-server/src/studio/` that talks to a thin `StudioAPI` implemented by `LocalStudioAdapter` (wrapping existing `/api/package/*` plus new template/export/outline endpoints). On-disk format stays OpenEdu packages. UI uses `@open-edu/design-system` primitives/patterns only (no new local UI kits, no hardcoded palette colors). User-facing strings go through `@open-edu/i18n` (`studio` namespace).

**Tech Stack:** React 18, Vite 5, Vitest, Testing Library, `@open-edu/design-system`, `@open-edu/i18n`, `@open-edu/core`, `@open-edu/schemas`, `@open-edu/oep-distribution`, `@open-edu/runtime`, Tailwind token classes (`--oe-*`)

**Spec:** `docs/superpowers/specs/2026-08-05-course-creator-studio-design.md`  
**Wireframes:** `docs/superpowers/specs/course-creator-studio/wireframes/`

**Out of scope (later plans):** Phase 2 widgets/branching/rewards guided UI, Phase 3 AI generation, Phase 4 library/bundles, Phase 5 hosted cloud.

---

## Architecture & design-system constraints (mandatory)

1. **Design system only for new Studio UI**
   - Import from `@open-edu/design-system` (`Button`, `Card`, `Badge`, `Input`, `Textarea`, `Dialog`, `Select`, `Tabs`, `Switch`, `EmptyState`, `PageHeader`, `TopAppBar`, `cn`).
   - Existing `apps/dev-server/src/components/ui/*` re-exports may remain for legacy editor/inspector code; **new `studio/` files must import design-system directly**.
   - No inline `style={{}}` except dynamic sizing / CSS variables.
   - No raw hex/rgb or non-token Tailwind palette colors (`text-amber-400`, etc.). Use `text-on-surface`, `bg-surface`, `border-outline-variant`, `text-primary`, `bg-success`, etc.

2. **i18n is required**
   - All Creator-facing labels use `t('studio.*')` with keys in `packages/i18n/locales/en/studio.json`.
   - Register `studio` in `packages/i18n/src/namespaces.ts`.
   - Wire dictionary in `apps/dev-server/src/main.tsx`.

3. **Package boundaries**
   - Studio façade lives in `apps/dev-server` (app layer).
   - Do not invent a new publishable package in Phase 0/1.
   - Reuse `@open-edu/core` load/validate, `@open-edu/oep-distribution` `OepWriter`, schemas for validation.
   - Add `@open-edu/oep-distribution` dependency to `apps/dev-server/package.json`.

4. **One package model**
   - Creator and Developer edit the same files on disk.
   - Outline reorder writes `workflow.json` linear routing + preserves node files.
   - Never introduce a second authoring format.

5. **Testing**
   - Every new module gets Vitest unit tests.
   - UI components: render + interaction tests; a11y smoke where practical (axe on key shells).
   - Prefer testing StudioAPI/ready-check/outline pure logic heavily; keep Vite middleware tests focused.

6. **Tailwind**
   - After adding new Studio Tailwind classes used only in `apps/dev-server`, ensure PostCSS/dev build picks them up (dev-server already processes Tailwind via PostCSS per `main.tsx` comment). If any shared runtime class changes are needed, regenerate per `AGENTS.md`.

---

## File structure

| File                                                             | Status | Responsibility                                          |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `packages/i18n/locales/en/studio.json`                           | Create | Creator-facing copy                                     |
| `packages/i18n/src/namespaces.ts`                                | Modify | Add `studio` namespace                                  |
| `packages/i18n/src/namespaces.test.ts`                           | Modify | Expect `studio`                                         |
| `apps/dev-server/package.json`                                   | Modify | Add `@open-edu/oep-distribution`; update description    |
| `apps/dev-server/src/main.tsx`                                   | Modify | Load `studio` dictionary                                |
| `apps/dev-server/src/studio/types.ts`                            | Create | Mode, views, activity, ready-check types                |
| `apps/dev-server/src/studio/modeStorage.ts`                      | Create | Persist Creator/Developer preference                    |
| `apps/dev-server/src/studio/modeStorage.test.ts`                 | Create | Storage tests                                           |
| `apps/dev-server/src/studio/readyCheck.ts`                       | Create | Map validation → plain-language checks                  |
| `apps/dev-server/src/studio/readyCheck.test.ts`                  | Create | Ready-check tests                                       |
| `apps/dev-server/src/studio/outlineModel.ts`                     | Create | Derive outline + build linear workflow JSON             |
| `apps/dev-server/src/studio/outlineModel.test.ts`                | Create | Outline/workflow tests                                  |
| `apps/dev-server/src/studio/templates/catalog.ts`                | Create | Template metadata + file maps                           |
| `apps/dev-server/src/studio/templates/catalog.test.ts`           | Create | Catalog tests                                           |
| `apps/dev-server/src/studio/studioApi.ts`                        | Create | `StudioAPI` interface + browser client                  |
| `apps/dev-server/src/studio/studioApi.test.ts`                   | Create | Client tests (mocked fetch)                             |
| `apps/dev-server/vite.config.ts`                                 | Modify | Template create, outline save, export `.oep` endpoints  |
| `apps/dev-server/src/studio/components/ModeToggle.tsx`           | Create | Creator/Developer switch                                |
| `apps/dev-server/src/studio/components/ModeToggle.test.tsx`      | Create | Toggle tests                                            |
| `apps/dev-server/src/studio/components/StudioTopBar.tsx`         | Create | Brand + nav actions via DS                              |
| `apps/dev-server/src/studio/components/HomeView.tsx`             | Create | Templates + recent + AI stub                            |
| `apps/dev-server/src/studio/components/HomeView.test.tsx`        | Create | Home tests                                              |
| `apps/dev-server/src/studio/components/OutlineView.tsx`          | Create | Activity spine                                          |
| `apps/dev-server/src/studio/components/OutlineView.test.tsx`     | Create | Outline UI tests                                        |
| `apps/dev-server/src/studio/components/LessonActivityEditor.tsx` | Create | Markdown lesson form                                    |
| `apps/dev-server/src/studio/components/QuizActivityEditor.tsx`   | Create | MCQ form                                                |
| `apps/dev-server/src/studio/components/ActivityEditorRouter.tsx` | Create | Route by activity kind                                  |
| `apps/dev-server/src/studio/components/ShareView.tsx`            | Create | Ready check + export                                    |
| `apps/dev-server/src/studio/components/ShareView.test.tsx`       | Create | Share tests                                             |
| `apps/dev-server/src/studio/StudioApp.tsx`                       | Create | Creator shell / view router                             |
| `apps/dev-server/src/studio/StudioApp.test.tsx`                  | Create | Shell integration tests                                 |
| `apps/dev-server/src/DevApp.tsx`                                 | Modify | Mode gate: Creator → StudioApp; Developer → existing UI |
| `apps/dev-server/src/DevApp.test.tsx`                            | Modify | Creator default hides inspectors                        |
| `apps/dev-server/src/index.ts`                                   | Modify | Console banner “Course Creator Studio”                  |

---

### Task 1: Add `studio` i18n namespace

**Files:**

- Create: `packages/i18n/locales/en/studio.json`
- Modify: `packages/i18n/src/namespaces.ts`
- Modify: `packages/i18n/src/namespaces.test.ts`
- Modify: `apps/dev-server/src/main.tsx`

- [ ] **Step 1: Write failing namespace test expectation**

In `packages/i18n/src/namespaces.test.ts`, assert `studio` is included (adjust existing “contains expected namespaces” test):

```ts
expect(NAMESPACES).toContain('studio');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @open-edu/i18n test -- namespaces.test.ts`  
Expected: FAIL — `studio` not in `NAMESPACES`

- [ ] **Step 3: Add namespace + locale file**

`packages/i18n/src/namespaces.ts`:

```ts
export const NAMESPACES = ['runtime', 'learner', 'widgets', 'schemas', 'studio'] as const;
```

`packages/i18n/locales/en/studio.json`:

```json
{
  "brand.name": "OpenEdu Studio",
  "brand.subtitle": "Course Creator",
  "mode.creator": "Creator",
  "mode.developer": "Developer",
  "mode.toggleLabel": "Studio mode",
  "nav.home": "Home",
  "nav.outline": "Outline",
  "nav.preview": "Preview",
  "nav.share": "Share",
  "nav.editActivity": "Edit",
  "nav.backToOutline": "Back to outline",
  "home.title": "Create a course",
  "home.lede": "Start from a template. You’ll leave with a shareable package.",
  "home.templatesHeading": "Start from a template",
  "home.useTemplate": "Use template",
  "home.previewTemplate": "Preview template",
  "home.aiHeading": "Or start with AI",
  "home.aiLede": "Paste notes or upload a PDF — coming in a later Studio release.",
  "home.aiComingSoon": "Coming soon",
  "home.recentHeading": "Recent",
  "home.open": "Open",
  "home.emptyRecent": "No recent courses yet.",
  "outline.title": "Outline",
  "outline.addLesson": "Add lesson",
  "outline.addQuiz": "Add quiz",
  "outline.courseSettings": "Course settings",
  "outline.empty": "Add your first activity to get started.",
  "outline.kind.lesson": "Lesson",
  "outline.kind.quiz": "Quiz",
  "outline.kind.practice": "Practice",
  "outline.kind.other": "Activity",
  "editor.lesson.titleLabel": "Lesson title",
  "editor.lesson.bodyLabel": "Lesson content",
  "editor.lesson.bodyHint": "Use Markdown. Start with a heading.",
  "editor.quiz.titleLabel": "Quiz title",
  "editor.quiz.questionLabel": "Question",
  "editor.quiz.optionsLabel": "Answers",
  "editor.quiz.addOption": "Add option",
  "editor.quiz.correct": "Correct",
  "editor.save": "Save",
  "editor.saved": "Saved",
  "share.title": "Share this course",
  "share.lede": "We’ll check it’s ready, then give you a file students can open in the learner app.",
  "share.readyHeading": "Ready check",
  "share.exportOep": "Export .oep file",
  "share.exporting": "Exporting…",
  "share.howToHeading": "How students open it",
  "share.howTo.step1": "Open the OpenEdu learner app",
  "share.howTo.step2": "Choose Install course",
  "share.howTo.step3": "Pick the .oep file you sent",
  "share.howTo.step4": "Start learning",
  "share.copyInstructions": "Copy instructions",
  "share.copied": "Copied",
  "share.exportFailed": "Could not export. Fix the ready-check items and try again.",
  "ready.hasTitle": "Course has a title",
  "ready.hasActivity": "At least one activity",
  "ready.quizHasCorrect": "Every quiz has a correct answer",
  "ready.markdownHasHeading": "Every lesson has a heading",
  "ready.packageValid": "Package files are valid",
  "preview.resetProgress": "Reset progress",
  "developer.openEditors": "Open file editors",
  "errors.generic": "Something went wrong. Try again."
}
```

- [ ] **Step 4: Wire dictionary in `main.tsx`**

```tsx
import studioEn from '@open-edu/i18n/locales/en/studio.json';

const dictionaries = {
  en: {
    runtime: runtimeEn as Record<string, string>,
    learner: learnerEn as Record<string, string>,
    widgets: widgetsEn as Record<string, string>,
    schemas: schemasEn as Record<string, string>,
    studio: studioEn as Record<string, string>,
  },
};
```

Confirm `packages/i18n/package.json` exports `./locales/en/*.json` (already used for other locales). If `studio.json` is not matched, extend the export glob the same way as existing locale files.

- [ ] **Step 5: Re-run tests**

Run: `pnpm --filter @open-edu/i18n test -- namespaces.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/locales/en/studio.json packages/i18n/src/namespaces.ts packages/i18n/src/namespaces.test.ts apps/dev-server/src/main.tsx
git commit -m "$(cat <<'EOF'
feat(i18n): add studio namespace for Course Creator Studio

EOF
)"
```

---

### Task 2: Studio types + mode persistence

**Files:**

- Create: `apps/dev-server/src/studio/types.ts`
- Create: `apps/dev-server/src/studio/modeStorage.ts`
- Create: `apps/dev-server/src/studio/modeStorage.test.ts`

- [ ] **Step 1: Write failing modeStorage tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getStudioMode, setStudioMode, STUDIO_MODE_KEY } from './modeStorage';

describe('modeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to creator', () => {
    expect(getStudioMode()).toBe('creator');
  });

  it('persists developer mode', () => {
    setStudioMode('developer');
    expect(localStorage.getItem(STUDIO_MODE_KEY)).toBe('developer');
    expect(getStudioMode()).toBe('developer');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(STUDIO_MODE_KEY, 'nope');
    expect(getStudioMode()).toBe('creator');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `pnpm --filter @open-edu/dev-server test -- modeStorage.test.ts`

- [ ] **Step 3: Implement types + storage**

`types.ts`:

```ts
export type StudioMode = 'creator' | 'developer';

export type StudioView = 'home' | 'outline' | 'edit-activity' | 'preview' | 'share';

export type ActivityKind = 'lesson' | 'quiz' | 'practice' | 'other';

export interface ActivitySummary {
  id: string;
  path: string;
  title: string;
  kind: ActivityKind;
}

export interface ReadyCheckItem {
  id: string;
  labelKey: string; // studio.* i18n key
  passed: boolean;
  detail?: string;
}

export interface TemplateMeta {
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** Relative files written into a new/overwrite package dir */
  files: Record<string, string>;
}
```

`modeStorage.ts`:

```ts
import type { StudioMode } from './types.js';

export const STUDIO_MODE_KEY = 'openedu.studio.mode';

export function getStudioMode(): StudioMode {
  const value = localStorage.getItem(STUDIO_MODE_KEY);
  return value === 'developer' ? 'developer' : 'creator';
}

export function setStudioMode(mode: StudioMode): void {
  localStorage.setItem(STUDIO_MODE_KEY, mode);
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/dev-server/src/studio/types.ts apps/dev-server/src/studio/modeStorage.ts apps/dev-server/src/studio/modeStorage.test.ts
git commit -m "$(cat <<'EOF'
feat(dev-server): add studio mode types and persistence

EOF
)"
```

---

### Task 3: Outline model + ready check (pure logic)

**Files:**

- Create: `apps/dev-server/src/studio/outlineModel.ts`
- Create: `apps/dev-server/src/studio/outlineModel.test.ts`
- Create: `apps/dev-server/src/studio/readyCheck.ts`
- Create: `apps/dev-server/src/studio/readyCheck.test.ts`

- [ ] **Step 1: Write outlineModel failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  detectActivityKind,
  buildLinearWorkflow,
  activitiesFromEntryOrder,
  titleFromMarkdown,
  titleFromQuizJson,
} from './outlineModel';

describe('outlineModel', () => {
  it('detects lesson vs quiz by extension/content', () => {
    expect(detectActivityKind('nodes/intro.md', '# Hi')).toBe('lesson');
    expect(detectActivityKind('nodes/q1.json', '{"type":"quiz","question":"Q","options":[]}')).toBe(
      'quiz',
    );
  });

  it('builds linear workflow from ordered paths', () => {
    const wf = buildLinearWorkflow(['nodes/a.md', 'nodes/b.json'], 'nodes/a.md');
    expect(wf.entry).toBe('nodes/a.md');
    expect(wf.routing['nodes/a.md']).toEqual({ next: 'nodes/b.json' });
    expect(wf.routing['nodes/b.json']).toEqual({ next: null });
  });

  it('extracts titles', () => {
    expect(titleFromMarkdown('# Fractions\n\nHello')).toBe('Fractions');
    expect(titleFromQuizJson('{"type":"quiz","question":"What is 1/2?","options":[]}')).toBe(
      'What is 1/2?',
    );
  });
});
```

- [ ] **Step 2: Implement `outlineModel.ts`**

```ts
import type { ActivityKind, ActivitySummary } from './types.js';

export function detectActivityKind(path: string, content: string): ActivityKind {
  if (path.endsWith('.md')) return 'lesson';
  if (path.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content) as { type?: string };
      if (parsed.type === 'quiz') return 'quiz';
      if (parsed.type === 'widget' || parsed.type === 'exercise') return 'practice';
    } catch {
      return 'other';
    }
  }
  return 'other';
}

export function titleFromMarkdown(content: string): string {
  const match = content.match(/^#{1,6}\s+(.+)$/m);
  return match?.[1]?.trim() || 'Untitled lesson';
}

export function titleFromQuizJson(content: string): string {
  try {
    const parsed = JSON.parse(content) as { question?: string; title?: string };
    return parsed.title || parsed.question || 'Untitled quiz';
  } catch {
    return 'Untitled quiz';
  }
}

export function buildLinearWorkflow(orderedPaths: string[], entry: string) {
  const routing: Record<string, { next: string | null }> = {};
  for (let i = 0; i < orderedPaths.length; i++) {
    const path = orderedPaths[i]!;
    routing[path] = { next: orderedPaths[i + 1] ?? null };
  }
  return {
    entry: orderedPaths.includes(entry) ? entry : (orderedPaths[0] ?? entry),
    routing,
  };
}

export function activitiesFromEntryOrder(
  orderedPaths: string[],
  files: Map<string, string>,
): ActivitySummary[] {
  return orderedPaths.map((path) => {
    const content = files.get(path) ?? '';
    const kind = detectActivityKind(path, content);
    const title =
      kind === 'lesson'
        ? titleFromMarkdown(content)
        : kind === 'quiz'
          ? titleFromQuizJson(content)
          : path.split('/').pop() || path;
    return { id: path, path, title, kind };
  });
}
```

Match workflow shape to `@open-edu/schemas` `WorkflowSchema` used by the package (if schema requires additional fields like `version`, include the minimal valid object — read `WorkflowSchema` and align the returned object so `WorkflowSchema.safeParse` succeeds).

- [ ] **Step 3: Write readyCheck tests + implementation**

```ts
// readyCheck.ts
import type { ReadyCheckItem } from './types.js';
import { detectActivityKind } from './outlineModel.js';

export interface ReadyCheckInput {
  title: string;
  files: Map<string, string>; // path -> content for nodes + manifest
  validationErrors: Array<{ path: string; error: string }>;
}

export function buildReadyCheck(input: ReadyCheckInput): ReadyCheckItem[] {
  const nodePaths = [...input.files.keys()].filter((p) => p.startsWith('nodes/'));
  const items: ReadyCheckItem[] = [
    {
      id: 'hasTitle',
      labelKey: 'studio.ready.hasTitle',
      passed: Boolean(input.title.trim()),
    },
    {
      id: 'hasActivity',
      labelKey: 'studio.ready.hasActivity',
      passed: nodePaths.length > 0,
    },
  ];

  let quizzesOk = true;
  let lessonsOk = true;
  for (const path of nodePaths) {
    const content = input.files.get(path) ?? '';
    const kind = detectActivityKind(path, content);
    if (kind === 'quiz') {
      try {
        const parsed = JSON.parse(content) as {
          options?: Array<{ correct?: boolean }>;
        };
        if (!parsed.options?.some((o) => o.correct)) quizzesOk = false;
      } catch {
        quizzesOk = false;
      }
    }
    if (kind === 'lesson' && !/^#{1,6}\s/m.test(content)) lessonsOk = false;
  }

  items.push({
    id: 'quizHasCorrect',
    labelKey: 'studio.ready.quizHasCorrect',
    passed: quizzesOk,
  });
  items.push({
    id: 'markdownHasHeading',
    labelKey: 'studio.ready.markdownHasHeading',
    passed: lessonsOk,
  });
  items.push({
    id: 'packageValid',
    labelKey: 'studio.ready.packageValid',
    passed: input.validationErrors.length === 0,
    detail: input.validationErrors[0]?.error,
  });

  return items;
}

export function isReadyToExport(items: ReadyCheckItem[]): boolean {
  return items.every((i) => i.passed);
}
```

Tests should cover: empty package fails; valid lesson+quiz passes; quiz without correct fails.

- [ ] **Step 4: Run**

`pnpm --filter @open-edu/dev-server test -- outlineModel.test.ts readyCheck.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dev-server/src/studio/outlineModel.ts apps/dev-server/src/studio/outlineModel.test.ts apps/dev-server/src/studio/readyCheck.ts apps/dev-server/src/studio/readyCheck.test.ts
git commit -m "$(cat <<'EOF'
feat(dev-server): add studio outline model and ready-check helpers

EOF
)"
```

---

### Task 4: Template catalog (in-repo starters)

**Files:**

- Create: `apps/dev-server/src/studio/templates/catalog.ts`
- Create: `apps/dev-server/src/studio/templates/catalog.test.ts`

- [ ] **Step 1: Write catalog test**

```ts
import { describe, it, expect } from 'vitest';
import { STUDIO_TEMPLATES, getTemplateById } from './catalog';

describe('STUDIO_TEMPLATES', () => {
  it('includes at least three templates with package.json + entry node', () => {
    expect(STUDIO_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const t of STUDIO_TEMPLATES) {
      expect(t.files['package.json']).toBeTruthy();
      const manifest = JSON.parse(t.files['package.json']!);
      expect(manifest.entry).toBeTruthy();
      expect(t.files[manifest.entry]).toBeTruthy();
    }
  });

  it('getTemplateById returns reading-lesson', () => {
    expect(getTemplateById('reading-lesson')?.id).toBe('reading-lesson');
  });
});
```

- [ ] **Step 2: Implement four templates**

Implement `STUDIO_TEMPLATES` with ids:

1. `reading-lesson` — `package.json` + `nodes/lesson.md` + linear `workflow.json`
2. `lesson-quiz` — lesson + quiz JSON with one correct option
3. `practice-stub` — lesson + simple quiz labeled as practice warm-up (full widget picker is Phase 2; do **not** require widget JSON yet — keep Phase 1 YAGNI)
4. `short-unit` — lesson + quiz + short closing lesson

Each `package.json` must satisfy `PackageManifestSchema` (`id`, `title`, `version`, `author`, `entry`). Markdown must include `# Heading`. Quiz must satisfy `ContentNodeSchema` quiz shape used by the repo (read an example under `examples/hello-world` or `examples/fractions` and mirror).

Add i18n keys for template titles/descriptions to `studio.json` (e.g. `studio.template.readingLesson.title`) and reference via `titleKey` / `descriptionKey` on `TemplateMeta` — update `types.ts` if keys were placeholders.

- [ ] **Step 3: Run catalog tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add apps/dev-server/src/studio/templates packages/i18n/locales/en/studio.json
git commit -m "$(cat <<'EOF'
feat(dev-server): add Course Creator Studio template catalog

EOF
)"
```

---

### Task 5: StudioAPI client + Vite endpoints (template, outline, export)

**Files:**

- Modify: `apps/dev-server/package.json` (add `@open-edu/oep-distribution`)
- Create: `apps/dev-server/src/studio/studioApi.ts`
- Create: `apps/dev-server/src/studio/studioApi.test.ts`
- Modify: `apps/dev-server/vite.config.ts`

- [ ] **Step 1: Add dependency**

```bash
pnpm --filter @open-edu/dev-server add @open-edu/oep-distribution@workspace:*
```

- [ ] **Step 2: Define client API**

`studioApi.ts`:

```ts
import type { ActivitySummary, ReadyCheckItem } from './types.js';

const API_BASE = '/api/package';

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed: ${res.status}`);
  }
  return data as T;
}

export function createStudioApi() {
  return {
    getPackageDir: () => apiRequest<{ packageDir: string }>('/dir').then((d) => d.packageDir),
    validate: () =>
      apiRequest<{ valid: boolean; errors: Array<{ path: string; error: string }> }>('/validate', {
        method: 'POST',
      }),
    getOutline: () => apiRequest<{ activities: ActivitySummary[]; title: string }>('/outline'),
    saveOutlineOrder: (orderedPaths: string[]) =>
      apiRequest<{ success: boolean }>('/outline', {
        method: 'PUT',
        body: JSON.stringify({ orderedPaths }),
      }),
    applyTemplate: (templateId: string) =>
      apiRequest<{ success: boolean }>('/create-from-template', {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      }),
    exportOep: async () => {
      const res = await fetch(`${API_BASE}/export-oep`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      return { blob, fileName: match?.[1] || 'course.oep' };
    },
    readFile: (path: string) =>
      apiRequest<{ path: string; content: string }>(`/file?path=${encodeURIComponent(path)}`),
    writeFile: (path: string, content: string) =>
      apiRequest<{ success: boolean }>('/file', {
        method: 'PUT',
        body: JSON.stringify({ path, content, validate: true }),
      }),
  };
}

export type StudioApi = ReturnType<typeof createStudioApi>;
```

- [ ] **Step 3: Implement Vite middleware**

In `apps/dev-server/vite.config.ts` package API plugin, add:

**GET `/api/package/outline`**

- Read `package.json`, `workflow.json` (if missing, order `nodes/*` alphabetically with manifest.entry first)
- Read each node file content
- Return `{ title, activities }` using `activitiesFromEntryOrder` (import from a small shared place — either duplicate minimal helpers in vite plugin OR extract `outlineModel` to a `.ts` file importable from both Vite config and client). Prefer: keep pure helpers in `src/studio/outlineModel.ts` and import them in `vite.config.ts` the same way `loadPackage` is imported today.

**PUT `/api/package/outline`**

- Body: `{ orderedPaths: string[] }`
- Write `workflow.json` via `buildLinearWorkflow`
- Update `package.json` `entry` to `orderedPaths[0]` if needed
- Validate with `WorkflowSchema` / `PackageManifestSchema`

**POST `/api/package/create-from-template`**

- Body: `{ templateId }`
- Resolve template from catalog (import `getTemplateById`)
- Write all template files into `currentDir` (confirm overwrite only when dir has no nodes **or** require `?force=true` — choose: **refuse if `nodes/` already has files** unless `force: true` in body; Creator Home always creates into empty/new session package for Phase 1)
- Return `{ success: true }`

**POST `/api/package/export-oep`**

- Mirror `packages/cli/src/commands/oep-build.ts` `collectCourseFiles` + `OepWriter.build`
- Respond with `application/octet-stream` and `Content-Disposition: attachment; filename="<id>-<version>.oep"`
- On validation failure, 400 JSON `{ error, errors }`

- [ ] **Step 4: Client unit tests with mocked fetch**

Test `createStudioApi().getOutline` parses JSON; `exportOep` returns blob + filename from header.

- [ ] **Step 5: Run**

`pnpm --filter @open-edu/dev-server test -- studioApi.test.ts`  
Also `pnpm --filter @open-edu/dev-server typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/dev-server/package.json apps/dev-server/src/studio/studioApi.ts apps/dev-server/src/studio/studioApi.test.ts apps/dev-server/vite.config.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(dev-server): add studio API endpoints for outline, templates, and oep export

EOF
)"
```

---

### Task 6: ModeToggle + StudioTopBar (design-system)

**Files:**

- Create: `apps/dev-server/src/studio/components/ModeToggle.tsx`
- Create: `apps/dev-server/src/studio/components/ModeToggle.test.tsx`
- Create: `apps/dev-server/src/studio/components/StudioTopBar.tsx`

- [ ] **Step 1: Failing ModeToggle test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { ModeToggle } from './ModeToggle';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

describe('ModeToggle', () => {
  it('calls onChange when switching to developer', async () => {
    const onChange = vi.fn();
    render(wrap(<ModeToggle mode="creator" onChange={onChange} />));
    await userEvent.click(screen.getByRole('switch', { name: /studio mode/i }));
    expect(onChange).toHaveBeenCalledWith('developer');
  });
});
```

- [ ] **Step 2: Implement with design-system `Switch`**

```tsx
import { Switch } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import type { StudioMode } from '../types.js';

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
}) {
  const { t } = useTranslation('studio');
  const checked = mode === 'developer';
  return (
    <label className="text-on-surface-variant flex items-center gap-2 text-sm">
      <span>{t('mode.creator')}</span>
      <Switch
        checked={checked}
        onCheckedChange={(value) => onChange(value ? 'developer' : 'creator')}
        aria-label={t('mode.toggleLabel')}
      />
      <span>{t('mode.developer')}</span>
    </label>
  );
}
```

Verify `Switch` props against `packages/design-system/src/primitives/switch.tsx` (`checked` / `onCheckedChange`). Adjust to the real API if names differ.

- [ ] **Step 3: StudioTopBar using `TopAppBar` or composition**

Prefer composing design-system primitives rather than forking TopAppBar course-progress behavior:

```tsx
import { Button, cn } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { ModeToggle } from './ModeToggle.js';
import type { StudioMode, StudioView } from '../types.js';

export function StudioTopBar({
  mode,
  onModeChange,
  view,
  onNavigate,
  courseTitle,
}: {
  mode: StudioMode;
  onModeChange: (m: StudioMode) => void;
  view: StudioView;
  onNavigate: (view: StudioView) => void;
  courseTitle?: string;
}) {
  const { t } = useTranslation('studio');
  return (
    <header
      className={cn(
        'border-outline-variant bg-surface flex flex-wrap items-center gap-3 border-b px-4 py-3',
      )}
    >
      <div className="text-on-surface font-semibold tracking-tight">
        {t('brand.name')}
        <span className="text-on-surface-variant ml-2 text-sm font-normal">
          {t('brand.subtitle')}
        </span>
      </div>
      {courseTitle ? <span className="text-on-surface-variant text-sm">{courseTitle}</span> : null}
      <div className="flex-1" />
      {view !== 'home' ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('outline')}>
            {t('nav.outline')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('preview')}>
            {t('nav.preview')}
          </Button>
          <Button variant="default" size="sm" onClick={() => onNavigate('share')}>
            {t('nav.share')}
          </Button>
        </>
      ) : null}
      <ModeToggle mode={mode} onChange={onModeChange} />
    </header>
  );
}
```

Use only tokenized classes. Do not copy learner `TopAppBar` a11y font controls unless needed — Creator can rely on existing `FontSizeProvider` at root.

- [ ] **Step 4: Tests PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): add studio mode toggle and top bar

EOF
)"
```

---

### Task 7: Phase 0 shell — Creator default hides DevTools

**Files:**

- Create: `apps/dev-server/src/studio/StudioApp.tsx` (minimal shell first)
- Modify: `apps/dev-server/src/DevApp.tsx`
- Modify: `apps/dev-server/src/DevApp.test.tsx`
- Modify: `apps/dev-server/src/index.ts`

- [ ] **Step 1: Update DevApp tests for Creator default**

Change expectations:

- Inspector / “DevTools” / Telemetry **not** in the document when mode is creator (default).
- A control exists to switch to Developer.
- In developer mode, inspector appears again.

Example assertion direction:

```ts
it('hides developer inspector by default in creator mode', async () => {
  renderWithProviders(<DevApp />);
  expect(screen.queryByLabelText(/developer inspector panel/i)).not.toBeInTheDocument();
  expect(screen.queryByText('Telemetry')).not.toBeInTheDocument();
});
```

Update any existing tests that assumed inspector always visible.

- [ ] **Step 2: Gate DevApp**

In both `SinglePackageDevApp` and `BundleDevApp`:

```tsx
const [studioMode, setStudioModeState] = useState<StudioMode>(() => getStudioMode());

const setStudioModeAndPersist = useCallback((mode: StudioMode) => {
  setStudioMode(mode);
  setStudioModeState(mode);
}, []);

if (studioMode === 'creator') {
  return (
    <RuntimeThemeProvider>
      <StudioApp
        mode={studioMode}
        onModeChange={setStudioModeAndPersist}
        // pass preview render prop or callbacks for preview/reset as needed
      />
    </RuntimeThemeProvider>
  );
}

// existing developer preview + InspectorPanel + Edit Package path
```

For Phase 0 minimal `StudioApp`: show `StudioTopBar` + simple message “Open Outline to edit” + button to existing preview embedded later. Prefer wiring `view` state immediately so Phase 1 screens plug in cleanly.

Developer path: keep current `EditorShell` + `InspectorPanel` behavior; relabel “Edit Package” → use `t('studio.developer.openEditors')` when easy, else keep English only in developer chrome (Creator strings must be i18n; Developer may keep technical labels).

- [ ] **Step 3: Update startup banner in `index.ts`**

```ts
console.log(`\n  ✨  OpenEdu Course Creator Studio`);
```

- [ ] **Step 4: Update package description**

`"description": "OpenEdu Course Creator Studio (local hybrid authoring + preview)"`

- [ ] **Step 5: Run DevApp tests — PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): default to Creator mode and hide DevTools inspectors

EOF
)"
```

---

### Task 8: HomeView — template gallery + AI stub + recent

**Files:**

- Create: `apps/dev-server/src/studio/components/HomeView.tsx`
- Create: `apps/dev-server/src/studio/components/HomeView.test.tsx`
- Create: `apps/dev-server/src/studio/recentCourses.ts` (+ test)
- Wire into `StudioApp`

- [ ] **Step 1: recentCourses helper**

Store `{ id, title, packageDir, updatedAt }[]` in `localStorage` key `openedu.studio.recent` (max 10). `recordRecentCourse`, `listRecentCourses`.

- [ ] **Step 2: HomeView UI**

Use `PageHeader` or `Card` grid from design-system:

```tsx
import {
  Button,
  Card,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from '@open-edu/design-system';
```

- List `STUDIO_TEMPLATES` with `t(template.titleKey)`
- Primary CTA calls `api.applyTemplate(id)` then `onOpened()` → navigate outline
- AI card: disabled button `t('home.aiComingSoon')` (Phase 3)
- Recent list from `listRecentCourses`

- [ ] **Step 3: Tests** — render templates; clicking Use template calls mock api; AI button disabled

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): add studio home with template gallery

EOF
)"
```

---

### Task 9: OutlineView — spine + reorder + add lesson/quiz

**Files:**

- Create: `apps/dev-server/src/studio/components/OutlineView.tsx`
- Create: `apps/dev-server/src/studio/components/OutlineView.test.tsx`

- [ ] **Step 1: Load outline via `api.getOutline()` on mount**

- [ ] **Step 2: Render activity list with kind badges (`Badge`)**

- [ ] **Step 3: Reorder**

Phase 1 may use **Move up / Move down** buttons (design-system `Button`) instead of drag-and-drop to reduce risk. On change, call `api.saveOutlineOrder(paths)`.

- [ ] **Step 4: Add lesson / Add quiz**

Create files via existing `createFile` patterns:

- Lesson: `nodes/lesson-<timestamp>.md` with `# New lesson\n\n`
- Quiz: minimal valid quiz JSON with one correct option  
  Then append to outline order and save workflow.

- [ ] **Step 5: Edit navigates to `edit-activity` with selected path**

- [ ] **Step 6: Tests + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): add creator outline view with reorder and add actions

EOF
)"
```

---

### Task 10: Activity editors (lesson + quiz forms)

**Files:**

- Create: `apps/dev-server/src/studio/components/LessonActivityEditor.tsx`
- Create: `apps/dev-server/src/studio/components/QuizActivityEditor.tsx`
- Create: `apps/dev-server/src/studio/components/ActivityEditorRouter.tsx`
- Tests for quiz editor (correct-option enforcement)

- [ ] **Step 1: Lesson editor**

`Input` title (syncs first markdown `#` heading) + `Textarea` body. Save → `api.writeFile`. Coaching: if no heading, show tip using tokenized warning surface (`bg-warning-container` / `text-on-warning-container` if tokens exist; otherwise `text-error` + `border-outline-variant` — check design tokens before inventing colors).

- [ ] **Step 2: Quiz editor**

Controlled question + options list; radio/checkbox for correct via design-system `RadioGroup` or button toggle marking one correct. Serialize to quiz content node JSON matching schema. Save via API.

- [ ] **Step 3: Router picks editor by `ActivityKind`**

Practice/other in Phase 1: read-only message “Open Developer mode for advanced activity types” + link to switch mode — do not build widget forms yet.

- [ ] **Step 4: Tests + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): add creator lesson and quiz activity editors

EOF
)"
```

---

### Task 11: Preview in Creator (no inspectors) + ShareView export

**Files:**

- Modify: `StudioApp.tsx` to embed existing preview runtime tree without `InspectorPanel`
- Create: `apps/dev-server/src/studio/components/ShareView.tsx`
- Create: `apps/dev-server/src/studio/components/ShareView.test.tsx`

- [ ] **Step 1: Creator preview**

Reuse the same `RuntimeProvider` + `LayoutShell` path as `DevApp`, but:

- No `InspectorPanel`
- Top bar stays StudioTopBar
- Reset progress button labeled via `t('preview.resetProgress')`

Extract a `PackagePreview` inner component from `DevApp` if duplication is painful — keep the extract minimal and local to `apps/dev-server/src/studio/` or `DevApp.tsx`.

- [ ] **Step 2: ShareView**

- On mount: gather files + `api.validate()` → `buildReadyCheck`
- Render checklist with pass/fail
- Export button disabled until `isReadyToExport`
- On export: `api.exportOep()` → trigger browser download via `URL.createObjectURL`
- How-to steps + copy instructions (`navigator.clipboard.writeText`)

- [ ] **Step 3: Tests** — export disabled when ready check fails; enabled when all pass (mock api)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): add creator preview without DevTools and share/export .oep

EOF
)"
```

---

### Task 12: End-to-end StudioApp wiring + acceptance polish

**Files:**

- Modify: `apps/dev-server/src/studio/StudioApp.tsx`
- Modify: `apps/dev-server/src/studio/StudioApp.test.tsx`
- Modify: `apps/dev-server/src/DevApp.test.tsx` as needed
- Optionally short note in `apps/dev-server` or root docs — only if an existing README mentions dev-server (do not create unsolicited markdown beyond this plan/spec)

- [ ] **Step 1: View router**

```tsx
switch (view) {
  case 'home':
    return <HomeView ... />;
  case 'outline':
    return <OutlineView ... />;
  case 'edit-activity':
    return <ActivityEditorRouter path={selectedPath} ... />;
  case 'preview':
    return <CreatorPreview ... />;
  case 'share':
    return <ShareView ... />;
}
```

- [ ] **Step 2: Manual acceptance script (run locally)**

```bash
pnpm --filter @open-edu/cli build
# use an empty/temp package dir OR apply template via UI after edu dev
node packages/cli/dist/cli.js dev ./examples/hello-world
```

Checklist from spec §11:

- [ ] Creator default; Developer toggle persists across reload
- [ ] Home templates visible; AI stub is Coming soon
- [ ] Outline add/reorder updates preview order
- [ ] Lesson + quiz editable without raw JSON
- [ ] Preview has no Telemetry/DevTools
- [ ] Share exports `.oep` and shows learner instructions
- [ ] No CLI steps required after Studio is running (besides initial `edu dev`)

- [ ] **Step 3: Full verification**

```bash
pnpm --filter @open-edu/dev-server test
pnpm --filter @open-edu/dev-server typecheck
pnpm --filter @open-edu/dev-server lint
pnpm --filter @open-edu/i18n test
```

- [ ] **Step 4: Final commit if needed for polish**

```bash
git commit -m "$(cat <<'EOF'
feat(dev-server): wire Course Creator Studio Phase 1 creator loop

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement (Phase 0–1)      | Task                           |
| --------------------------------- | ------------------------------ |
| Creator default / DevTools hidden | Task 7                         |
| Creator vs Developer toggle       | Tasks 2, 6, 7                  |
| Template gallery                  | Tasks 4, 8                     |
| AI start path                     | Task 8 stub (Phase 3 explicit) |
| Outline spine                     | Tasks 3, 5, 9                  |
| Lesson + quiz forms               | Task 10                        |
| Preview without DevTools          | Task 11                        |
| Ready check + `.oep` export       | Tasks 3, 5, 11                 |
| Design-system + tokens            | Constraints + Tasks 6–11       |
| i18n                              | Task 1 + all UI tasks          |
| Hybrid StudioAPI boundary         | Task 5                         |
| Full widgets/rewards/AI/hosted    | Explicitly out of scope        |

**Placeholder scan:** No TBD implementation steps; open product questions (final brand string, exact template subjects) are decided enough for engineering (`OpenEdu Studio` + four templates).  
**Type consistency:** `StudioMode`, `StudioView`, `ActivitySummary`, `ReadyCheckItem`, `StudioApi` used consistently across tasks.

---

## Follow-on plans (do not implement here)

1. **Phase 2** — widget picker, guided branching, rewards/cards forms
2. **Phase 3** — AI generate via course-compiler / authoring skill
3. **Phase 4** — multi-course library + light bundles
4. **Phase 5** — `CloudStudioAdapter` + auth/storage

---

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-08-05-course-creator-studio-phase0-1.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
