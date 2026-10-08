---
sidebar_position: 1
---

# Interactive Map

**Widget ID:** `social.map` | **Domain:** social | **Status:** stable

> Explore geographic and social concepts on an interactive map.

## What it does

The Social Map widget shows an interactive map with regions, markers, and a legend. Students can explore regions, read descriptions, and find specific locations. It supports zooming, labels, and region highlighting. Optionally, an SVG file can be used as the map background via svgSrc for accurate region boundaries.

## When to use this widget

- Teaching geography and map reading
- Exploring continents and countries
- Social studies and history map activities
- Community and neighborhood mapping

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "social.map"
3. Define map regions with id, name, color, and description
4. Optionally add markers for specific locations
5. Add a legend to explain region colors
6. Optionally set svgSrc to an SVG map file for accurate region shapes

## Configuration fields

| Field               | Type             | Required | Description                                                                                                                                                                          |
| ------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `regions`           | array of objects | Yes      | Map regions. Each has id (string), name (string), and optional color (CSS variable or hex), description (string), tooltip (string), image (string), and path (SVG path data string). |
| `regions[].tooltip` | string           | No       | Tooltip text shown when hovering over the region.                                                                                                                                    |
| `regions[].image`   | string           | No       | Image URL for the region. Accepted by the schema but not currently rendered in the UI.                                                                                               |
| `regions[].path`    | string           | No       | SVG path d attribute for the region shape. Used when no svgSrc background is set.                                                                                                    |
| `svgSrc`            | string           | No       | URL to an SVG file used as the map background. When set, region shapes come from the SVG file and each region's own path field is ignored.                                           |
| `title`             | string           | No       | A title shown above the map.                                                                                                                                                         |
| `labels`            | boolean          | No       | Show region name labels. Defaults to true.                                                                                                                                           |
| `zoom`              | boolean          | No       | Allow zooming in and out. Defaults to false.                                                                                                                                         |
| `legend`            | array of objects | No       | Legend entries. Each has color (string) and label (string).                                                                                                                          |
| `markers`           | array of objects | No       | Point markers. Each has id (string), label (string), x (number), y (number), and optional icon (string).                                                                             |
| `targetRegion`      | string           | No       | ID of a region to highlight for quiz mode.                                                                                                                                           |
| `interactive`       | boolean          | No       | When false, shows the map for exploration. Defaults to false.                                                                                                                        |

## Example

```json
{
  "type": "exercise",
  "title": "World Continents",
  "widget": "social.map",
  "config": {
    "regions": [
      {
        "id": "north",
        "name": "North America",
        "description": "Third largest continent by area",
        "color": "var(--oe-color-primary)"
      },
      {
        "id": "europe",
        "name": "Europe",
        "description": "Sixth largest continent",
        "color": "var(--oe-color-warning)"
      },
      {
        "id": "africa",
        "name": "Africa",
        "description": "Second largest continent by area",
        "color": "var(--oe-color-error)"
      },
      {
        "id": "asia",
        "name": "Asia",
        "description": "Largest and most populous continent",
        "color": "var(--oe-color-accent)"
      }
    ],
    "legend": [
      { "color": "var(--oe-color-primary)", "label": "North America" },
      { "color": "var(--oe-color-warning)", "label": "Europe" },
      { "color": "var(--oe-color-error)", "label": "Africa" },
      { "color": "var(--oe-color-accent)", "label": "Asia" }
    ],
    "title": "World Continents",
    "labels": true,
    "zoom": true,
    "interactive": false,
    "targetRegion": "asia"
  }
}
```

## Tips

- Use clear, labeled maps for readability
- Include a legend when using multiple colors
- Keep region descriptions brief and informative
- Start with simple geographic features before complex ones
- Use svgSrc with an SVG map file for accurate region boundaries

## See also

- [Hotspot](../core/hotspot.md)
