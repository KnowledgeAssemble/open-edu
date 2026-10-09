---
sidebar_position: 2
---

# Image Label

**Widget ID:** `science.image-label` | **Domain:** science | **Status:** stable

> Tap regions of an image to identify and learn about them.

## What it does

The Image Label widget shows an image with tappable regions. When students tap a region, they see its name and description. It works like an interactive exploration tool — great for planetariums, maps, and detailed diagrams.

## When to use this widget

- Interactive exploration of labeled images
- Solar system and astronomy activities
- Museum-style exhibit exploration
- Teaching visual identification skills

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "science.image-label"
3. Provide an image with alt text
4. Define clickable regions with x/y positions, titles, and descriptions
5. Optionally add hints for guided exploration

## Configuration fields

| Field         | Type             | Required | Description                                                                                                                           |
| ------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `image`       | string           | Yes      | Path to the image file.                                                                                                               |
| `altText`     | string           | Yes      | Description of the image for screen readers.                                                                                          |
| `regions`     | array of objects | Yes      | Clickable regions. Each has id (string), title (string), description (string), x (number), y (number), and optional tooltip (string). |
| `hints`       | array of strings | No       | Hints to guide exploration.                                                                                                           |
| `interactive` | boolean          | No       | When false, regions can still be tapped for information. Defaults to false.                                                           |

## Example

```json
{
  "type": "exercise",
  "title": "Solar System Explorer",
  "widget": "science.image-label",
  "config": {
    "image": "assets/images/solar-system.png",
    "altText": "Solar system with clickable planets",
    "regions": [
      {
        "id": "mars",
        "title": "Mars",
        "description": "The Red Planet, 4th from the Sun",
        "x": 45,
        "y": 30,
        "tooltip": "Click to learn about Mars"
      },
      {
        "id": "jupiter",
        "title": "Jupiter",
        "description": "Largest planet in our solar system",
        "x": 60,
        "y": 50,
        "tooltip": "Click to learn about Jupiter"
      },
      {
        "id": "earth",
        "title": "Earth",
        "description": "Our home planet, 3rd from the Sun",
        "x": 35,
        "y": 40,
        "tooltip": "Click to learn about Earth"
      }
    ],
    "interactive": false,
    "hints": ["Mars is known as the Red Planet", "Jupiter is the largest planet"]
  }
}
```

## Tips

- Use images with clearly defined, non-overlapping regions
- Keep region descriptions concise — 1-2 sentences
- Position regions carefully to cover the right part of the image
- Add tooltips to hint at what students will discover

## See also

- [Label Diagram](label-diagram.md)
- [Hotspot](../core/hotspot.md)
