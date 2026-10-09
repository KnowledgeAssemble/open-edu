# OpenEdu Course Spec Artifact Contract

> GENERATED reference — do not hand-edit. Regenerate with `pnpm --filter @open-edu/domain-guidance generate`.
> Source of truth: `packages/domain-guidance/src/data/artifact-contract.json`.

Schema: @open-edu/course-compiler `CourseSpecJSONSchema` (derived by runtime Zod introspection)
Version: 1; Format: `openedu-course-spec`

## Top-Level Required Keys

- `format`
- `version`
- `generatedAt`
- `metadata`
- `lessons`

## Derived Schema Structure

```json
{
  "provenance": {
    "package": "@open-edu/course-compiler",
    "module": "parser/json-input.ts",
    "schema": "CourseSpecJSONSchema",
    "derived": "runtime-zod-introspection"
  },
  "format": "openedu-course-spec",
  "version": 1,
  "requiredTopLevelKeys": ["format", "version", "generatedAt", "metadata", "lessons"],
  "metadataFields": [
    {
      "name": "title",
      "type": "string",
      "required": true
    },
    {
      "name": "description",
      "type": "string",
      "required": true
    },
    {
      "name": "author",
      "type": "string",
      "required": false
    },
    {
      "name": "version",
      "type": "string",
      "required": false
    },
    {
      "name": "keywords",
      "type": "string[]",
      "required": false
    },
    {
      "name": "targetAudience",
      "type": "string",
      "required": false
    },
    {
      "name": "audience",
      "type": "string",
      "required": false
    },
    {
      "name": "accessibility",
      "type": "string[]",
      "required": false
    },
    {
      "name": "difficulty",
      "type": "enum(beginner | intermediate | advanced)",
      "required": false
    },
    {
      "name": "estimatedHours",
      "type": "number",
      "required": false
    },
    {
      "name": "lastUpdated",
      "type": "string",
      "required": false
    },
    {
      "name": "language",
      "type": "string",
      "required": false
    },
    {
      "name": "generated",
      "type": "boolean",
      "required": true
    }
  ],
  "lessonFields": [
    {
      "name": "id",
      "type": "string",
      "required": true
    },
    {
      "name": "title",
      "type": "string",
      "required": true
    },
    {
      "name": "objectives",
      "type": "string[]",
      "required": true
    },
    {
      "name": "coreIdea",
      "type": "string",
      "required": true
    },
    {
      "name": "examples",
      "type": "string[]",
      "required": false
    },
    {
      "name": "misconceptions",
      "type": "string[]",
      "required": false
    },
    {
      "name": "estimatedMinutes",
      "type": "number",
      "required": false
    },
    {
      "name": "activities",
      "type": "object[]",
      "required": true
    }
  ],
  "activityFields": [
    {
      "name": "step",
      "type": "enum(observe | guided_practice | independent_practice | mastery_check | positive_completion)",
      "required": true
    },
    {
      "name": "order",
      "type": "number",
      "required": true
    },
    {
      "name": "type",
      "type": "enum(reading | exercise | quiz | reflection | widget)",
      "required": true
    },
    {
      "name": "description",
      "type": "string",
      "required": true
    },
    {
      "name": "instructions",
      "type": "string",
      "required": false
    },
    {
      "name": "examples",
      "type": "string[]",
      "required": false
    },
    {
      "name": "questions",
      "type": "object[]",
      "required": false
    },
    {
      "name": "widgetId",
      "type": "string",
      "required": false
    },
    {
      "name": "widgetConfig",
      "type": "record",
      "required": false
    }
  ],
  "questionFields": [
    {
      "name": "question",
      "type": "string",
      "required": true
    },
    {
      "name": "options",
      "type": "string[]",
      "required": true
    },
    {
      "name": "correctIndex",
      "type": "number",
      "required": true
    }
  ],
  "activitySteps": [
    "observe",
    "guided_practice",
    "independent_practice",
    "mastery_check",
    "positive_completion"
  ],
  "activityTypes": ["reading", "exercise", "quiz", "reflection", "widget"]
}
```

## Authored Model Prompt Rules

- 1 to 6 lessons only (teachers build short courses).
- Exactly one activity per lesson with "type": "quiz"; its questions are multiple-choice with exactly 4 options each.
- Use measurable objectives, never "understand", "know", or "learn".
- Widget ids must be chosen from the AVAILABLE WIDGETS table in this prompt (canonical catalog ids); never "open-edu.\*".
- "metadata.language" must be one of the supported locales ("en", "hi", "or"); use the locale requested by the author, defaulting to "en".
- All required fields above must be present and non-empty.

## Authored Prompt View

```
Output ONLY a single JSON object that conforms EXACTLY to the derived course-spec schema below (no markdown, no comments, no extra text).

## Schema (derived from @open-edu/course-compiler CourseSpecJSONSchema)

Top-level keys: "format", "version", "generatedAt", "metadata", "lessons"

metadata: { title: string (required), description: string (required), author: string (optional), version: string (optional), keywords: string[] (optional), targetAudience: string (optional), audience: string (optional), accessibility: string[] (optional), difficulty: enum(beginner | intermediate | advanced) (optional), estimatedHours: number (optional), lastUpdated: string (optional), language: string (optional), generated: boolean (required) }
lesson: { id: string (required), title: string (required), objectives: string[] (required), coreIdea: string (required), examples: string[] (optional), misconceptions: string[] (optional), estimatedMinutes: number (optional), activities: object[] (required) }
activity: { step: enum(observe | guided_practice | independent_practice | mastery_check | positive_completion) (required), order: number (required), type: enum(reading | exercise | quiz | reflection | widget) (required), description: string (required), instructions: string (optional), examples: string[] (optional), questions: object[] (optional), widgetId: string (optional), widgetConfig: record (optional) }
question: { question: string (required), options: string[] (required), correctIndex: number (required) }

Here is the exact JSON shape to produce:

{
  "format": "openedu-course-spec",
  "version": 1,
  "generatedAt": "<ISO 8601 timestamp>",
  "metadata": {
    "title": "<short course title>",
    "description": "<1-2 sentence summary>",
    "author": "OpenEdu Studio",
    "version": "1.0.0",
    "difficulty": "beginner | intermediate | advanced",
    "estimatedHours": <number, e.g. 1>,
    "generated": true
  },
  "lessons": [
    {
      "id": "<kebab-case lesson id>",
      "title": "<lesson title>",
      "objectives": ["<measurable objective, starts with an action verb like explain, identify, calculate, compare, construct — NEVER 'understand' or 'know'>"],
      "coreIdea": "<1-2 sentence core idea>",
      "examples": ["<example>"],
      "misconceptions": ["<common mistake>"],
      "estimatedMinutes": <5-45>,
      "activities": [
        {
          "step": "observe | guided_practice | independent_practice | mastery_check | positive_completion",
          "order": <1-based number>,
          "type": "reading | exercise | quiz | reflection | widget",
          "description": "<what the learner does>",
          "instructions": "<optional instructions>",
          "questions": [
            { "question": "<question>", "options": ["<exactly 4 options>"], "correctIndex": <0-3> }
          ],
          "widgetId": "<canonical-widget-id>",
          "widgetConfig": {}
        }
      ]
    }
  ]
}

RULES:
- 1 to 6 lessons only (teachers build short courses).
- Exactly one activity per lesson with "type": "quiz"; its questions are multiple-choice with exactly 4 options each.
- Use measurable objectives, never "understand", "know", or "learn".
- Widget ids must be chosen from the AVAILABLE WIDGETS table in this prompt (canonical catalog ids); never "open-edu.*".
- "metadata.language" must be one of the supported locales ("en", "hi", "or"); use the locale requested by the author, defaulting to "en".
- All required fields above must be present and non-empty.
```
