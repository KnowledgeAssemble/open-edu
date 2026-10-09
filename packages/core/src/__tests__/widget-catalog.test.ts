import { describe, it, expect } from 'vitest';
import {
  generateWidgetCatalog,
  getDefaultWidgetCatalog,
  type WidgetCatalogInput,
} from '../widget-catalog';

const SAMPLE_CATALOG: WidgetCatalogInput = {
  widgets: [
    {
      id: 'core.matching',
      name: 'Matching',
      description: 'Match items between two columns',
      domain: 'core',
      status: 'stable',
      learningIntents: ['practice'],
      legacyId: 'open-edu.matching',
    },
    {
      id: 'core.multiple-choice',
      name: 'Multiple Choice',
      description: 'Single or multi-question multiple choice',
      domain: 'core',
      status: 'stable',
      learningIntents: ['assess', 'practice'],
    },
    {
      id: 'math.fraction-visual',
      name: 'Fraction Visual',
      description: 'Visualize fractions',
      domain: 'math',
      status: 'stable',
      learningIntents: ['practice'],
    },
    {
      id: 'core.callout',
      name: 'Callout',
      description: 'Information callout',
      domain: 'core',
      status: 'experimental',
    },
    {
      id: 'core.multiple-choice-practice',
      name: 'Multiple Choice Practice',
      description: 'Practice mode multiple choice',
      domain: 'core',
      status: 'deprecated',
      deprecated: true,
      replacement: 'core.multiple-choice',
    },
  ],
};

describe('generateWidgetCatalog', () => {
  it('generates markdown for all widgets', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('Widget Catalog');
    expect(catalog).toContain('core.matching');
    expect(catalog).toContain('core.multiple-choice');
    expect(catalog).toContain('math.fraction-visual');
    expect(catalog).toContain('open-edu.matching');
  });

  it('includes learning intents for each widget', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('Practice');
    expect(catalog).toContain('Assess');
  });

  it('marks deprecated widgets', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('[DEPRECATED]');
  });

  it('marks experimental widgets', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('(experimental)');
  });

  it('groups widgets by domain', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('Core Widgets');
    expect(catalog).toContain('Math Widgets');
  });

  it('shows legacy IDs', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('Legacy ID: `open-edu.matching`');
  });

  it('shows replacement for deprecated widgets', () => {
    const catalog = generateWidgetCatalog(SAMPLE_CATALOG);
    expect(catalog).toContain('Use `core.multiple-choice` instead');
  });

  it('returns minimal catalog for empty input', () => {
    const catalog = generateWidgetCatalog({ widgets: [] });
    expect(catalog).toContain('Widget Catalog');
    expect(catalog).not.toContain('Core Widgets');
  });

  it('includes AI metadata when provided', () => {
    const catalog = generateWidgetCatalog({
      widgets: [
        {
          id: 'test.widget',
          name: 'Test Widget',
          description: 'A test',
          domain: 'core',
          status: 'stable',
          learningIntents: ['practice'],
          ai: {
            difficulty: 'easy',
            estimatedMinutes: 3,
            bloomsLevel: 'remember',
            recommendedAge: [5, 10],
            readingLevel: 'Grade 3',
            learningObjectives: ['Learn to test'],
            commonMisconceptions: ['Assuming tests always pass'],
            generationHints: ['Use simple language'],
          },
        },
      ],
    });
    expect(catalog).toContain('AI Notes');
    expect(catalog).toContain('Difficulty: easy');
    expect(catalog).toContain('Estimated time: 3 min');
    expect(catalog).toContain("Bloom's: remember");
    expect(catalog).toContain('Ages: 5-10');
    expect(catalog).toContain('Reading level: Grade 3');
    expect(catalog).toContain('Learning objectives:');
    expect(catalog).toContain('Learn to test');
    expect(catalog).toContain('Common misconceptions:');
    expect(catalog).toContain('Assuming tests always pass');
    expect(catalog).toContain('Generation hints:');
    expect(catalog).toContain('Use simple language');
  });

  it('includes capabilities when provided', () => {
    const catalog = generateWidgetCatalog({
      widgets: [
        {
          id: 'test.widget',
          name: 'Test',
          domain: 'core',
          status: 'stable',
          capabilities: ['observeMode', 'keyboard', 'screenReader', 'offline'],
        },
      ],
    });
    expect(catalog).toContain('Capabilities:');
    expect(catalog).toContain('keyboard');
    expect(catalog).toContain('screenReader');
    expect(catalog).toContain('offline');
  });

  it('includes accessibility when provided', () => {
    const catalog = generateWidgetCatalog({
      widgets: [
        {
          id: 'test.widget',
          name: 'Test',
          domain: 'core',
          status: 'stable',
          accessibility: ['highContrast', 'tts', 'ariaSupport'],
        },
      ],
    });
    expect(catalog).toContain('Accessibility:');
    expect(catalog).toContain('highContrast');
    expect(catalog).toContain('tts');
  });

  it('includes reward info when provided', () => {
    const catalog = generateWidgetCatalog({
      widgets: [
        {
          id: 'test.widget',
          name: 'Test',
          domain: 'core',
          status: 'stable',
          reward: { completionXP: 15, positiveMessage: 'Well done!', achievement: 'first-test' },
        },
      ],
    });
    expect(catalog).toContain('Rewards:');
    expect(catalog).toContain('15 XP');
    expect(catalog).toContain('Well done!');
    expect(catalog).toContain('achievement: first-test');
  });

  it('includes analytics when provided', () => {
    const catalog = generateWidgetCatalog({
      widgets: [
        {
          id: 'test.widget',
          name: 'Test',
          domain: 'core',
          status: 'stable',
          analytics: ['attempts', 'hints', 'completionTime'],
        },
      ],
    });
    expect(catalog).toContain('Analytics:');
    expect(catalog).toContain('attempts');
    expect(catalog).toContain('hints');
  });

  it('excludes the retired deprecated practice entry from the default catalog', () => {
    const catalog = getDefaultWidgetCatalog();
    expect(catalog).not.toContain('open-edu.multiple-choice-practice');
  });
});
