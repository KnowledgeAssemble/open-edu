import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { ObjectiveCoverage } from '@open-edu/packs';

const { openWithPresetMock } = vi.hoisted(() => ({
  openWithPresetMock: vi.fn(),
}));

vi.mock('../ai', () => ({
  useStudioAssistant: () => ({
    openWithPreset: openWithPresetMock,
  }),
}));
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { LearningIntent } from '@open-edu/widgets/intents';
import { PackBrowserPanel } from './PackBrowserPanel';
import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';

(globalThis as { axe?: typeof axe }).axe = axe;

const authoring: AuthoringContext = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  availableActivities: [],
  concepts: [
    { ref: { pack: 'openedu-fractions', concept: 'fraction' }, summary: 'Parts of a whole.' },
  ],
  objectives: [
    {
      id: 'represent-fraction',
      description: 'Represent three-quarters.',
      bloomLevel: 'apply',
      concepts: [{ pack: 'openedu-fractions', concept: 'fraction' }],
      requiresIntents: [LearningIntent.Practice, LearningIntent.Compare],
    },
  ],
  budget: { maxChars: 20000, usedChars: 100, truncated: ['objectives', 'availableActivities'] },
  provenance: [{ pack: 'openedu-fractions', version: '0.1.0', documents: ['nios-math-ch1'] }],
};

const warnings: PackDiagnostic[] = [
  { code: 'CAPABILITY_GAP', severity: 'warning', message: 'objective-x: no activity matched' },
];

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

describe('PackBrowserPanel', () => {
  it('renders packs, concepts, objectives, provenance and gaps', () => {
    render(
      wrap(
        <PackBrowserPanel authoring={authoring} warnings={warnings} capabilityGaps={['gap-1']} />,
      ),
    );
    expect(screen.getByText('curriculum/nios-math-level-a@0.1.0')).toBeInTheDocument();
    expect(screen.getByText('openedu-fractions/fraction')).toBeInTheDocument();
    expect(screen.getByText(/Represent three-quarters/)).toBeInTheDocument();
    expect(screen.getByText(/nios-math-ch1/)).toBeInTheDocument();
    expect(screen.getByText('gap-1')).toBeInTheDocument();
    expect(screen.getByText('objective-x: no activity matched')).toBeInTheDocument();
  });

  it('renders translated truncation sections', () => {
    render(wrap(<PackBrowserPanel authoring={authoring} warnings={[]} capabilityGaps={[]} />));
    expect(screen.getAllByText('Objectives').length).toBeGreaterThan(0);
    expect(screen.getByText('Available activities')).toBeInTheDocument();
  });

  it('renders empty states when nothing is in scope', () => {
    render(wrap(<PackBrowserPanel authoring={null} warnings={[]} capabilityGaps={[]} />));
    expect(screen.getAllByText('No concepts in scope.').length).toBeGreaterThan(0);
    expect(screen.getByText('No pack provenance recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('The context fits the prompt budget.')).toBeInTheDocument();
    expect(screen.getByText('No capability gaps.')).toBeInTheDocument();
  });

  const coverageFixture: ObjectiveCoverage[] = [
    {
      id: 'represent-fraction',
      description: 'Represent three-quarters.',
      requiresIntents: [LearningIntent.Practice],
      covered: true,
      satisfiedBy: ['math.number-line'],
    },
    {
      id: 'compare-fraction',
      description: 'Compare fractions',
      requiresIntents: [LearningIntent.Compare],
      covered: false,
      satisfiedBy: [],
    },
  ];

  it('renders one row per objective with covered status', () => {
    render(
      wrap(
        <PackBrowserPanel
          authoring={authoring}
          warnings={[]}
          capabilityGaps={[]}
          coverage={coverageFixture}
        />,
      ),
    );
    expect(screen.getByText('Represent three-quarters.')).toBeInTheDocument();
    expect(screen.getByText('Covered')).toBeInTheDocument();
    expect(screen.getByText('Not yet covered')).toBeInTheDocument();
  });

  it('offers a generate chip for uncovered objectives and presets the assistant', async () => {
    openWithPresetMock.mockClear();
    const user = userEvent.setup();
    render(
      wrap(
        <PackBrowserPanel
          authoring={authoring}
          warnings={[]}
          capabilityGaps={[]}
          coverage={coverageFixture}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Generate activity' }));
    expect(openWithPresetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prefill: true,
        message: expect.stringContaining('Compare fractions'),
      }),
    );
  });

  it('shows the empty-state hint without authoring', () => {
    render(
      wrap(<PackBrowserPanel authoring={null} warnings={[]} capabilityGaps={[]} coverage={[]} />),
    );
    expect(
      screen.getByText('Select a curriculum pack to see objective coverage.'),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      wrap(
        <PackBrowserPanel authoring={authoring} warnings={warnings} capabilityGaps={['gap-1']} />,
      ),
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
