import { describe, it, expect } from 'vitest';
import { normalizeAssetKey, isDataAssetId } from '../src/asset-resolution';

describe('normalizeAssetKey', () => {
  it('strips a leading assets/ prefix', () => {
    expect(normalizeAssetKey('assets/foo.json')).toBe('foo.json');
  });

  it('strips a leading ./ segment', () => {
    expect(normalizeAssetKey('./x.geojson')).toBe('x.geojson');
  });

  it('strips a leading slash before assets/', () => {
    expect(normalizeAssetKey('/assets/y.png')).toBe('y.png');
  });

  it('strips leading ../ segments', () => {
    expect(normalizeAssetKey('../z.topojson')).toBe('z.topojson');
    expect(normalizeAssetKey('../../deep/z.topojson')).toBe('deep/z.topojson');
  });

  it('leaves a bare id unchanged', () => {
    expect(normalizeAssetKey('foo.json')).toBe('foo.json');
  });

  it('normalizes an empty string to an empty string', () => {
    expect(normalizeAssetKey('')).toBe('');
  });
});

describe('isDataAssetId', () => {
  it('recognizes json, geojson and topojson as data assets', () => {
    expect(isDataAssetId('foo.json')).toBe(true);
    expect(isDataAssetId('foo.geojson')).toBe(true);
    expect(isDataAssetId('foo.topojson')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDataAssetId('DATA.JSON')).toBe(true);
    expect(isDataAssetId('data.GeoJSON')).toBe(true);
  });

  it('treats image and svg ids as URL assets', () => {
    expect(isDataAssetId('figure.png')).toBe(false);
    expect(isDataAssetId('figure.svg')).toBe(false);
  });

  it('rejects ids without an extension and empty strings', () => {
    expect(isDataAssetId('figure')).toBe(false);
    expect(isDataAssetId('')).toBe(false);
  });
});
