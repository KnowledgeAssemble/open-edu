import { z } from 'zod';
import type { PackManifest } from './manifest.js';
import type { Concept } from './concept.js';
import type { Curriculum } from './curriculum.js';

export type PackSeverity = 'error' | 'warning';
export type PackErrorCode =
  | 'PACK_MANIFEST_MISSING'
  | 'PACK_MANIFEST_INVALID'
  | 'PACK_VERSION_INVALID'
  | 'PACK_DEPENDENCY_MISSING'
  | 'KNOWLEDGE_CONCEPT_INVALID'
  | 'KNOWLEDGE_SOURCE_MISSING'
  | 'KNOWLEDGE_PREREQ_CYCLE'
  | 'KNOWLEDGE_PREREQ_UNKNOWN'
  | 'CURRICULUM_INVALID'
  | 'CURRICULUM_PREREQ_UNKNOWN'
  | 'CURRICULUM_PREREQ_CYCLE'
  | 'PACK_REFERENCE_MISSING'
  | 'OBJECTIVE_INTENT_UNKNOWN'
  | 'OBJECTIVE_NO_CONCEPTS'
  | 'CAPABILITY_GAP'
  | 'BLUEPRINT_WIDGET_UNKNOWN'
  | 'BLUEPRINT_AUDIENCE_MISMATCH';
export interface PackDiagnostic {
  code: PackErrorCode;
  severity: PackSeverity;
  message: string;
}

export const SourceDocumentSchema = z.object({
  title: z.string().min(1).max(256),
  publisher: z.string().max(256).optional(),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  license: z.string().max(128).optional(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export interface LoadedPack {
  dir: string;
  manifest: PackManifest;
  concepts?: Concept[];
  curriculum?: Curriculum;
  sources?: Record<string, SourceDocument>;
}
