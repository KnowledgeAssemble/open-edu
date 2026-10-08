---
sidebar_position: 1
---

# Label Diagram

**Widget ID:** `science.label-diagram` | **Domain:** science | **Status:** stable

> Label parts of a scientific diagram by dragging labels to the correct spots.

## What it does

The Label Diagram widget shows a scientific diagram with draggable labels. Students drag each label from a word bank to the correct position on the diagram. Common uses include labeling plant parts, human anatomy, or machine components.

## When to use this widget

- Teaching anatomy and biology diagrams
- Labeling parts of a machine or system
- Science vocabulary reinforcement
- Geography and map labeling

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "science.label-diagram"
3. Provide a clear diagram image with alt text
4. Define each label with id, text, x/y target position, and optional hint
5. Set interactive to true for drag-and-label mode

## Configuration fields

| Field         | Type             | Required | Description                                                                                                 |
| ------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `image`       | string           | Yes      | Path to the diagram image file.                                                                             |
| `altText`     | string           | Yes      | Description of the diagram for screen readers.                                                              |
| `labels`      | array of objects | Yes      | Labels to drag. Each has id (string), text (string), target with x/y (percent), and optional hint (string). |
| `hints`       | array of strings | No       | Progressive hints for students who need help.                                                               |
| `interactive` | boolean          | No       | When false, shows labels in position. Defaults to false.                                                    |

## Example

```json
{
  "type": "exercise",
  "title": "Plant Anatomy Labeling",
  "widget": "science.label-diagram",
  "config": {
    "image": "assets/images/plant-anatomy.png",
    "altText": "Diagram of a plant with parts to label",
    "labels": [
      { "id": "roots", "text": "Roots", "target": { "x": 50, "y": 90 }, "hint": "Below the soil" },
      {
        "id": "stem",
        "text": "Stem",
        "target": { "x": 50, "y": 60 },
        "hint": "Supports the plant"
      },
      {
        "id": "leaves",
        "text": "Leaves",
        "target": { "x": 30, "y": 40 },
        "hint": "Green and flat"
      },
      { "id": "flower", "text": "Flower", "target": { "x": 50, "y": 20 }, "hint": "Colorful top" }
    ],
    "interactive": true,
    "hints": ["Roots are found underground", "The stem connects roots to leaves"]
  }
}
```

## Tips

- Use clear, high-contrast diagrams with obvious label areas
- Provide 4-8 labels for manageable complexity
- Add hints to each label for students who get stuck
- Target x/y positions should use percentage values (0-100)

## See also

- [Image Label](image-label.md)
- [Hotspot](../core/hotspot.md)
