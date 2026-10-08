import { describe, it, expect } from 'vitest';
import { PackManifestSchema } from './manifest.js';

const validManifest = {
  format: 'openedu-pack',
  formatVersion: 1,
  type: 'knowledge',
  id: 'openedu-fractions',
  version: '0.1.0',
  name: 'OpenEdu Fractions',
  description: 'Fraction concepts for early mathematics.',
  author: 'OpenEdu',
  language: 'en',
  requires: [],
};

describe('PackManifestSchema', () => {
  it('parses a valid manifest', () => {
    const result = PackManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('openedu-fractions');
      expect(result.data.requires).toEqual([]);
    }
  });

  it('rejects a non-kebab-case id', () => {
    expect(PackManifestSchema.safeParse({ ...validManifest, id: 'OpenEdu.Fractions' }).success).toBe(
      false,
    );
  });

  it('rejects a non-semver version', () => {
    expect(PackManifestSchema.safeParse({ ...validManifest, version: 'v1' }).success).toBe(false);
  });

  it('rejects an unknown key (strict)', () => {
    expect(PackManifestSchema.safeParse({ ...validManifest, extra: true }).success).toBe(false);
  });

  it('accepts derivedFrom "document"', () => {
    const result = PackManifestSchema.safeParse({ ...validManifest, derivedFrom: 'document' });
    expect(result.success).toBe(true);
  });

  it('rejects a language outside the supported locales', () => {
    expect(PackManifestSchema.safeParse({ ...validManifest, language: 'en-IN' }).success).toBe(
      false,
    );
  });

  it('defaults the language to en when absent', () => {
    const { language, ...withoutLanguage } = validManifest;
    const result = PackManifestSchema.safeParse(withoutLanguage);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.language).toBe('en');
  });
});
