---
sidebar_position: 10
---

# Callout

**Widget ID:** `core.callout` | **Domain:** core | **Status:** stable

> Highlight key information with a styled callout card.

## What it does

The Callout widget displays important information in a visually distinct card. You can choose from different styles — tip, info, warning, or success — and add an optional icon. It is a passive display widget, not interactive.

## When to use this widget

- Highlighting key takeaways or important notes
- Displaying fun facts or "Did you know?" boxes
- Showing safety warnings or reminders
- Adding emphasis to critical information

## Setting it up

1. Add an Exercise node to your lesson
2. Set the widget to "core.callout"
3. Choose a type: tip, info, warning, or success
4. Write a title and the content text
5. Optionally add an emoji icon

## Configuration fields

| Field     | Type   | Required | Description                                                    |
| --------- | ------ | -------- | -------------------------------------------------------------- |
| `type`    | string | Yes      | The callout style: "tip", "info", "warning", or "success".     |
| `title`   | string | No       | A heading for the callout card.                                |
| `content` | string | Yes      | The main text content of the callout.                          |
| `icon`    | string | No       | An emoji icon to display with the callout, e.g. "💡" for tips. |

## Example

```json
{
  "type": "exercise",
  "title": "Did you know?",
  "widget": "core.callout",
  "config": {
    "type": "tip",
    "title": "Did you know?",
    "content": "Plants make their own food using sunlight, water, and carbon dioxide through a process called photosynthesis.",
    "icon": "🌿"
  }
}
```

## Tips

- Keep content concise — 1-3 sentences is ideal
- Use the right type for your message: tip for helpful hints, warning for important cautions
- Emoji icons add visual appeal but are optional
- Callouts work well between other activities to break up the lesson flow
