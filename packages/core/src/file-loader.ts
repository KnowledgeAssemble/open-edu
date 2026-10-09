import type { LoadedPackage, PackageFileSource } from './types.js';
import type { Workflow, Rewards, CardDefinitions, ReproductionRecord } from '@open-edu/schemas';
import { parseManifest } from './manifest.js';
import { parseWorkflow } from './workflow.js';
import { parseRewards } from './rewards.js';
import { parseCards } from './cards.js';
import { parseProvenance } from './provenance.js';
import { loadNodesFromSource } from './nodes.js';
import { collectAssetsFromSource } from './asset-paths.js';
import { EntryNodeNotFoundError, ManifestValidationError, WorkflowRouteError } from './errors.js';
import { coreLoaderLogger } from './logger.js';

const COMPLETED_SENTINEL = 'COMPLETED';
const TEXT_DECODER = new TextDecoder();

function collectRouteTargets(routing: Record<string, unknown>): string[] {
  const targets: string[] = [];
  for (const def of Object.values(routing)) {
    if (typeof def !== 'object' || def === null) continue;
    if ('onComplete' in def && typeof def.onComplete === 'string') {
      targets.push(def.onComplete);
    }
    if ('conditions' in def && Array.isArray(def.conditions)) {
      for (const cond of def.conditions) {
        if (cond && typeof cond === 'object' && 'then' in cond) {
          const then = (cond as { then?: unknown }).then;
          if (typeof then === 'string') targets.push(then);
        }
      }
    }
  }
  return targets;
}

async function parseOptional(
  source: PackageFileSource,
  filePath: string,
  parser: (content: string, filePath: string) => unknown,
): Promise<unknown> {
  const bytes = source.get(filePath);
  if (bytes === undefined) return null;
  return parser(TEXT_DECODER.decode(bytes), filePath);
}

export async function loadPackageFromFiles(
  source: PackageFileSource,
  rootDir: string,
): Promise<LoadedPackage> {
  coreLoaderLogger.info('Loading package...', { rootDir });
  coreLoaderLogger.time('load-package');

  const manifestBytes = source.get('package.json');
  if (manifestBytes === undefined) {
    throw new ManifestValidationError('package.json not found in package', undefined, {
      file: 'package.json',
      suggestion: 'Create a package.json with id, title, version, author, and entry fields',
    });
  }
  const manifest = parseManifest(TEXT_DECODER.decode(manifestBytes));

  const [workflow, rewards, cards, provenance] = await Promise.all([
    parseOptional(source, 'workflow.json', parseWorkflow) as Promise<Workflow | null>,
    parseOptional(source, 'rewards.json', parseRewards) as Promise<Rewards | null>,
    parseOptional(source, 'cards.json', parseCards) as Promise<CardDefinitions | null>,
    parseOptional(source, 'provenance.json', parseProvenance) as Promise<ReproductionRecord | null>,
  ]);

  const nodes = loadNodesFromSource(source);
  const assetPaths = collectAssetsFromSource(source);

  const nodeMap = new Map(nodes.map((n) => [n.relativePath, n]));
  const available = Array.from(nodeMap.keys());
  const list = (extra?: string) =>
    `Available nodes: ${available.join(', ')}${extra ? `. ${extra}` : ''}`;

  const manifestNodePath = manifest.entry;
  if (!nodeMap.has(manifestNodePath)) {
    coreLoaderLogger.error(`Entry node "${manifestNodePath}" not found in package`, {
      path: manifestNodePath,
      available,
    });
    throw new EntryNodeNotFoundError(
      `Entry node "${manifestNodePath}" not found in package. ${list()}`,
      {
        path: manifestNodePath,
        suggestion: `Create a file at "nodes/${manifestNodePath.replace('nodes/', '')}" or change the "entry" field in package.json to one of: ${available.join(', ')}`,
      },
    );
  }

  if (workflow) {
    const routingKeys: string[] = [];
    for (const routePath of Object.keys(workflow.routing)) {
      if (!nodeMap.has(routePath)) {
        coreLoaderLogger.warn(`Workflow references unknown node "${routePath}"`, { routePath });
        throw new WorkflowRouteError(`Workflow references unknown node "${routePath}". ${list()}`, {
          path: routePath,
          suggestion: `Add a node at "nodes/${routePath.replace('nodes/', '')}" or remove the "${routePath}" key from workflow.json routing`,
        });
      }
      routingKeys.push(routePath);
    }

    const targets = collectRouteTargets(workflow.routing);
    for (const target of targets) {
      if (target === COMPLETED_SENTINEL) continue;
      if (!nodeMap.has(target)) {
        coreLoaderLogger.warn(`Workflow route targets unknown node "${target}"`, { target });
        throw new WorkflowRouteError(`Workflow route targets unknown node "${target}". ${list()}`, {
          path: target,
          suggestion: `Add a node at "nodes/${target.replace('nodes/', '')}" or change the route target in workflow.json to one of: ${available.join(', ')}`,
        });
      }
    }

    if (!routingKeys.includes(manifestNodePath)) {
      coreLoaderLogger.warn(`Manifest entry "${manifestNodePath}" is not a workflow routing key`, {
        manifestNodePath,
      });
      throw new WorkflowRouteError(
        `Manifest entry "${manifestNodePath}" is not a key in workflow.routing. The entry must be the first visited node. Routing keys: ${routingKeys.join(', ')}`,
      );
    }
  }

  coreLoaderLogger.timeEnd('load-package');
  coreLoaderLogger.info('Package loaded successfully', {
    rootDir,
    nodeCount: nodes.length,
  });

  return {
    rootDir,
    manifest,
    workflow,
    rewards,
    cards,
    provenance: provenance ?? undefined,
    nodes,
    assetPaths,
  };
}
