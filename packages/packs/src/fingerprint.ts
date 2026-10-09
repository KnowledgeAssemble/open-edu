import { createHash } from 'node:crypto';
import type { AuthoringContext } from './context.js';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalizeContext(ctx: AuthoringContext): string {
  const { budget, ...rest } = ctx;
  return stableStringify({ ...rest, budget: { maxChars: budget.maxChars } });
}

export function fingerprintAuthoringContext(ctx: AuthoringContext): string {
  return `sha256:${createHash('sha256').update(canonicalizeContext(ctx)).digest('hex')}`;
}
