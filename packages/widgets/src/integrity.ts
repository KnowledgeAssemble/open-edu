export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

const INTEGRITY_RE = /^sha256-[a-f0-9]{64}$/;

export function parseIntegrity(value: string): string {
  const normalized = value.trim();
  if (!INTEGRITY_RE.test(normalized)) {
    throw new IntegrityError(
      `Invalid integrity "${value}". Expected sha256- followed by 64 lowercase hex chars.`,
    );
  }
  return normalized;
}

export async function canonicalIntegrity(bytes: BufferSource): Promise<string> {
  const input = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const hash = await crypto.subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256-${hex}`;
}

export async function verifyIntegrity(bytes: BufferSource, expected: string): Promise<true> {
  const parsed = parseIntegrity(expected);
  const actual = await canonicalIntegrity(bytes);
  if (actual !== parsed) {
    throw new IntegrityError(`Integrity mismatch: expected ${parsed}, got ${actual}`);
  }
  return true;
}
