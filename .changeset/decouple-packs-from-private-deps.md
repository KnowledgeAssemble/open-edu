---
'@open-edu/schemas': minor
'@open-edu/packs': minor
---

Make `@open-edu/packs` publishable. The shared `LearningIntent` enum, the `SUPPORTED_LOCALES`/`Locale`/`DEFAULT_LOCALE`/`isValidLocale` helpers, and `matchesIntentTagFilters` now live in `@open-edu/schemas`, which drops `@open-edu/packs`'s runtime dependencies on the private `@open-edu/widgets` and `@open-edu/i18n` packages (packs now depends only on `@open-edu/schemas` and `zod`). `@open-edu/widgets` and `@open-edu/i18n` keep re-exporting these from `@open-edu/schemas`, so existing imports such as `@open-edu/widgets/intents` and `@open-edu/i18n/locale` continue to work. `@open-edu/packs` also re-exports the learning intents and locale helpers, and is added to the release build.
