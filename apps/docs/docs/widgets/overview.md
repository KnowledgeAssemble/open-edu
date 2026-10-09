---
sidebar_position: 1
---

# Widgets Overview

The Widget SDK provides a typed contract for interactive nodes, a registry for managing widget definitions, enriched metadata for AI generation, metadata validation, widget catalog generation, built-in widgets, remote widget loading, and NPM scaffold templates for publishing custom widgets.

## Widget Contract

```typescript
import type { ReactNode } from 'react';

interface WidgetDefinition {
  id: string;
  version?: string;
  render(props: WidgetRenderProps): ReactNode;
}

interface WidgetDefinitionV2 extends WidgetDefinition {
  name: string;
  description: string;
  domain: string;
  learningIntents: LearningIntent[];
  capabilities: WidgetCapabilities;
  accessibility: AccessibilityMetadata;
  analytics: AnalyticsMetadata;
  reward: RewardMetadata;
  ai: AIMetadata;
  status: 'stable' | 'experimental' | 'deprecated';
  keywords?: string[];
  icon?: string;
}

interface WidgetRenderProps<TState = unknown> {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction(data: Record<string, unknown>): void;
  complete(score?: number, state?: TState): void;
  storedState?: TState;
}
```

## Metadata Categories

Every `WidgetDefinitionV2` includes enriched metadata across five categories:

### Learning Intents

How the widget supports learning — `assess`, `practice`, `observe`, `compare`, `explore`, `create`, `reflect`, `apply`.

### Capabilities

Feature flags including `supportsKeyboard`, `supportsTouch`, `supportsOffline`, `supportsObserveMode`, `supportsHints`, `supportsRetry`, and more (16 flags total).

### Accessibility

A11y features like `highContrast`, `tts`, `keyboardNavigation`, `screenReader`, `ariaSupport`, `focusManagement`, and more (11 flags total).

### Analytics

What events the widget emits — `attempts`, `hints`, `completionTime`, `scoreChanges`, `interactions`, `trackHints`, `trackRetries`, and more (8 flags total).

### Reward

Reward hooks — `completionXP`, `achievement`, `badge`, `positiveMessage`, `confetti`, `collectibleCard`, `celebrationAnimation`.

### AI Metadata

Metadata for LLM course generation — `difficulty`, `estimatedMinutes`, `bloomsLevel`, `cognitiveLoad`, `recommendedAge`, `readingLevel`, `learningObjectives`, `commonMisconceptions`, `generationHints`, `exampleConfigs`.

## Widget Registry

The `WidgetRegistry` manages registration, lookup, alias resolution, and structured search:

```typescript
import { createWidgetRegistry } from '@open-edu/widgets';

const registry = createWidgetRegistry();

registry.register({
  id: 'my-widget',
  name: 'My Widget',
  description: 'A custom widget',
  domain: 'core',
  learningIntents: ['practice'],
  capabilities: { supportsKeyboard: true },
  accessibility: {},
  analytics: {},
  reward: {},
  ai: { difficulty: 'easy' },
  status: 'stable',
  render(props) {
    return <div>{/* widget UI */}</div>;
  },
});

const widget = registry.get('my-widget');
const mathWidgets = registry.getByDomain('math');
const filtered = registry.searchWithFilters({ domain: 'core', intent: 'practice' });
```

- Duplicate widget IDs are rejected with a typed error.
- `registry.get()` returns `undefined` when a widget is not registered.
- Legacy `open-edu.*` IDs are automatically resolved to domain-prefixed IDs.

## Built-in Widgets

28 built-in widgets across 5 content domains (27 stable + 1 deprecated alias):

### Core Widgets

| Widget ID                | Domain | Description                                                    |
| ------------------------ | ------ | -------------------------------------------------------------- |
| `core.multiple-choice`   | core   | Single or multi-question multiple choice                       |
| `core.matching`          | core   | Match items between two columns                                |
| `core.drag-drop`         | core   | Drag and drop items into categorized zones                     |
| `core.sequencing`        | core   | Arrange items in the correct order                             |
| `core.fill-blank`        | core   | Type the missing word or phrase in a sentence                  |
| `core.story-question`    | core   | Read a passage and answer a comprehension question             |
| `core.real-world`        | core   | Identify real-world examples of a concept                      |
| `core.chart-reader`      | core   | Read and interpret data from bar charts and graphs             |
| `core.visual-counting`   | core   | Count objects in a visual grid and select the correct number   |
| `core.callout`           | core   | Highlighted information callout with configurable styling      |
| `core.image-compare`     | core   | Side-by-side image comparison with slider                      |
| `core.hotspot`           | core   | Clickable regions on images with feedback                      |
| `core.timeline`          | core   | Horizontal timeline visualization with events                  |
| `core.process-explainer` | core   | Step-by-step explanation of a process with progressive reveal  |
| `core.audio-player`      | core   | Play audio with transcript, captions, bookmarks, speed control |
| `core.video-player`      | core   | Play video with chapters, captions, transcript, bookmarks      |

### Math Widgets

| Widget ID                | Domain | Description                                 |
| ------------------------ | ------ | ------------------------------------------- |
| `math.fraction-visual`   | math   | Visual fraction representation              |
| `math.place-value-chart` | math   | Identify digit place values                 |
| `math.grid-area`         | math   | Calculate area by counting grid squares     |
| `math.clock-time`        | math   | Read analog clock faces                     |
| `math.measurement-scale` | math   | Read measurements from a labeled scale      |
| `math.number-line`       | math   | Interactive number line with click-to-place |

### Science Widgets

| Widget ID                 | Domain  | Description                                    |
| ------------------------- | ------- | ---------------------------------------------- |
| `science.label-diagram`   | science | Label parts of a diagram with draggable labels |
| `science.image-label`     | science | Label parts of an image with draggable labels  |
| `science.process-diagram` | science | Visual explanation of systems with 4 layouts   |

### Language Widgets

| Widget ID            | Domain   | Description                                     |
| -------------------- | -------- | ----------------------------------------------- |
| `language.flashcard` | language | Flip cards with self-assessment, shuffle, retry |

### Social Widgets

| Widget ID    | Domain | Description                                          |
| ------------ | ------ | ---------------------------------------------------- |
| `social.map` | social | Interactive map with regions, zoom, legend, tooltips |

### Deprecated Aliases

| Legacy ID                           | Resolves To            |
| ----------------------------------- | ---------------------- |
| `open-edu.multiple-choice-practice` | `core.multiple-choice` |

All 27 stable widgets have enriched metadata across all categories (AI, capabilities, accessibility, analytics, reward). Legacy `open-edu.*` IDs are automatically resolved to their new domain-prefixed equivalents.

For a live demo of every widget, run the [Widget Showcase](../examples/widget-showcase) example package.

## Metadata Validation

`validateWidgetMetadata()` enforces completeness and cross-field consistency for widget definitions:

```typescript
import { validateWidgetMetadata } from '@open-edu/widgets';

const result = validateWidgetMetadata(myWidget);
// result.valid — boolean
// result.errors — critical issues
// result.warnings — completeness recommendations
```

**Checks performed:**

- Required fields: `id`, `name`, `description`, `learningIntents`, `keywords`, `icon`
- AI completeness: `recommendedAge`, `learningObjectives`, `commonMisconceptions`, `exampleConfigs`
- Stable widget requirements: `supportsObserveMode` capability
- Cross-field consistency: hints/retry capabilities must match analytics tracking
- Reward completeness: `completionXP` should have `positiveMessage`

## Widget Catalog Generation

The widget catalog provides structured Markdown descriptions of all available widgets for LLM prompts used in AI-assisted content generation.

### Data Flow

```
packages/widgets/src/builtins/**            ← Canonical per-widget WidgetDefinitionV2 (metadata + guide)
        │
        ▼  packages/widgets/src/builtin-roster.ts (BUILTIN_WIDGETS)
        │  packages/widgets/src/catalog-gen.ts (toWidgetCatalogEntries)
        ▼  pnpm --filter @open-edu/widgets generate:catalog
packages/core/src/widget-catalog-data.json      ← Auto-generated JSON (28 entries)
        │
        ▼  fs.readFileSync at runtime
packages/core/src/widget-catalog.ts             ← Reads JSON, exposes getDefaultWidgetCatalog()
        │
        ▼  CLI imports from @open-edu/core
edu generate --prompt                           ← Injects catalog into agent prompt
```

### Canonical Source

Widget metadata lives on each `WidgetDefinitionV2` in `packages/widgets/src/builtins/**`. `packages/widgets/src/builtin-roster.ts` collects the built-in roster (`BUILTIN_WIDGETS`), and `packages/widgets/src/catalog-gen.ts` derives the JSON catalog entries. This is the single source of truth — the generated JSON is never hand-edited.

### Generating the Catalog JSON

After modifying a builtin definition or the roster, regenerate the JSON:

```bash
pnpm --filter @open-edu/widgets generate:catalog
```

This runs `packages/widgets/scripts/generate-catalog.ts`, which reads `BUILTIN_WIDGETS` through `toWidgetCatalogEntries` and writes `packages/core/src/widget-catalog-data.json`.

### Programmatic Usage

```typescript
import { getDefaultWidgetCatalog, generateWidgetCatalog } from '@open-edu/core';

// Get the full catalog as Markdown (reads from auto-generated JSON)
const catalog = getDefaultWidgetCatalog();

// Or generate from custom entries
const custom = generateWidgetCatalog({ widgets: myEntries });
```

The catalog Markdown includes per-widget sections with domain grouping, status tags, learning intents, keywords, capabilities, accessibility, analytics, reward info, and AI notes (difficulty, Bloom's level, age range, learning objectives, misconceptions).

### How the CLI Uses It

When you run `edu generate --prompt`, the CLI calls `getDefaultWidgetCatalog()` from `@open-edu/core` and passes the resulting Markdown into the agent prompt template. This gives AI agents a complete reference of available widgets, their configs, and pedagogical metadata.

## Remote Widget Loading

Widgets can be loaded from remote URLs at runtime via module federation:

```typescript
import { RemoteWidgetLoader } from '@open-edu/widgets';

const loader = new RemoteWidgetLoader();
const state = await loader.load(
  {
    id: 'remote-quiz',
    version: '1.0.0',
    url: 'https://example.com/widgets/quiz.js',
    integrity: 'sha256-abc123...',
    fallback: 'core.multiple-choice',
  },
  registry,
);
```

The loader supports:

- **Integrity verification** — SHA-256 hash check before execution
- **Fallback widgets** — use a local widget if remote loading fails
- **Per-session caching** — avoids re-fetching the same `id@version`
- **Sandboxed evaluation** — uses Blob URLs for isolated module scope

## Widget Scaffold Template

`edu widget create` generates a self-contained, publishable widget package:

```
my-widget/
├── package.json          # name, version, peer deps on react + @open-edu/widgets
├── tsconfig.json
├── src/
│   ├── index.tsx         # default export: WidgetDefinition
│   └── index.test.tsx
└── vitest.config.ts
```

## Usage in Packages

Reference widgets in exercise or custom nodes using the new domain-prefixed IDs:

```json
{
  "type": "exercise",
  "widget": "core.multiple-choice",
  "config": {
    "prompt": "What is the capital of France?",
    "options": [
      { "id": "a", "text": "London", "correct": false },
      { "id": "b", "text": "Paris", "correct": true }
    ]
  }
}
```

Legacy `open-edu.*` IDs are automatically resolved — no migration required for existing packages.

For remote widgets, use the `remoteWidget` field on custom nodes.

## Community Widgets (Sandboxed)

Community widgets run in sandboxed iframes and communicate with the host through a versioned `postMessage` protocol. They never execute in the learner app's JavaScript realm. This is the recommended approach for third-party and instance-hosted widgets.

**Key differences from native widgets:**

- Framework-agnostic (React not required)
- Sandboxed iframe with `sandbox="allow-scripts"` (no `allow-same-origin`)
- Versioned protocol (`open-edu.widget/1`) with schema-validated messages
- Host owns state, completion, telemetry, rewards, and capabilities
- Mandatory integrity verification for registry references
- Supports offline-capable self-contained HTML artifacts

Use `widgetRef` on exercise/custom nodes to reference community widgets:

```json
{
  "type": "exercise",
  "title": "Community Counter",
  "widgetRef": {
    "id": "community.example.counter",
    "version": "1.0.0",
    "source": "registry",
    "registryId": "main",
    "integrity": "sha256-<64-hex>",
    "fallback": "core.multiple-choice"
  },
  "config": { "prompt": "Count to 10!" }
}
```

For the full guide on building, publishing, and installing community widgets, see the [Community Widgets Developer Guide](./community-widgets).

### Local development

Test community widgets in the learner app without a dev-server or DevTools globals:

```bash
EDU_WIDGET_DIR=./examples/community-widget-counter pnpm --filter @open-edu/learner dev
```

See [Community Widgets — Local Development](./community-widgets#local-development) for details.
