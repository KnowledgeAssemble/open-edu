import { z } from 'zod';
import { SUPPORTED_LOCALES, isValidLocale } from '@open-edu/i18n/locale';

export const PACK_FORMAT = 'openedu-pack' as const;
export const PACK_FORMAT_VERSION = 1 as const;

export const PackTypeSchema = z.enum(['knowledge', 'curriculum']);
export type PackType = z.infer<typeof PackTypeSchema>;

const PackLanguageSchema = z
  .string()
  .refine(isValidLocale, { message: `language must be one of ${SUPPORTED_LOCALES.join(', ')}` })
  .default('en');

export const PackIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'id must be kebab-case');

export const PackManifestSchema = z
  .object({
    format: z.literal(PACK_FORMAT),
    formatVersion: z.literal(PACK_FORMAT_VERSION),
    type: PackTypeSchema,
    id: PackIdSchema,
    version: z
      .string()
      .min(1)
      .max(64)
      .regex(/^\d+\.\d+\.\d+$/, 'version must be semver (e.g. 1.0.0)'),
    name: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    author: z.string().min(1).max(128),
    language: PackLanguageSchema,
    requires: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)).default([]),
    derivedFrom: z.enum(['document']).optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;
