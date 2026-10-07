import { z, type ZodType } from 'zod';
import type { ResolverCatalog, CatalogWidgetMeta } from './widget-resolver.js';

export const WidgetCatalogFileSchema = z.object({
  registryId: z.string(),
  origin: z
    .string()
    .url()
    .refine((v) => new URL(v).protocol === 'https:', {
      message: 'catalog origin must be https',
    }),
  widgets: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      manifestUrl: z
        .string()
        .url()
        .refine((v) => new URL(v).protocol === 'https:', {
          message: 'manifestUrl must be https',
        }),
      integrity: z
        .string()
        .regex(/^sha256-[a-f0-9]{64}$/)
        .optional(),
      status: z.enum(['experimental', 'verified', 'deprecated', 'revoked']),
      trustTier: z.enum(['native', 'sandboxed']),
      offline: z.boolean(),
    }),
  ),
});
export type WidgetCatalogFile = z.infer<typeof WidgetCatalogFileSchema>;

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function catalogSchemaWithLoopback(allowLoopback: boolean): ZodType<WidgetCatalogFile> {
  const urlRefine = (v: string) =>
    allowLoopback ? isLoopbackUrl(v) : new URL(v).protocol === 'https:';
  const message = allowLoopback
    ? 'catalog urls must be https or loopback http'
    : 'catalog urls must be https';
  return z.object({
    registryId: z.string(),
    origin: z.string().url().refine(urlRefine, { message }),
    widgets: z.array(
      z.object({
        id: z.string(),
        version: z.string(),
        manifestUrl: z.string().url().refine(urlRefine, { message }),
        integrity: z
          .string()
          .regex(/^sha256-[a-f0-9]{64}$/)
          .optional(),
        status: z.enum(['experimental', 'verified', 'deprecated', 'revoked']),
        trustTier: z.enum(['native', 'sandboxed']),
        offline: z.boolean(),
      }),
    ),
  }) as ZodType<WidgetCatalogFile>;
}

export function loadStaticCatalog(
  json: unknown,
  opts?: { allowLoopback?: boolean },
): ResolverCatalog {
  const schema = opts?.allowLoopback ? catalogSchemaWithLoopback(true) : WidgetCatalogFileSchema;
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(`invalid catalog: ${result.error.message}`);
  }
  const parsed = result.data;
  const widgets = new Map<string, CatalogWidgetMeta>();
  for (const w of parsed.widgets) {
    widgets.set(`${w.id}@${w.version}`, {
      id: w.id,
      version: w.version,
      manifestUrl: w.manifestUrl,
      integrity: w.integrity,
      status: w.status,
      trustTier: w.trustTier,
      offline: w.offline,
    });
  }
  return { registryId: parsed.registryId, origin: parsed.origin, widgets };
}
