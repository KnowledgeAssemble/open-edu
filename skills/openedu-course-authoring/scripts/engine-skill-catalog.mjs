#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Loads the @knowledgeassemble/engine-skills catalog from a manifest file.
 * Returns an unavailable result when the file cannot be read or parsed.
 *
 * @param {string} manifestPath - path to manifest.json
 * @returns {EngineSkillCatalogResult}
 */
export function loadEngineSkillsCatalog(manifestPath) {
  if (!manifestPath || !existsSync(manifestPath)) {
    return {
      available: false,
      reason: 'catalog-not-found',
      engines: [],
    };
  }

  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    return {
      available: false,
      reason: 'catalog-read-error',
      engines: [],
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return {
      available: false,
      reason: 'catalog-parse-error',
      engines: [],
    };
  }

  if (!manifest.engines || !Array.isArray(manifest.engines)) {
    return {
      available: false,
      reason: 'catalog-missing-engines',
      engines: [],
    };
  }

  return {
    available: true,
    reason: null,
    engines: manifest.engines,
  };
}

/**
 * Finds an engine entry by type in an engines array.
 *
 * @param {Array} engines
 * @param {string} type
 * @returns {object|undefined}
 */
export function getEngineEntry(engines, type) {
  return engines.find((e) => e && e.type === type);
}

/**
 * Returns true if the type is known in the engines array.
 *
 * @param {Array} engines
 * @param {string} type
 * @returns {boolean}
 */
export function isKnownEngineType(engines, type) {
  return engines.some((e) => e && e.type === type);
}

/**
 * Returns the kinds array for a given engine type (empty array if none/missing).
 *
 * @param {Array} engines
 * @param {string} type
 * @returns {string[]}
 */
export function getEngineKinds(engines, type) {
  const entry = getEngineEntry(engines, type);
  return entry?.kinds ?? [];
}

/**
 * Loads the SKILL.md for a given engine type, resolved relative to the manifest directory.
 *
 * @param {string} manifestPath - path to manifest.json
 * @param {string} type
 * @returns {string}
 */
export function loadEngineSkillDoc(manifestPath, type) {
  const { engines } = loadEngineSkillsCatalog(manifestPath);
  const entry = getEngineEntry(engines, type);
  if (!entry?.skillDoc) return '';
  const docPath = join(dirname(manifestPath), entry.skillDoc);
  try {
    return readFileSync(docPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Loads the schema.json for a given engine type, resolved relative to the manifest directory.
 *
 * @param {string} manifestPath - path to manifest.json
 * @param {string} type
 * @returns {string}
 */
export function loadEngineSchema(manifestPath, type) {
  const { engines } = loadEngineSkillsCatalog(manifestPath);
  const entry = getEngineEntry(engines, type);
  if (!entry?.schema) return '';
  const schemaPath = join(dirname(manifestPath), entry.schema);
  try {
    return readFileSync(schemaPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Loads the skill-example.json for a given engine type, resolved relative to the manifest directory.
 *
 * @param {string} manifestPath - path to manifest.json
 * @param {string} type
 * @returns {string}
 */
export function loadEngineSkillExample(manifestPath, type) {
  const { engines } = loadEngineSkillsCatalog(manifestPath);
  const entry = getEngineEntry(engines, type);
  if (!entry?.example) return '';
  const examplePath = join(dirname(manifestPath), entry.example);
  try {
    return readFileSync(examplePath, 'utf-8');
  } catch {
    return '';
  }
}

// CLI mode: print engine summary
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: node engine-skill-catalog.mjs <manifest.json>');
    process.exit(1);
  }
  const result = loadEngineSkillsCatalog(manifestPath);
  if (!result.available) {
    console.error(`Engine skill catalog unavailable: ${result.reason}`);
    process.exit(1);
  }
  const summary = {
    available: true,
    totalEngines: result.engines.length,
    types: result.engines.map((e) => e.type).sort(),
    skills: result.engines.map((e) => ({ type: e.type, skill: e.skill, kinds: e.kinds ?? [] })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * @typedef {object} EngineSkillEntry
 * @property {string} type
 * @property {string} skill
 * @property {string[]} [kinds]
 * @property {string} [skillDoc]
 * @property {string} [schema]
 * @property {string} [example]
 * @property {object} [validationContract]
 */

/**
 * @typedef {object} EngineSkillCatalogResult
 * @property {boolean} available
 * @property {string|null} reason
 * @property {EngineSkillEntry[]} engines
 */