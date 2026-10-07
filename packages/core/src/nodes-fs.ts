import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeLoadError } from './errors.js';
import { resolveGeoUrisInNodes } from './geo-assets.js';
import { parseNodeContent } from './nodes.js';
import type { LoadedNode } from './types.js';

export async function loadNodes(
  packageDir: string,
  options?: { resolveGeoAssets?: boolean; geoAssetsDir?: string },
): Promise<LoadedNode[]> {
  const nodesDir = join(packageDir, 'nodes');

  interface DirentLike {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  let entries: DirentLike[];
  try {
    entries = (await readdir(nodesDir, { withFileTypes: true })) as unknown as DirentLike[];
  } catch {
    return [];
  }

  const nodes: LoadedNode[] = [];

  for (const entry of entries) {
    const absolutePath = join(nodesDir, entry.name);

    if (entry.isDirectory()) {
      throw new NodeLoadError(
        `Subdirectories inside nodes/ are not supported. Move "${entry.name}" to a flat file or use the widgets package: ${absolutePath}`,
      );
    }
    if (!entry.isFile()) {
      continue;
    }

    const content = await readFile(absolutePath, 'utf-8').catch((err: NodeJS.ErrnoException) => {
      throw new NodeLoadError(`Failed to read node "${entry.name}": ${err.message}`);
    });
    const relativePath = `nodes/${entry.name}`;
    const node = parseNodeContent(relativePath, content);

    nodes.push({
      path: absolutePath,
      relativePath,
      content,
      node,
    });
  }

  if (options?.resolveGeoAssets !== false) {
    await resolveGeoUrisInNodes(nodes, {
      geoAssetsDir: options?.geoAssetsDir,
      packageDir,
    });
  }

  return nodes;
}
