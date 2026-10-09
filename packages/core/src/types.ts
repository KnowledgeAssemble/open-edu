import type {
  ContentNode,
  Workflow,
  Rewards,
  CardDefinitions,
  PackageManifest,
  BundleManifest,
  ReproductionRecord,
} from '@open-edu/schemas';

export interface LoadedNode {
  path: string;
  relativePath: string;
  content: string;
  node: ContentNode;
}

export interface PackageFileSource {
  get(path: string): Uint8Array | undefined;
  list(prefix?: string): string[];
}

export interface LoadedPackage {
  rootDir: string;
  manifest: PackageManifest;
  workflow: Workflow | null;
  rewards: Rewards | null;
  cards: CardDefinitions | null;
  provenance?: ReproductionRecord;
  nodes: LoadedNode[];
  assetPaths: string[];
  assetMap?: Map<string, ArrayBuffer>;
}

export interface LoadedBundle {
  rootDir: string;
  manifest: BundleManifest;
  modules: LoadedPackage[];
  moduleMap: Map<string, LoadedPackage>;
  rewards: Rewards | null;
  cards: CardDefinitions | null;
}
