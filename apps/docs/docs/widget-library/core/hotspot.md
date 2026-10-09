---
sidebar_position: 12
---

# Hotspot

**Widget ID:** `core.hotspot` | **Domain:** core | **Status:** stable

> Tap or click specific regions of an image to answer questions.

## What it does

The Hotspot widget overlays clickable regions on an image. Students tap the correct area to answer a question — like "Find Maharashtra on this map." It supports single-select and multi-select modes with visual feedback for correct and incorrect taps.

## When to use this widget

- Identifying locations on maps
- Pointing out parts of a diagram or image
- Geography and anatomy exercises
- Interactive image exploration

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "core.hotspot"
3. Provide an image path and alt text
4. Define hotspot regions — each needs id, x/y position (0-100), radius, and label
5. Mark the correct hotspot with correct: true

## Configuration fields

| Field         | Type             | Required | Description                                                                                                                                                                    |
| ------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`       | string           | Yes      | Path to the image file.                                                                                                                                                        |
| `altText`     | string           | Yes      | Description of the image for screen readers.                                                                                                                                   |
| `hotspots`    | array of objects | Yes      | Clickable regions. Each has id (string), x (number 0-100), y (number 0-100), radius (number, default 5), label (string), correct (boolean), and optional description (string). |
| `mode`        | string           | No       | "single" for one correct hotspot (default) or "multiple" for selecting several.                                                                                                |
| `hints`       | array of strings | No       | Progressive hints to help students find the right region.                                                                                                                      |
| `interactive` | boolean          | No       | When false, highlights hotspots for observation. Defaults to false.                                                                                                            |

## Example

```json
{
  "type": "exercise",
  "title": "Identify Maharashtra",
  "widget": "core.hotspot",
  "config": {
    "image": "assets/images/india-map.png",
    "altText": "Map of India with states highlighted",
    "hotspots": [
      {
        "id": "mh",
        "x": 45,
        "y": 55,
        "radius": 8,
        "label": "Maharashtra",
        "correct": true,
        "description": "Capital: Mumbai"
      },
      { "id": "ka", "x": 42, "y": 65, "radius": 8, "label": "Karnataka", "correct": false },
      { "id": "dl", "x": 48, "y": 30, "radius": 8, "label": "Delhi", "correct": false }
    ],
    "mode": "single",
    "interactive": true,
    "hints": ["Look for the western coastal state"]
  }
}
```

## Tips

- Define clear, non-overlapping hotspot regions
- Use x/y values between 0-100 for responsive positioning
- Provide descriptive labels and alt text for each region
- Add hints for students who struggle to find the right area

## See also

- [Image Label](../science/image-label.md)
- [Label Diagram](../science/label-diagram.md)
