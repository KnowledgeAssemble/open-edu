import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { WidgetDefinitionV2 } from '../../types';
import { LearningIntent } from '../../metadata/learning-intents';
import { Button } from '@open-edu/design-system';
import { useObserveMode } from '../../use-observe-mode';
import { WidgetError } from '../WidgetError';
import { SvgExplorer } from '../../svg-explorer/SvgExplorer.js';

const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  tooltip: z.string().optional(),
  image: z.string().optional(),
  path: z.string().optional(),
});

const markerSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  icon: z.string().optional(),
});

const legendItemSchema = z.object({
  color: z.string(),
  label: z.string(),
});

const socialMapSchema = z.object({
  map: z.string().optional(),
  svgSrc: z.string().max(2048).optional(),
  regions: z.array(regionSchema).min(1),
  labels: z.boolean().optional().default(true),
  legend: z.array(legendItemSchema).optional(),
  markers: z.array(markerSchema).optional(),
  zoom: z.boolean().optional().default(false),
  projection: z.string().optional(),
  title: z.string().optional(),
  interactive: z.boolean().optional().default(false),
  targetRegion: z.string().optional(),
});

const SocialMapStateSchema = z.object({
  selectedRegion: z.string().optional(),
  foundRegions: z.array(z.string()),
  zoomLevel: z.number().optional(),
});

function SocialMapComponent(props: {
  nodeId: string;
  config: Record<string, unknown>;
  emitInteraction: (data: Record<string, unknown>) => void;
  complete: (score?: number, state?: unknown) => void;
  storedState?: unknown;
  resolveAsset?: (path: string) => string;
}) {
  const { config: rawConfig, emitInteraction, complete, storedState, resolveAsset } = props;
  const parsed = socialMapSchema.safeParse(rawConfig);
  const parsedState = useMemo(() => {
    const result = SocialMapStateSchema.safeParse(storedState);
    return result.success ? result.data : null;
  }, [storedState]);

  const [selectedRegion, setSelectedRegion] = useState<string | null>(
    parsedState?.selectedRegion ?? null,
  );
  const [foundRegions, setFoundRegions] = useState<string[]>(parsedState?.foundRegions ?? []);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(parsedState?.zoomLevel ?? 1);

  const isObserve = parsed.success && !parsed.data.interactive;
  const { handleAcknowledge, showAcknowledgeButton } = useObserveMode({
    isObserve,
    onComplete: complete,
    onInteract: emitInteraction,
    widgetId: 'social.map',
  });

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (!parsed.success || !parsed.data) return;
      if (!parsed.data.interactive) return;
      setSelectedRegion(regionId);

      const isCorrect = parsed.data.targetRegion === regionId;
      if (isCorrect && !foundRegions.includes(regionId)) {
        const next = [...foundRegions, regionId];
        setFoundRegions(next);
        emitInteraction({
          type: 'widget.interaction',
          widgetId: 'social.map',
          action: 'found',
          regionId,
        });
        if (parsed.data.targetRegion) {
          complete(100, { selectedRegion: regionId, foundRegions: next });
        }
      } else {
        emitInteraction({
          type: 'widget.interaction',
          widgetId: 'social.map',
          action: 'select',
          regionId,
        });
      }
    },
    [parsed, foundRegions, emitInteraction, complete],
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(z - 0.25, 0.5));
  }, []);

  if (!parsed.success) {
    return <WidgetError />;
  }

  const config = parsed.data;

  // SVG-based rendering via SvgExplorer
  if (config.svgSrc) {
    const resolvedSvgSrc = resolveAsset ? resolveAsset(config.svgSrc) : config.svgSrc;
    const selectedSvg = config.regions.find((r) => r.id === selectedRegion);
    return (
      <div className="space-y-4">
        {config.title && <h2 className="text-on-surface text-xl font-semibold">{config.title}</h2>}

        {config.interactive && config.targetRegion && (
          <p className="text-on-surface/70 text-sm">
            Find:{' '}
            {config.regions.find((r) => r.id === config.targetRegion)?.name ?? config.targetRegion}
          </p>
        )}

        <SvgExplorer
          src={resolvedSvgSrc}
          regions={config.regions.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            color: r.color,
          }))}
          selection={config.interactive ? 'single' : 'none'}
          zoom={config.zoom ? { enabled: true } : undefined}
          onEvent={(event) => {
            if (event.type === 'region:select') {
              setSelectedRegion(event.regionId);
              emitInteraction({
                type: 'widget.interaction',
                widgetId: 'social.map',
                action: 'select',
                regionId: event.regionId,
              });
              if (config.targetRegion && event.regionId === config.targetRegion) {
                if (!foundRegions.includes(event.regionId)) {
                  const next = [...foundRegions, event.regionId];
                  setFoundRegions(next);
                  complete(100, { selectedRegion: event.regionId, foundRegions: next });
                } else {
                  complete(100, { selectedRegion: event.regionId, foundRegions });
                }
              }
            }
          }}
        />

        {selectedSvg?.description && (
          <div
            className="border-outline-variant bg-surface-container p-sm rounded-lg border"
            role="status"
            aria-live="polite"
          >
            <p className="text-on-surface font-medium">{selectedSvg.name}</p>
            <p className="text-on-surface/70 text-sm">{selectedSvg.description}</p>
          </div>
        )}

        {isObserve && showAcknowledgeButton && (
          <div className="p-md border-outline-variant flex items-center justify-center border-t">
            <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
              Mark as seen ✓
            </Button>
          </div>
        )}
      </div>
    );
  }

  const selected = config.regions.find((r) => r.id === selectedRegion);
  const hovered = config.regions.find((r) => r.id === hoveredRegion);

  const viewBoxWidth = 600;
  const viewBoxHeight = 400;
  const regionWidth = 80;
  const totalRegions = config.regions.length;
  const fallbackSpacing = Math.min(regionWidth + 20, (viewBoxWidth - 40) / totalRegions);

  return (
    <div role="group" aria-label={config.title ?? 'Interactive map'} data-testid="social-map">
      {config.title && <h3 className="text-on-surface mb-sm font-semibold">{config.title}</h3>}

      {config.interactive && parsed.data.targetRegion && (
        <p className="text-on-surface/70 mb-sm text-sm">
          Find:{' '}
          {config.regions.find((r) => r.id === parsed.data.targetRegion)?.name ??
            parsed.data.targetRegion}
        </p>
      )}

      {config.zoom && (
        <div className="gap-xs mb-sm flex">
          <Button variant="outline" size="sm" onClick={handleZoomIn} aria-label="Zoom in">
            +
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut} aria-label="Zoom out">
            −
          </Button>
          <span className="text-on-surface/70 self-center text-sm">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      )}

      <div
        className="border-outline-variant bg-surface-container-lowest overflow-auto rounded-lg border"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
      >
        <svg
          width="100%"
          height="400"
          viewBox="0 0 600 400"
          role={parsed.data.interactive ? 'application' : 'img'}
          aria-label={config.title ?? 'Map'}
        >
          {config.regions.map((region) => (
            <g
              key={region.id}
              onClick={() => handleRegionClick(region.id)}
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              className="cursor-pointer"
              role={parsed.data.interactive ? 'button' : 'img'}
              aria-label={region.name}
              tabIndex={parsed.data.interactive ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRegionClick(region.id);
                }
              }}
            >
              {region.path ? (
                <path
                  d={region.path}
                  fill={region.color ?? 'var(--oe-color-primary-container, #e8def8)'}
                  stroke={
                    selectedRegion === region.id
                      ? 'var(--oe-color-primary, #6750a4)'
                      : 'var(--oe-color-outline, #79747e)'
                  }
                  strokeWidth={selectedRegion === region.id ? 3 : 1}
                />
              ) : (
                <rect
                  x={20 + config.regions.indexOf(region) * fallbackSpacing}
                  y={viewBoxHeight / 2 - 40}
                  width={regionWidth}
                  height={80}
                  rx={4}
                  fill={region.color ?? 'var(--oe-color-primary-container, #e8def8)'}
                  stroke={
                    selectedRegion === region.id
                      ? 'var(--oe-color-primary, #6750a4)'
                      : 'var(--oe-color-outline, #79747e)'
                  }
                  strokeWidth={selectedRegion === region.id ? 3 : 1}
                />
              )}
              {config.labels && (
                <text
                  x={
                    region.path
                      ? 300
                      : 20 + config.regions.indexOf(region) * fallbackSpacing + regionWidth / 2
                  }
                  y={region.path ? 200 : viewBoxHeight / 2}
                  textAnchor="middle"
                  fill="var(--oe-color-on-surface, #1c1b1f)"
                  fontSize={12}
                  fontWeight={500}
                  aria-hidden="true"
                >
                  {region.name}
                </text>
              )}
            </g>
          ))}

          {config.markers?.map((m) => (
            <g key={m.id}>
              <circle cx={m.x} cy={m.y} r={6} fill="var(--oe-color-error, #dc2626)" />
              <text
                x={m.x}
                y={m.y - 10}
                textAnchor="middle"
                fill="var(--oe-color-on-surface, #1c1b1f)"
                fontSize={10}
                aria-hidden="true"
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {(hovered || selected) && (
        <div
          className="border-outline-variant bg-surface-container p-sm mt-sm rounded-lg border"
          role="status"
          aria-live="polite"
        >
          <p className="text-on-surface font-medium">{(hovered ?? selected)?.name}</p>
          {(hovered ?? selected)?.description && (
            <p className="text-on-surface/70 text-sm">{(hovered ?? selected)?.description}</p>
          )}
        </div>
      )}

      {config.legend && config.legend.length > 0 && (
        <div className="gap-sm mt-sm flex flex-wrap" role="list" aria-label="Map legend">
          {config.legend.map((item, i) => (
            <div key={i} role="listitem" className="gap-xs flex items-center">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-on-surface/70 text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {isObserve && showAcknowledgeButton && (
        <div className="p-md border-outline-variant mt-md flex items-center justify-center border-t">
          <Button variant="default" onClick={handleAcknowledge} data-testid="observe-acknowledge">
            Mark as seen ✓
          </Button>
        </div>
      )}
    </div>
  );
}

const SocialMapWidget: WidgetDefinitionV2 = {
  guide: {
    oneLiner: 'Explore geographic and social concepts on an interactive map.',
    whatItDoes:
      'The Social Map widget shows an interactive map with regions, markers, and a legend. Students can explore regions, read descriptions, and find specific locations. It supports zooming, labels, and region highlighting. Optionally, an SVG file can be used as the map background via svgSrc for accurate region boundaries.',
    whenToUse: [
      'Teaching geography and map reading',
      'Exploring continents and countries',
      'Social studies and history map activities',
      'Community and neighborhood mapping',
    ],
    setupSteps: [
      'Add an Exercise node to your lesson',
      'Set the widget to "social.map"',
      'Define map regions with id, name, color, and description',
      'Optionally add markers for specific locations',
      'Add a legend to explain region colors',
      'Optionally set svgSrc to an SVG map file for accurate region shapes',
    ],
    configFields: [
      {
        name: 'regions',
        type: 'array of objects',
        required: true,
        description:
          'Map regions. Each has id (string), name (string), and optional color (CSS variable or hex), description (string), tooltip (string), image (string), and path (SVG path data string).',
      },
      {
        name: 'regions[].tooltip',
        type: 'string',
        required: false,
        description: 'Tooltip text shown when hovering over the region.',
      },
      {
        name: 'regions[].image',
        type: 'string',
        required: false,
        description:
          'Image URL for the region. Accepted by the schema but not currently rendered in the UI.',
      },
      {
        name: 'regions[].path',
        type: 'string',
        required: false,
        description:
          'SVG path d attribute for the region shape. Used when no svgSrc background is set.',
      },
      {
        name: 'svgSrc',
        type: 'string',
        required: false,
        description:
          "URL to an SVG file used as the map background. When set, region shapes come from the SVG file and each region's own path field is ignored.",
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'A title shown above the map.',
      },
      {
        name: 'labels',
        type: 'boolean',
        required: false,
        description: 'Show region name labels. Defaults to true.',
      },
      {
        name: 'zoom',
        type: 'boolean',
        required: false,
        description: 'Allow zooming in and out. Defaults to false.',
      },
      {
        name: 'legend',
        type: 'array of objects',
        required: false,
        description: 'Legend entries. Each has color (string) and label (string).',
      },
      {
        name: 'markers',
        type: 'array of objects',
        required: false,
        description:
          'Point markers. Each has id (string), label (string), x (number), y (number), and optional icon (string).',
      },
      {
        name: 'targetRegion',
        type: 'string',
        required: false,
        description: 'ID of a region to highlight for quiz mode.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        required: false,
        description: 'When false, shows the map for exploration. Defaults to false.',
      },
    ],
    exampleJson:
      '{\n  "type": "exercise",\n  "title": "World Continents",\n  "widget": "social.map",\n  "config": {\n    "regions": [\n      { "id": "north", "name": "North America", "description": "Third largest continent by area", "color": "var(--oe-color-primary)" },\n      { "id": "europe", "name": "Europe", "description": "Sixth largest continent", "color": "var(--oe-color-warning)" },\n      { "id": "africa", "name": "Africa", "description": "Second largest continent by area", "color": "var(--oe-color-error)" },\n      { "id": "asia", "name": "Asia", "description": "Largest and most populous continent", "color": "var(--oe-color-accent)" }\n    ],\n    "legend": [\n      { "color": "var(--oe-color-primary)", "label": "North America" },\n      { "color": "var(--oe-color-warning)", "label": "Europe" },\n      { "color": "var(--oe-color-error)", "label": "Africa" },\n      { "color": "var(--oe-color-accent)", "label": "Asia" }\n    ],\n    "title": "World Continents",\n    "labels": true,\n    "zoom": true,\n    "interactive": false,\n    "targetRegion": "asia"\n  }\n}',
    tips: [
      'Use clear, labeled maps for readability',
      'Include a legend when using multiple colors',
      'Keep region descriptions brief and informative',
      'Start with simple geographic features before complex ones',
      'Use svgSrc with an SVG map file for accurate region boundaries',
    ],
    sidebarPosition: 1,
    relatedWidgets: [
      {
        id: 'core.hotspot',
        name: 'Hotspot',
        domain: 'core',
        slug: 'hotspot',
      },
    ],
  },
  id: 'social.map',
  name: 'Interactive Map',
  description: 'Interactive educational maps for geography and history',
  domain: 'social',
  version: '1.0.0',
  schema: socialMapSchema,
  render: SocialMapComponent,
  learningIntents: [LearningIntent.Explore, LearningIntent.Observe],
  capabilities: {
    supportsObserveMode: true,
    supportsKeyboard: true,
    supportsScreenReader: true,
    supportsHints: true,
    supportsTouch: true,
    supportsMouse: true,
    supportsAnalytics: true,
    supportsRewards: true,
    supportsAccessibility: true,
    supportsOffline: true,
    supportsLocalization: true,
  },
  accessibility: {
    highContrast: true,
    keyboardOnly: true,
    screenReader: true,
    ariaSupport: true,
    focusManagement: true,
  },
  analytics: {
    trackAttempts: true,
    trackCompletionTime: true,
    trackHints: true,
    trackSuccessRate: true,
    trackInteractions: true,
  },
  reward: {
    completionXP: 15,
    confetti: true,
    positiveMessage: 'Geography explored!',
    achievement: 'first-map',
  },
  ai: {
    difficulty: 'medium',
    estimatedMinutes: 5,
    bloomsLevel: 'understand',
    cognitiveLoad: 'moderate',
    recommendedAge: [8, 18],
    readingLevel: 'grade-4',
    subjectTags: ['geography', 'history', 'social-studies'],
    learningObjectives: [
      'Identify regions on an interactive map',
      'Explore geographical relationships',
      'Locate specific features using map references',
    ],
    commonMisconceptions: [
      'Confusing similar-sounding region names',
      'Misreading map scale and relative distances',
    ],
    generationHints: [
      'Use SVG paths for accurate region boundaries',
      'Provide clear labels and distinct colors',
      'Include a legend for color-coded regions',
      'Add markers for key locations',
    ],
    authoringPrompt: 'Create an interactive map activity for geography or history education',
    exampleConfigs: [
      {
        title: 'Indian States',
        regions: [
          { id: 'mh', name: 'Maharashtra', color: '#e8def8', description: 'Western India' },
          { id: 'ka', name: 'Karnataka', color: '#d0bcff', description: 'Southern India' },
          { id: 'tn', name: 'Tamil Nadu', color: '#b69df8', description: 'Southeast India' },
        ],
        labels: true,
        interactive: true,
        targetRegion: 'ka',
        legend: [
          { color: '#e8def8', label: 'Western Region' },
          { color: '#d0bcff', label: 'Southern Region' },
          { color: '#b69df8', label: 'Southeastern Region' },
        ],
      },
    ],
  },
  icon: 'map',
  keywords: ['map', 'geography', 'regions', 'countries', 'states', 'explore'],
  status: 'stable',
};

export { SocialMapWidget as socialMap, socialMapSchema };
export default SocialMapWidget;
