import { describe, it, expect } from 'vitest';
import { loadPackage } from '@open-edu/core';
import { resolve } from 'path';

describe('interactive-demo example', () => {
  it('should load without errors', async () => {
    // No geoAssetsDir passed: default discovery must find the vendored
    // geo-assets/ catalog inside this example package itself.
    const pkg = await loadPackage(resolve(__dirname));
    expect(pkg.manifest.id).toBe('interactive-demo');
    expect(pkg.manifest.title).toBe('Interactive Engine Demo');
    expect(pkg.nodes).toHaveLength(8);
    expect(pkg.workflow).not.toBeNull();
    expect(pkg.workflow!.routing).toHaveProperty('nodes/number-line.json');
    expect(pkg.workflow!.routing).toHaveProperty('nodes/number-line-practice.json');
    expect(pkg.workflow!.routing).toHaveProperty('nodes/composed-lesson.json');
    expect(pkg.workflow!.routing).toHaveProperty('nodes/geomap-identify-odisha.json');
    expect(pkg.workflow!.routing).toHaveProperty('nodes/diagram-figure.json');
    expect(pkg.workflow!.routing).toHaveProperty('nodes/diagram-frog-lifecycle.json');

    const numberLine = pkg.nodes.find((n) => n.relativePath === 'nodes/number-line.json');
    expect(numberLine?.node.type).toBe('interactive');
    if (numberLine?.node.type === 'interactive') {
      expect(numberLine.node.engine).toBe('visual');
      expect(numberLine.node.spec).toBeDefined();
    }

    const numberLinePractice = pkg.nodes.find(
      (n) => n.relativePath === 'nodes/number-line-practice.json',
    );
    expect(numberLinePractice?.node.type).toBe('interactive');
    if (numberLinePractice?.node.type === 'interactive') {
      expect(numberLinePractice.node.engine).toBe('visual');
      expect(numberLinePractice.node.prompt).toBe('Tap the emphasized number on the line.');
      const spec = numberLinePractice.node.spec as {
        content?: { components?: Array<{ props?: { interactive?: boolean } }> };
      };
      expect(spec.content?.components?.[0]?.props?.interactive).toBe(true);
    }

    const composed = pkg.nodes.find((n) => n.relativePath === 'nodes/composed-lesson.json');
    expect(composed?.node.type).toBe('interactive');
    if (composed?.node.type === 'interactive') {
      expect(composed.node.engines).toHaveLength(2);
      expect(composed.node.bindings).toHaveLength(1);
    }

    const geomapGuided = pkg.nodes.find(
      (n) => n.relativePath === 'nodes/geomap-identify-odisha.json',
    );
    expect(geomapGuided?.node.type).toBe('interactive');
    if (geomapGuided?.node.type === 'interactive') {
      expect(geomapGuided.node.engine).toBe('geomap');
      expect(geomapGuided.node.prompt).toBe('Select Odisha on the map.');
      const spec = geomapGuided.node.spec as {
        content?: {
          geography?: {
            sources?: Array<{
              uri?: string;
              type?: string;
              data?: { features?: Array<{ id?: string }> };
            }>;
          };
          layers?: Array<{
            id?: string;
            items?: Array<{ entity?: string; interactive?: boolean }>;
          }>;
        };
      };
      const source = spec.content?.geography?.sources?.[0];
      expect(source).toBeDefined();
      if (!source) return;
      // openedu://geo resolution must inline the vendored example catalog.
      expect(source.uri).toBeUndefined();
      expect(source.type).toBe('geojson');
      expect(source.data?.features?.length).toBeGreaterThan(0);
      expect(source.data?.features?.some((f) => f.id === 'IN-OD')).toBe(true);

      const odishaItem = spec.content?.layers?.[0]?.items?.find((i) => i.entity === 'odisha');
      expect(odishaItem?.interactive).toBe(true);
      const allInteractive = spec.content?.layers?.[0]?.items?.filter((i) => i.interactive);
      expect(allInteractive).toHaveLength(1);
    }

    const figure = pkg.nodes.find((n) => n.relativePath === 'nodes/diagram-figure.json');
    expect(figure?.node.type).toBe('interactive');
    if (figure?.node.type === 'interactive') {
      expect(figure.node.engine).toBe('diagram');
      expect(figure.node.figures?.a?.ref).toBe('assets/water-cycle.svg');
      expect(figure.node.figures?.a?.alt).toBe('Simple sketch of the water cycle');
    }

    // One figure per lifecycle stage: the host overlays each <img> on the diagram
    // node's layout bounds, keyed by authored node id (metadata.nodeId).
    const frog = pkg.nodes.find((n) => n.relativePath === 'nodes/diagram-frog-lifecycle.json');
    expect(frog?.node.type).toBe('interactive');
    if (frog?.node.type === 'interactive') {
      expect(frog.node.engine).toBe('diagram');
      const spec = frog.node.spec as {
        content?: {
          kind?: string;
          nodes?: Array<{ id: string; description?: string }>;
          edges?: Array<{ from: string; to: string; relationship: string }>;
        };
        sources?: Array<{ class?: string }>;
      };
      expect(spec.content?.kind).toBe('cycle');

      const stageIds = ['eggs', 'tadpole', 'tadpoleLegs', 'froglet', 'adult'];
      expect(spec.content?.nodes?.map((n) => n.id)).toEqual(stageIds);
      // Descriptions double as the text alternative (host AlternativeList reads
      // node rows carrying a description), so every stage needs one.
      for (const node of spec.content?.nodes ?? []) {
        expect(node.description, `stage "${node.id}" needs a description`).toBeTruthy();
      }

      // A cycle closes on adult -> eggs via reproduction, metamorphosis elsewhere.
      expect(spec.content?.edges?.map((e) => e.relationship)).toEqual([
        'transforms-to',
        'transforms-to',
        'transforms-to',
        'transforms-to',
        'produces',
      ]);

      // Every figure key must match an authored node id, or the host silently
      // places nothing (collectFigurePlacements drops unmatched keys). The asset
      // filename is kebab-case and is NOT derivable from the node id.
      const expected: Record<string, { file: string; alt: string }> = {
        eggs: {
          file: 'frog-eggs.svg',
          alt: 'Frog spawn: a jelly clump holding several embryos',
        },
        tadpole: {
          file: 'frog-tadpole.svg',
          alt: 'Newly hatched tadpole: round body, swimming tail, no legs',
        },
        tadpoleLegs: {
          file: 'frog-tadpole-legs.svg',
          alt: 'Tadpole growing legs: a body, a tail and two back legs',
        },
        froglet: { file: 'frog-froglet.svg', alt: 'Froglet: four legs and a shrinking tail' },
        adult: {
          file: 'frog-adult.svg',
          alt: 'Adult frog: broad body, raised eyes, four strong legs',
        },
      };
      expect(Object.keys(frog.node.figures ?? {}).sort()).toEqual(Object.keys(expected).sort());
      for (const [id, want] of Object.entries(expected)) {
        const fig = frog.node.figures?.[id];
        expect(fig?.ref, `figure "${id}" needs a ref`).toBe(`assets/${want.file}`);
        expect(
          fig && fig.decorative !== true ? fig.alt : undefined,
          `figure "${id}" needs alt`,
        ).toBe(want.alt);
      }
    }
  });
});
