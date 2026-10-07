# Open-Edu Architecture

Version: 0.1.0

Status: Draft

---

# Purpose

This document defines the technical architecture of the Open-Edu Framework.

While the Framework Specification defines **what the system must do**, this document defines **how the system is implemented** using the approved technology stack.

The architecture prioritizes:

- Accessibility by default
- AI-agent friendliness
- Local-first development
- Extensibility
- Observability
- Long-term maintainability

---

# High-Level Architecture

```text
┌─────────────────────────────┐
│ Educational Package         │
│ (Markdown + JSON)           │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Package Loader             │
│ Zod Validation             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Workflow Engine            │
│ XState                     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Runtime Renderer           │
│ React + TypeScript         │
└───────┬────┬───┬──────────┘
        │    │   │
        ▼    ▼   ▼
┌────────────┐ ┌──────────┐ ┌────────────┐
│ A11y Engine│ │ i18n     │ │ Widget SDK │
└─────┬──────┘ └────┬─────┘ └─────┬──────┘
      │              │
      └──────┬───────┘
             ▼
┌─────────────────────────────┐
│ Telemetry Engine           │
│ RxJS Event Streams         │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Reward Broker             │
└─────────────────────────────┘
```

---

# Technology Stack

## Frontend Runtime

### Core

```text
React
TypeScript
Vite
```

Responsibilities:

- Runtime rendering
- Widget execution
- State management integration
- Accessibility enforcement

Why:

- Largest contributor ecosystem
- Best AI-agent support
- Mature accessibility tooling
- Strong plugin architecture

---

## Styling

### Tailwind CSS

Used for:

- Runtime UI
- Development tools
- Accessibility inspector
- Widget scaffolding

Guidelines:

- Utility-first styling
- No component-specific CSS frameworks
- Design tokens exposed through CSS variables

---

# Monorepo Structure

The framework is maintained as a pnpm monorepo.

```text
open-edu/

apps/
├── dev-server/
├── docs/

packages/
├── core/
├── schemas/
├── runtime/
├── workflow/
├── telemetry/
├── accessibility/
├── widgets/
├── cli/
├── course-compiler/
├── i18n/

examples/
├── hello-world/
├── intro-javascript/
├── fractions/
└── autism-reading/

docs/
├── VISION.md
├── FRAMEWORK_SPEC.md
├── ARCHITECTURE.md
└── AI_CONTEXT.md
```

---

# Package Architecture

Educational experiences are distributed as portable packages.

```text
my-package/

package.json
workflow.json
rewards.json

nodes/
assets/
widgets/
```

The runtime must never require package compilation.

Packages remain:

- Human readable
- AI generatable
- Git friendly
- Platform independent

---

# Schema Layer

## Technology

```text
Zod
```

Zod serves as the single source of truth.

---

## Responsibilities

Generate:

- Runtime validation
- TypeScript types
- JSON Schema
- AI agent contracts

---

## Example

```typescript
const PackageSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  author: z.string(),
  entry: z.string(),
});
```

Generated artifacts:

```text
package.schema.json
Package.ts
Validation functions
```

---

# Workflow Engine

## Technology

```text
XState
```

The workflow engine is implemented as a deterministic state machine.

---

## Purpose

Controls:

- Navigation
- Progression
- Remediation loops
- Adaptive routing

---

## Flow

```text
Lesson
   │
   ▼
Quiz
   │
 ┌─┴──┐
 │    │
Pass Fail
 │    │
 ▼    ▼
Done Lesson
```

---

## Compilation Pipeline

```text
workflow.json
       │
       ▼
Workflow Parser
       │
       ▼
XState Machine
       │
       ▼
Runtime Execution
```

---

# Content Rendering Pipeline

## Markdown Engine

Technology:

```text
remark
rehype
unist
mdast
```

---

## Rendering Flow

```text
Markdown
   │
   ▼
AST
   │
   ▼
Validation
   │
   ▼
Accessible React Components
```

---

## Benefits

Supports future:

- Reading analytics
- AI-assisted review
- Semantic enrichment
- Accessibility validation

---

# Runtime Renderer

## Technology

```text
React
TypeScript
```

Responsibilities:

- Node rendering
- Widget loading
- Progress tracking
- Accessibility integration

The renderer must remain stateless whenever possible.

Business logic belongs to:

- Workflow Engine
- Telemetry Engine
- Accessibility Engine

---

# Host-Side Interactive Rendering

Interactive engines are asset-free by contract. The OpenEdu host owns asset
resolution, figure layout, alt text, and failure handling for everything drawn
beside an engine surface.

## Asset resolution

`resolveEngineAsset` distinguishes data from media by extension:

- `.json`, `.geojson`, `.topojson` → the decoded file **contents** as a string
  (geomap parses its own `source.uri` JSON at mount, so a blob URL would throw).
- everything else → a URL string via `resolveAsset` (blob URL cache + `/assets/`
  fallback).
- never bytes, and no `openedu://` branch — the loader inlines those URIs into
  `source.data` at load time.

## `figures` map

The interactive node config accepts an optional `figures` map keyed by the
engine's **authored node id** (diagram `metadata.nodeId`, geomap
`metadata.entityId`, chart `metadata.rowId`, timeline `event-marker` ids).
Each entry is either `{ ref, alt }` or `{ ref, decorative: true }`; `alt` is
literal authored copy (figure alt text is course content, like `title` and
`prompt`, so it never goes through `t()` and never lives in the framework
locale files), and a decorative figure renders with an empty `alt` and
`aria-hidden`.

Figures anchor to scene nodes that carry `bounds` (diagram `kind: "node"`).
At most one figure renders per `figures` key (chart rows expand to one node per
measure), and hidden scene nodes are skipped. On a load error a meaningful
figure degrades to its caption text; a decorative figure renders nothing.

## Text alternative

`AlternativeList` renders the `svgResult.alternative` rows that add content
beyond the already-live `a11y` label channel: cycle rows and node
`description`s. Edge rows are never rendered — the live region already
announces the relationship. It is a plain (non-live) disclosure; composed
lessons get neither the alternative list nor the figure overlay in v1.

---

# Accessibility Engine

## Technology

```text
React Aria
axe-core
```

Accessibility is a core subsystem.

Not a plugin.

Not optional.

---

## Responsibilities

### Focus Management

Controls:

- Tab order
- Focus restoration
- Widget boundaries

---

### Keyboard Navigation

Supports:

```text
Tab
Shift + Tab
Enter
Space
Arrow Keys
Escape
```

---

### Screen Readers

Automatically generates:

- Labels
- Landmarks
- Roles
- Descriptions

---

### Validation

Development mode continuously runs:

```text
axe-core
```

Accessibility violations surface immediately.

---

# Internationalization

## Technology

```text
React Context
Intl APIs
```

The i18n package provides locale-aware translation and formatting.

---

## Responsibilities

### Translation Management

Controls:

- Namespace-based dictionary lookup
- Fallback to default locale
- Key interpolation with mustache syntax
- Missing key detection

---

### Locale Detection

Supports:

- English (en)
- Hindi (hi)
- Odia (or)

---

### React Integration

Provides:

- I18nProvider context wrapper
- useTranslation hook
- LanguageSwitcher component

---

### Formatting

Wraps:

```text
Intl.DateTimeFormat
Intl.NumberFormat
```

Locale-aware date, number, percent, and currency formatting.

---

# Widget Architecture

## Purpose

Allows specialized learning interactions without modifying the runtime.

Examples:

- Coding sandboxes
- Fraction sliders
- Simulations
- Interactive diagrams
- Music notation

---

## Widget Loading

Phase 1:

```text
NPM Package Widgets
```

Examples:

```text
@open-edu/widget-code-editor
@open-edu/widget-fraction-slider
```

---

## Future

Phase 2:

```text
Module Federation
```

Enables remote widget loading.

---

## Widget Lifecycle

```text
Load
 ↓
Mount
 ↓
Interaction
 ↓
Telemetry
 ↓
Verification
 ↓
Unmount
```

---

# Telemetry Architecture

## Technology

```text
RxJS
```

All learner interactions are modeled as event streams.

---

## Event Sources

Examples:

```text
Node Opened
Node Completed
Quiz Answered
Hint Triggered
Widget Interaction
Workflow Transition
```

---

## Flow

```text
Runtime
   │
   ▼
RxJS Event Stream
   │
   ▼
JSONL Persistence
   │
   ▼
Analytics
```

---

# Storage Layer

## MVP Storage

```text
JSONL
```

Location:

```text
.edu/telemetry.jsonl
```

---

## Why JSONL

Benefits:

- Append only
- Human readable
- Stream friendly
- Easy debugging

---

## Future Analytics

Technology:

```text
DuckDB
```

Used for:

- Telemetry analysis
- Learning analytics
- Curriculum observability

Example:

```sql
SELECT *
FROM telemetry
WHERE event = 'quiz_failed';
```

---

# Reward Broker

## Purpose

Separates learning content from incentives.

---

## Event Flow

```text
Telemetry Event
       │
       ▼
Reward Broker
       │
       ▼
External Action
```

---

## Supported Actions

### Badge

```json
{
  "action": "badge.award"
}
```

### Webhook

```json
{
  "action": "webhook"
}
```

### Script

Disabled by default.

Requires:

```bash
--allow-shell-hooks
```

---

# CLI Architecture

## Technology

```text
Node.js
Commander
```

---

## Commands

### Development

```bash
edu dev ./package
```

---

### Validation

```bash
edu validate ./package
```

---

### Build

```bash
edu build ./package
```

---

### Package

```bash
edu package ./package
```

---

### i18n:extract

```bash
edu i18n:extract ./package ./locales
```

---

### i18n:validate

```bash
edu i18n:validate ./package ./locales
```

---

### i18n:missing

```bash
edu i18n:missing ./locales ./target-lang
```

---

# Development Server

## Technology

```text
Vite
```

Responsibilities:

- Package loading
- Hot reload
- Telemetry inspection
- Accessibility inspection

---

## Hot Reload

Must preserve:

- Current node
- Learner progress
- Telemetry session

while updating content changes instantly.

---

# Testing Strategy

## Unit Tests

Technology:

```text
Vitest
```

Coverage:

- Schema validation
- Workflow execution
- Telemetry generation

---

## Integration Tests

Technology:

```text
Playwright
```

Coverage:

- Package execution
- Accessibility workflows
- Keyboard navigation

---

## Accessibility Tests

Technology:

```text
axe-core
```

Every rendered node must pass automated accessibility checks.

---

# Documentation Architecture

## Technology

```text
Docusaurus
```

Used for:

- Contributor guides
- Schema references
- Widget SDK documentation
- AI agent instructions

---

# Future Architecture

## Phase 1

Core Runtime

- Lessons
- Quizzes
- Telemetry
- Accessibility

---

## Phase 2

Skill Graph

- Mastery tracking
- Adaptive routing

---

## Phase 3

Widget Ecosystem

- SDK
- Registry
- Community contributions

---

## Phase 4

Observability Platform

- Dashboards
- Curriculum debugging
- Learning analytics

---

## Phase 5

Cloud Platform

- Package registry
- Collaboration
- Deployment
- Hosted analytics

---

# Architectural Principles

1. Accessibility before features.
2. Content before UI.
3. Schemas before implementation.
4. Telemetry before analytics.
5. Local-first before cloud.
6. AI-native before manual tooling.
7. Extensibility without framework complexity.

---

# Architecture Goal

To provide a lightweight, accessible, AI-native educational runtime capable of executing portable learning experiences while remaining simple enough for a single developer, educator, or AI agent to understand, extend, and deploy.
