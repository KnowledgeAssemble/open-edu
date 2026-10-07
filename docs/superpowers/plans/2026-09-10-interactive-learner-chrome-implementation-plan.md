# Implementation Plan — Interactive Learner Chrome (OpenEdu)

**Date:** 2026-09-10  
**Repo:** `open-edu`  
**Depends on:** `openedu-interactive` plan `docs/superpowers/specs/2026-09-10-interactive-react-learner-surface-implementation-plan.md` merged or linked locally (`@knowledgeassemble/interactive-react` ≥ learner-surface)  
**Target agent:** Cursor agent on **`deepseek-4-flash`**  
**Branch:** `feat/interactive-learner-chrome` from current `main`  
**Deliverable:** 1–2 PRs — learner prompt chrome, hide debug UI, schema + tests, e2e click

---

## Agent briefing (read before coding)

OpenEdu renders `{ type: "interactive" }` nodes via `@open-edu/runtime` → `InteractiveRenderer` → `@open-edu/interactive-runtime` → `@knowledgeassemble/interactive-react`.

**This plan does NOT fix SVG clicks** — that is the `openedu-interactive` IR plan. Without IR plan, learners still cannot click the canvas (only broken dev buttons).

### Current learner-facing bugs (this plan fixes)

| Bug                           | File                                                     |
| ----------------------------- | -------------------------------------------------------- |
| No prompt / instructions      | `packages/runtime/src/renderers/InteractiveRenderer.tsx` |
| `0 interactions` debug text   | same                                                     |
| Tests assert dev button strip | `InteractiveRenderer.test.tsx`                           |
| E2E asserts `0 interactions`  | `tests/e2e/package-execution.spec.ts`                    |
| No `prompt` on schema         | `packages/schemas/src/nodes.ts`                          |

### D7 boundary

| OpenEdu owns                        | Engine owns                              |
| ----------------------------------- | ---------------------------------------- |
| `node.title`, `node.prompt` display | SVG + semantic targets                   |
| Mark complete, workflow             | D5 events                                |
| Scoring / feedback (Phase OC-2)     | `spec.purpose` (authoring metadata only) |

### Rules

1. Run **openedu-interactive IR plan first** or use `pnpm.overrides` with IR branch built locally.
2. One task at a time; verification after each phase.
3. Test-first when specified.
4. All user strings via `@open-edu/i18n` — no hard-coded learner copy in components.
5. ESM / existing package conventions.

### Repo commands (workspace root)

```bash
pnpm install
pnpm --filter @open-edu/schemas build
pnpm --filter @open-edu/runtime test
pnpm --filter @open-edu/interactive-runtime test
pnpm test:e2e tests/e2e/package-execution.spec.ts -g "interactive-demo"
```

---

## PR split

| PR      | Phases      | Scope                                                               |
| ------- | ----------- | ------------------------------------------------------------------- |
| **PR1** | OC-0 + OC-1 | Prompt chrome, hide debug counter, update unit tests                |
| **PR2** | OC-2 + OC-3 | Optional `prompt` schema, e2e SVG click, interactive-runtime README |

---

## Phase OC-0 — Dependency on learner-surface

**Exit gate:** `interactive-demo` loads with updated `@knowledgeassemble/interactive-react`.

### Task OC-0-1 — Link local engine (dev only)

If IR plan not published, ensure `open-edu/package.json` has `pnpm.overrides` for all `@knowledgeassemble/*` packages pointing at `../openedu-interactive/packages/*`.

```bash
cd ../openedu-interactive && pnpm build
cd ../open-edu && pnpm install
```

Confirm `node_modules/@knowledgeassemble/interactive-react` resolves to local package.

### Task OC-0-2 — Verify click works manually

```bash
pnpm --filter @open-edu/cli build
edu dev examples/interactive-demo
```

Preview → number-line step → click **7** on SVG (not dev buttons). If clicks fail, **stop** — complete IR plan first.

---

## Phase OC-1 — `InteractiveRenderer` learner chrome

**Exit gate:** `pnpm --filter @open-edu/runtime test` green.

### Task OC-1-1 — Prompt header (test-first)

**File:** `packages/runtime/src/renderers/InteractiveRenderer.test.tsx`

Add before other tests:

```typescript
it('renders node title as the activity prompt heading', async () => {
  const { getByRole } = renderWithProvider(
    <InteractiveRenderer node={interactiveNode()} nodeId="nodes/nl-01.md" />,
    'nodes/nl-01.md',
  );
  expect(getByRole('heading', { name: 'Number line' })).toBeInTheDocument();
});
```

`interactiveNode()` already sets `title: 'Number line'`.

### Task OC-1-2 — Implement prompt UI

**File:** `packages/runtime/src/renderers/InteractiveRenderer.tsx`

Inside `data-testid="interactive-renderer"` region, **before** `InteractiveNodeView`:

```tsx
{
  (node.title ?? node.prompt) && (
    <header className="mb-4">
      {node.title && <h2 className="text-heading-sm text-foreground">{node.title}</h2>}
      {node.prompt && <p className="text-body-ui text-muted-foreground mt-1">{node.prompt}</p>}
    </header>
  );
}
```

Until OC-2 adds `prompt` to schema, use optional chaining — TypeScript may need schema update first or cast `node as InteractiveNode & { prompt?: string }`.

**Fallback:** If only `title` exists, show title only (current demo nodes).

**Do not** render `spec.purpose.learningObjective` to learners in v1 (authoring metadata).

### Task OC-1-3 — Remove learner-visible interaction counter

**Remove** or gate behind dev flag:

```tsx
// DELETE this block from learner UI:
<span className="text-caption text-muted-foreground">
  {t('runtime.interactive.interactions', { count: String(interactions) })}
</span>
```

Keep `interactions` state for telemetry / `saveAnswer` — do not remove internal counting.

**Layout:** `Mark complete` button — align right or full width per design-system patterns used in `QuizRenderer`.

```tsx
<div className="mt-4 flex justify-end">
  <Button type="button" onClick={handleComplete} disabled={!isReady}>
    {t('runtime.interactive.mark_complete')}
  </Button>
</div>
```

### Task OC-1-4 — Update existing tests

**File:** `packages/runtime/src/renderers/InteractiveRenderer.test.tsx`

| Old test                               | New expectation                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `findByText(/\(select\)$/)` dev button | **Remove** or click SVG `#nl-marker-7` instead (after IR plan)                   |
| `0 interactions` visible               | **Remove** — counter not in DOM                                                  |
| `increments on a control action`       | Click SVG interactive element; assert `saveAnswer` or telemetry via mock runtime |

Example SVG click test (jsdom):

```typescript
it('increments internal interaction count when SVG target is clicked', async () => {
  const saveAnswer = vi.fn();
  const { container, findByRole } = renderWithProvider(..., { saveAnswer });
  await findByRole('heading', { name: 'Number line' });
  const target = container.querySelector('#nl-marker-7');
  expect(target).toBeTruthy();
  fireEvent.click(target!);
  fireEvent.click(getByRole('button', { name: 'Mark complete' }));
  expect(saveAnswer).toHaveBeenCalledWith('nodes/nl-01.md', expect.objectContaining({ interactions: 1 }));
});
```

Wire `saveAnswer` through test `RuntimeProvider` if not already exposed.

### Task OC-1-5 — i18n (optional copy tweak)

**File:** `packages/i18n/locales/en/runtime.json`

Keep `interactive.interactions` for Studio inspector / telemetry only, or add comment in JSON. Optional new key:

```json
"interactive.instructions_default": "Interact with the activity below, then mark complete when you are done."
```

Only use if no `prompt` on node.

**Verify:** `pnpm --filter @open-edu/runtime test`

---

## Phase OC-2 — Schema: optional `prompt`

**Exit gate:** `pnpm --filter @open-edu/schemas test` green.

### Task OC-2-1 — Add `prompt` to interactive node

**File:** `packages/schemas/src/nodes.ts`

```typescript
const interactiveConfigShape = {
  engine: InteractiveEngineTypeSchema.optional(),
  spec: z.record(z.unknown()).optional(),
  id: InteractiveIdSchema.optional(),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).max(1024).optional(),  // NEW
  engines: ...
} as const;
```

Update `InteractiveNodeConfig` type if separate.

### Task OC-2-2 — Schema tests

**File:** `packages/schemas/src/nodes.test.ts`

```typescript
it('accepts optional prompt on single-engine interactive node', () => {
  const node = {
    type: 'interactive',
    engine: 'visual',
    title: 'Number line practice',
    prompt: 'Tap the emphasized number on the line.',
    spec: {
      type: 'visual',
      version: '1.0.0',
      id: 'x',
      content: { kind: 'number-line', components: [] },
      accessibility: { label: 'l' },
    },
  };
  expect(validateInteractiveNode(node).valid).toBe(true);
});
```

Rebuild schemas: `pnpm --filter @open-edu/schemas build`

### Task OC-2-3 — Update interactive-demo practice node

**File:** `examples/interactive-demo/nodes/number-line-practice.json`

```json
{
  "type": "interactive",
  "title": "Number line practice",
  "prompt": "Tap the emphasized number on the line.",
  "engine": "visual",
  ...
}
```

**File:** `examples/interactive-demo/validate.test.ts` — assert `prompt` present on practice node.

---

## Phase OC-3 — `interactive-runtime` + e2e

### Task OC-3-1 — README

**New file:** `packages/interactive-runtime/README.md`

Sections:

- Role: bridge + React view wrappers only
- Learner chrome lives in `@open-edu/runtime` `InteractiveRenderer`
- SVG clicks live in `@knowledgeassemble/interactive-react`
- `buildOpenEduBridge` / `buildSemanticTokens` usage example

### Task OC-3-2 — E2E: click SVG + prompt visible

**File:** `tests/e2e/package-execution.spec.ts` — `interactive-demo` describe block

Replace / extend:

```typescript
test('shows prompt and responds to SVG interaction', async ({ page }) => {
  await page.goto(server.url);
  await openStudioPreview(page);
  await page.getByRole('button', { name: 'Next' }).click(); // intro → guided NL
  await expect(page.getByRole('heading', { name: 'Number line' })).toBeVisible();
  // Click guided marker (or advance to practice step for discovery)
  await page.locator('#nl-marker-7').click();
  await expect(page.getByText('0 interactions')).not.toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).click();
});

test('number-line practice shows prompt and label click', async ({ page }) => {
  // Navigate through intro + guided NL to practice step
  await expect(page.getByRole('heading', { name: 'Number line practice' })).toBeVisible();
  await expect(page.getByText('Tap the emphasized number')).toBeVisible();
  await page.locator('#nl-label-7').click();
  await page.getByRole('button', { name: 'Mark complete' }).click();
});
```

Adjust navigation (extra Next clicks) to match 4-node workflow:

`intro → number-line → number-line-practice → composed-lesson`

Remove assertion `expect(page.getByText('0 interactions')).toBeVisible()` from existing test.

### Task OC-3-3 — Studio editor (optional, defer if large)

If `apps/dev-server` has interactive node form editor, add `prompt` text field. **Non-blocking** for PR1 — file follow-up issue if editor is complex.

**Verify:**

```bash
pnpm test:e2e tests/e2e/package-execution.spec.ts -g "interactive-demo"
```

---

## Phase OC-4 — Phase 2 scaffold (optional / follow-up PR)

Document only — do not implement unless user requests scoring in same sprint.

| Task   | Description                                                              |
| ------ | ------------------------------------------------------------------------ |
| OC-4-1 | `answerKey?: { targetId: string }` on interactive node schema            |
| OC-4-2 | On `select` event, compare `action.target.id` → show success/error Alert |
| OC-4-3 | `completionPolicy: 'always' \| 'onCorrect'`                              |
| OC-4-4 | i18n `interactive.correct` / `interactive.incorrect`                     |

---

## Task checklist (agent copy-paste)

```
PR1
[ ] OC-0-1 local interactive-react linked
[ ] OC-0-2 manual click verified
[ ] OC-1-1 prompt heading test
[ ] OC-1-2 InteractiveRenderer prompt UI
[ ] OC-1-3 remove interaction counter from UI
[ ] OC-1-4 update InteractiveRenderer tests (SVG click)
[ ] OC-1-5 i18n optional
[ ] runtime test green

PR2
[ ] OC-2-1 schema prompt field
[ ] OC-2-2 schema tests
[ ] OC-2-3 interactive-demo practice prompt
[ ] OC-3-1 interactive-runtime README
[ ] OC-3-2 e2e SVG click + prompt
[ ] e2e green
```

---

## Explicit non-goals (PR1–PR2)

- Engine/scoring logic inside `@knowledgeassemble/*`
- Studio full authoring UI for answer keys (OC-4)
- Learner app (`@open-edu/learner`) separate deploy — dev-server preview is the gate
- Changing `InteractiveNodeView` / bridge (engine repo)

---

## Troubleshooting

| Symptom                                | Cause                         | Fix                                           |
| -------------------------------------- | ----------------------------- | --------------------------------------------- |
| `#nl-marker-7` not in DOM              | IR plan not deployed          | OC-0-1                                        |
| `#nl-label-7` not found on guided step | Wrong step in e2e             | Use marker on guided, label on practice       |
| TS error on `node.prompt`              | Schema not updated            | OC-2 before OC-1-2 or use extended type       |
| e2e timeout on click                   | Element not interactive       | Wait for `interactive-renderer`; check SVG id |
| `buildOpenEduBridge` fails             | interactive-runtime unchanged | OC-3 unrelated to build                       |
| geomap TS6133 on link                  | Engine repo lint              | Fix `_type` in openedu-interactive            |

---

## Success criteria

1. Learner sees **title** (and **prompt** when set) above the interactive.
2. No `N interactions` text in preview UI.
3. No `id (select)` dev buttons (requires IR plan).
4. Clicking SVG target increments saved `interactions` on Mark complete.
5. `interactive-demo` e2e passes with prompt + click assertions.
6. `pnpm --filter @open-edu/runtime test` and schemas tests green.

---

## References

- Runtime renderer: `packages/runtime/src/renderers/InteractiveRenderer.tsx`
- Bridge package: `packages/interactive-runtime/src/bridge.ts`
- Demo package: `examples/interactive-demo/`
- Engine IR plan: `openedu-interactive/docs/superpowers/specs/2026-09-10-interactive-react-learner-surface-implementation-plan.md`
- P7 acceptance: `openedu-interactive/docs/p7-acceptance.md` item #1
