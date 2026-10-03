const DATA_ASSET_EXTENSIONS = ['.json', '.geojson', '.topojson'];

/**
 * Normalize an asset id exactly as RuntimeContext.resolveAsset does: strip a
 * leading "/", leading "./" or "../" segments, and a leading "assets/".
 */
export function normalizeAssetKey(path: string): string {
  return (path ?? '')
    .replace(/^\//, '')
    .replace(/^(?:\.\.?\/)*/, '')
    .replace(/^assets\//, '');
}

/** Data assets resolve to decoded file contents; everything else to a URL. */
export function isDataAssetId(id: string): boolean {
  const lower = (id ?? '').toLowerCase();
  return DATA_ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
