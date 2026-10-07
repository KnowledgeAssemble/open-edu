import {
  ArtifactContractSchema,
  ProfilesFileSchema,
  QualityRubricFileSchema,
  type ArtifactContractData,
  type LearnerProfileDefinition,
  type ProfilesFile,
  type QualityDimension,
  type QualityDimensionId,
  type QualityRubricFile,
} from './types.js';

import { readDataFile } from './dataPath.js';

const artifactContractJson = JSON.parse(readDataFile('artifact-contract.json'));
const profilesJson = JSON.parse(readDataFile('profiles.json'));
const qualityRubricJson = JSON.parse(readDataFile('quality-rubric.json'));
import { buildAuthoredPromptView } from './generate.js';

export * from './types.js';
export { buildAuthoredPromptView, generateArtifactContractData } from './generate.js';
export {
  getEngineSkillsData,
  loadEngineSkillDoc,
  loadEngineSchema,
  loadEngineExample,
  validateSpec,
  validateSkillExample,
} from './engine-skills.js';

export function getArtifactContractData(): ArtifactContractData {
  return ArtifactContractSchema.parse(artifactContractJson);
}

export function getArtifactContractPromptView(): string {
  return buildAuthoredPromptView();
}

export function getProfilesData(): ProfilesFile {
  return ProfilesFileSchema.parse(profilesJson);
}

export function getProfile(id: string): LearnerProfileDefinition | undefined {
  const profiles = getProfilesData().profiles;
  return profiles[id];
}

export function getQualityRubricData(): QualityRubricFile {
  return QualityRubricFileSchema.parse(qualityRubricJson);
}

export function getQualityDimension(id: QualityDimensionId): QualityDimension | undefined {
  const dimensions = getQualityRubricData().dimensions;
  return dimensions.find((d: QualityDimension) => d.id === id);
}
