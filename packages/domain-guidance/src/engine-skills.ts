import {
  MANIFEST,
  loadSkillDoc,
  loadSchema,
  loadSkillExample,
  validateSkillExample,
  validateSpec,
} from '@knowledgeassemble/engine-skills';
import type { EngineSkillEntry } from '@knowledgeassemble/engine-skills';
import {
  EngineSkillsDataSchema,
  type EngineSkillsData,
  type EngineSkillEntryData,
} from './types.js';

export function getEngineSkillsData(): EngineSkillsData {
  const parsed = EngineSkillsDataSchema.parse({
    package: 'engine-skills',
    version: MANIFEST.version,
    schemaVersion: 1 as const,
    engines: MANIFEST.engines.map((e: EngineSkillEntry) => ({
      type: e.type,
      skill: e.skill,
      kinds: e.kinds ?? [],
      skillDoc: e.skillDoc as string,
      schema: e.schema as string,
      example: e.example as string,
      validationContract: e.validationContract,
      namespacedEvents: e.namespacedEvents ?? [],
    })),
  });

  for (const entry of parsed.engines) {
    const noPackagePath = !/packages\/|docs\//.test(entry.skillDoc);
    const noSchemaPath = !/packages\/|docs\//.test(entry.schema);
    const noExamplePath = !/packages\/|docs\//.test(entry.example);
    if (!noPackagePath || !noSchemaPath || !noExamplePath) {
      throw new Error(
        `Portability violation for engine "${entry.type}": skillDoc/schema/example refs must not contain packages/ or docs/ path fragments.`,
      );
    }
  }

  return parsed;
}

export function loadEngineSkillDoc(type: string): string {
  return loadSkillDoc(type);
}

export function loadEngineSchema(type: string): unknown {
  return loadSchema(type);
}

export function loadEngineExample(type: string): unknown {
  return loadSkillExample(type);
}

export { validateSpec, validateSkillExample };

export type { EngineSkillsData, EngineSkillEntryData };
