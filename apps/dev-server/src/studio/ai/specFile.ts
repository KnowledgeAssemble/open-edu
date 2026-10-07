export type SpecExtension = '.json' | '.md';

/**
 * Resolve a course-spec file extension from a filename.
 * Returns null when the file is not an accepted .json / .md spec.
 */
export function resolveSpecExtension(filename: string): SpecExtension | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md')) return '.md';
  if (lower.endsWith('.json')) return '.json';
  return null;
}

export const SPEC_FILE_ACCEPT = '.json,.md,application/json,text/markdown,text/x-markdown';
