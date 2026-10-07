import { WidgetManifestSchema, type WidgetManifest, type WidgetPolicy } from '@open-edu/schemas';
import { canonicalIntegrity } from '../integrity.js';
import {
  extractCspMeta,
  hasCspDirective,
  isSelfContainedHtml,
  verifyDocumentCsp,
} from './verify-suite.js';

export interface WidgetPackageInput {
  manifestJson: unknown;
  documentBytes: Uint8Array;
  archiveBytes?: Uint8Array;
  cspHeader?: string;
}

export type PackageValidation =
  | { ok: true; manifest: WidgetManifest }
  | { ok: false; errors: string[] };

function documentHtml(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function cspErrors(html: string, header?: string): string[] {
  const cspText = header ?? extractCspMeta(html);
  if (typeof cspText !== 'string') {
    return ['csp-missing-connect-none', 'csp-missing-frame-none'];
  }
  const errors: string[] = [];
  if (!hasCspDirective(cspText, 'connect-src')) errors.push('csp-missing-connect-none');
  if (!hasCspDirective(cspText, 'frame-src')) errors.push('csp-missing-frame-none');
  return errors;
}

export async function validateWidgetPackage(
  input: WidgetPackageInput,
  policy: Pick<WidgetPolicy, 'maxArtifactBytes'>,
): Promise<PackageValidation> {
  const parsed = WidgetManifestSchema.safeParse(input.manifestJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    return {
      ok: false,
      errors: [`manifest-invalid: ${where}${issue?.message ?? 'invalid manifest'}`],
    };
  }

  const manifest = parsed.data;
  const errors: string[] = [];

  const html = documentHtml(input.documentBytes);

  const documentIntegrity = await canonicalIntegrity(input.documentBytes as BufferSource);
  if (documentIntegrity !== manifest.artifact.documentIntegrity) {
    errors.push('document-integrity-mismatch');
  }

  if (manifest.artifact.sizeBytes !== input.documentBytes.byteLength) {
    errors.push('size-mismatch');
  }
  if (manifest.artifact.sizeBytes > policy.maxArtifactBytes) {
    errors.push('size-exceeds-policy');
  }

  if (input.archiveBytes) {
    const archiveUrl = manifest.artifact.archiveUrl;
    const archiveIntegrity = manifest.artifact.archiveIntegrity;
    if (!archiveUrl && !archiveIntegrity) {
      errors.push('archive-missing-metadata');
    } else if (archiveIntegrity) {
      const actual = await canonicalIntegrity(input.archiveBytes as BufferSource);
      if (actual !== archiveIntegrity) {
        errors.push('archive-integrity-mismatch');
      }
    }
  }

  if (!verifyDocumentCsp(html, input.cspHeader)) {
    errors.push(...cspErrors(html, input.cspHeader));
  }

  const selfContained = isSelfContainedHtml(html);
  if (!selfContained.ok) {
    errors.push(`relative-subresource:${selfContained.offending ?? ''}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, manifest };
}
