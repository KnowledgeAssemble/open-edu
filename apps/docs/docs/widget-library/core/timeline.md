---
sidebar_position: 13
---

# Timeline

**Widget ID:** `core.timeline` | **Domain:** core | **Status:** stable

> Display events in chronological order on an interactive timeline.

## What it does

The Timeline widget arranges events along a visual timeline. Students can observe events in order or interactively arrange them. It supports horizontal, vertical, and compact layouts with optional dates, images, and descriptions.

## When to use this widget

- Teaching historical sequences and chronology
- Showing life cycles and growth stages
- Displaying project milestones or steps
- Visualizing process timelines in science

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "core.timeline"
3. Define your events — each needs an id and title
4. Optionally add dates, descriptions, icons, and images
5. Choose a layout: horizontal, vertical, or compact

## Configuration fields

| Field         | Type             | Required | Description                                                                                                                             |
| ------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `events`      | array of objects | Yes      | Timeline events. Each has id (string), title (string), and optional date (string), icon (string), description (string), image (string). |
| `title`       | string           | No       | An overall title for the timeline.                                                                                                      |
| `layout`      | string           | No       | "horizontal", "vertical" (default), or "compact".                                                                                       |
| `showDates`   | boolean          | No       | Show dates on the timeline. Defaults to true.                                                                                           |
| `showImages`  | boolean          | No       | Show images on the timeline. Defaults to false.                                                                                         |
| `interactive` | boolean          | No       | When false, shows events for observation only. Defaults to false.                                                                       |

## Example

```json
{
  "type": "exercise",
  "title": "The Water Cycle",
  "widget": "core.timeline",
  "config": {
    "title": "The Water Cycle",
    "events": [
      {
        "id": "evap",
        "title": "Evaporation",
        "icon": "☀️",
        "description": "Water heats up and rises as vapor"
      },
      {
        "id": "cond",
        "title": "Condensation",
        "icon": "☁️",
        "description": "Water vapor cools and forms clouds"
      },
      {
        "id": "rain",
        "title": "Rain",
        "icon": "🌧️",
        "description": "Water falls as precipitation"
      },
      {
        "id": "collect",
        "title": "Collection",
        "icon": "🌊",
        "description": "Water collects in oceans and lakes"
      }
    ],
    "layout": "vertical",
    "showDates": false,
    "showImages": false,
    "interactive": false
  }
}
```

## Tips

- Use clear, descriptive event titles
- Add emoji icons to make events visually distinct
- Keep descriptions short — 1 sentence or less
- For interactive mode, make sure the correct order is unambiguous

## See also

- [Sequencing](sequencing.md)
- [Process Diagram](../science/process-diagram.md)
