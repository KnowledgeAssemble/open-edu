---
sidebar_position: 11
---

# Image Compare

**Widget ID:** `core.image-compare` | **Domain:** core | **Status:** stable

> Compare two images side by side with an interactive slider.

## What it does

The Image Compare widget places two images side by side (or overlapped with a draggable slider) so students can compare differences and similarities. It supports a slider mode for before/after comparisons and a side-by-side mode.

## When to use this widget

- Comparing healthy vs diseased plants or organisms
- Before and after science experiments
- Visual differences and similarities activities
- Art comparison and analysis

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "core.image-compare"
3. Provide paths to your left and right images
4. Add labels and alt text for each image
5. Choose slider or side-by-side mode

## Configuration fields

| Field        | Type   | Required | Description                                                             |
| ------------ | ------ | -------- | ----------------------------------------------------------------------- |
| `leftImage`  | string | Yes      | Path to the left (or top) image file.                                   |
| `rightImage` | string | Yes      | Path to the right (or bottom) image file.                               |
| `leftLabel`  | string | No       | Label shown under the left image.                                       |
| `rightLabel` | string | No       | Label shown under the right image.                                      |
| `mode`       | string | No       | "slider" for draggable overlay or "side-by-side". Defaults to "slider". |
| `altText`    | object | No       | Accessibility descriptions: `{ left: string, right: string }`.          |
| `caption`    | string | No       | Caption text shown below both images.                                   |

## Example

```json
{
  "type": "exercise",
  "title": "Leaf Comparison",
  "widget": "core.image-compare",
  "config": {
    "leftImage": "assets/images/healthy-leaf.png",
    "rightImage": "assets/images/diseased-leaf.png",
    "leftLabel": "Healthy Leaf",
    "rightLabel": "Diseased Leaf",
    "mode": "slider",
    "altText": {
      "left": "A healthy green leaf",
      "right": "A diseased leaf with brown spots"
    },
    "caption": "Compare a healthy leaf with a diseased one"
  }
}
```

## Tips

- Use clear, high-contrast images for best comparison results
- Always provide alt text for accessibility
- The slider mode works best for before/after comparisons
- Image files should be placed in your lesson package directory

## See also

- [Hotspot](hotspot.md)
