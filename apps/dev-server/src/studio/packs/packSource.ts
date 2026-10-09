import { packData } from 'virtual:open-edu-packs';
import type { LoadedPack } from '@open-edu/packs';

export function getBundledPacks(): LoadedPack[] {
  return packData ?? [];
}
