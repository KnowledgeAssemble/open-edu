---
sidebar_position: 3
---

# Grid Area

**Widget ID:** `math.grid-area` | **Domain:** math | **Status:** stable

> Calculate area by counting and highlighting squares on a grid.

## What it does

The Grid Area widget shows a rectangular grid where students count or highlight squares to understand area. Students can click individual cells, see the total count, and compare areas of different shapes.

## When to use this widget

- Introducing the concept of area
- Teaching that area = rows × columns
- Comparing areas of different shapes
- Distinguishing area from perimeter

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "math.grid-area"
3. Set the number of rows and columns
4. Choose area mode for square counting
5. Set maxHighlights to limit how many cells can be selected

## Configuration fields

| Field              | Type    | Required | Description                                                                                                                        |
| ------------------ | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `rows`             | number  | Yes      | Number of rows in the grid (keep under 10).                                                                                        |
| `cols`             | number  | Yes      | Number of columns in the grid (keep under 10).                                                                                     |
| `mode`             | string  | No       | Activity mode. "area" is the default for counting squares.                                                                         |
| `maxHighlights`    | number  | No       | Maximum number of cells a student can highlight.                                                                                   |
| `highlighted`      | array   | No       | Pre-shaded cells for observe mode display (array of {row, col}). Not used for interactive grading unless no target fields are set. |
| `targetHighlights` | array   | No       | Exact cells the learner must shade in interactive mode (array of {row, col}). Graded by set equality.                              |
| `targetCount`      | number  | No       | Simpler grading: learner must shade exactly this many cells. Used when targetHighlights is not set.                                |
| `showQuestionArea` | boolean | No       | When true with targetHighlights, shows a read-only reference grid beside the interactive grid. Defaults to false.                  |
| `description`      | string  | No       | Instructions for the student.                                                                                                      |
| `showCount`        | boolean | No       | Show a running count of highlighted cells. Defaults to true.                                                                       |
| `interactive`      | boolean | No       | When false, shows a pre-filled grid. Defaults to false.                                                                            |

## Example

```json
{
  "type": "exercise",
  "title": "Grid Area Practice",
  "widget": "math.grid-area",
  "config": {
    "description": "Highlight 6 cells to match the area shown.",
    "rows": 5,
    "cols": 5,
    "mode": "area",
    "targetCount": 6,
    "targetHighlights": [
      { "row": 0, "col": 0 },
      { "row": 0, "col": 1 },
      { "row": 0, "col": 2 },
      { "row": 1, "col": 0 },
      { "row": 1, "col": 1 },
      { "row": 1, "col": 2 }
    ],
    "showQuestionArea": true,
    "maxHighlights": 25,
    "showCount": true,
    "interactive": true
  }
}
```

## Tips

- Keep grids under 10×10 for visual clarity
- Use maxHighlights to limit selections when targeting a specific area
- Explain that each square is one square unit
- Show both the rows × columns formula and the counting method

## See also

- [Fraction Visual](fraction-visual.md)
