export const NAMESPACES = [
  'runtime',
  'learner',
  'widgets',
  'schemas',
  'studio',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export function isValidNamespace(value: string): value is Namespace {
  return (NAMESPACES as readonly string[]).includes(value);
}
