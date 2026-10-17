# @open-edu/schemas

## 0.2.0

### Minor Changes

- 60f2464: Make `@open-edu/packs` publishable. The shared `LearningIntent` enum, the `SUPPORTED_LOCALES`/`Locale`/`DEFAULT_LOCALE`/`isValidLocale` helpers, and `matchesIntentTagFilters` now live in `@open-edu/schemas`, which drops `@open-edu/packs`'s runtime dependencies on the private `@open-edu/widgets` and `@open-edu/i18n` packages (packs now depends only on `@open-edu/schemas` and `zod`). `@open-edu/widgets` and `@open-edu/i18n` keep re-exporting these from `@open-edu/schemas`, so existing imports such as `@open-edu/widgets/intents` and `@open-edu/i18n/locale` continue to work. `@open-edu/packs` also re-exports the learning intents and locale helpers, and is added to the release build.
- 0adc52e: Add RegistryMetadataSchema, enriched catalog fields, draft-7 JSON Schema generation, catalog checksum enforcement on install, and the new @open-edu/registry package (GitHub-native course registry tooling). All three packages are published as ESM-only (the `exports` map exposes an `import` condition only), and the published `dist` excludes test files.
