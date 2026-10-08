import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { PackSelectionPanel } from './PackSelectionPanel';
import { StudioAssistantProvider } from '../ai/StudioAssistantProvider';
import type { StudioApi } from '../studioApi.js';
import type { PackSummary, PackDetail, AuthoringContext } from '@open-edu/packs';

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
});

const curriculum: PackSummary = {
  id: 'nios-math-level-a',
  name: 'NIOS Mathematics Level A',
  version: '0.1.0',
  type: 'curriculum',
  language: 'en',
  conceptCount: 3,
  unitCount: 2,
  objectiveCount: 3,
};

const detail: PackDetail = {
  ...curriculum,
  requires: ['openedu-fractions'],
  units: [
    { id: 'fractions', title: 'Fractions', objectiveCount: 2 },
    { id: 'measurement', title: 'Measurement', objectiveCount: 1 },
  ],
  concepts: [],
};

const context = {
  packs: [{ id: 'nios-math-level-a', version: '0.1.0', type: 'curriculum' }],
  curriculumUnit: 'fractions',
  availableActivities: [],
  concepts: [],
  objectives: [],
  budget: { maxChars: 20000, usedChars: 0, truncated: [] },
  provenance: [],
} as unknown as AuthoringContext;

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <StudioAssistantProvider>{ui}</StudioAssistantProvider>
    </I18nProvider>
  );
}

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    listPacks: vi.fn().mockResolvedValue([curriculum]),
    getPackDetail: vi.fn().mockResolvedValue(detail),
    setAuthoringSelection: vi.fn().mockResolvedValue({ context, warnings: [] }),
    ...overrides,
  } as unknown as StudioApi;
}

describe('PackSelectionPanel', () => {
  it('renders the heading and lede', async () => {
    render(wrap(<PackSelectionPanel api={makeApi()} onError={() => {}} onAuthoring={() => {}} />));
    expect(await screen.findByText('Create from a curriculum pack')).toBeInTheDocument();
    expect(screen.getByText(/Pick a curriculum, unit, learner/)).toBeInTheDocument();
  });

  it('shows an empty state when no curriculum packs exist', async () => {
    const api = makeApi({ listPacks: vi.fn().mockResolvedValue([]) });
    render(wrap(<PackSelectionPanel api={api} onError={() => {}} onAuthoring={() => {}} />));
    expect(await screen.findByText(/No curriculum packs found/)).toBeInTheDocument();
  });

  it('resolves a selection and reports the authoring context', async () => {
    const api = makeApi();
    const onAuthoring = vi.fn();
    render(wrap(<PackSelectionPanel api={api} onError={() => {}} onAuthoring={onAuthoring} />));

    fireEvent.click(await screen.findByRole('combobox', { name: /curriculum/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'NIOS Mathematics Level A' }));

    await waitFor(() =>
      expect(api.getPackDetail).toHaveBeenCalledWith('nios-math-level-a', '0.1.0'),
    );

    await userEvent.click(screen.getByRole('button', { name: /create learning experience/i }));

    await waitFor(() => expect(onAuthoring).toHaveBeenCalledWith(context, []));
    expect(api.setAuthoringSelection).toHaveBeenCalledWith({
      curriculum: 'nios-math-level-a',
      unit: 'fractions',
      learner: 'neurotypical',
      locale: 'en',
    });
  });

  it('reports selection errors through onError', async () => {
    const api = makeApi({
      setAuthoringSelection: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const onError = vi.fn();
    render(wrap(<PackSelectionPanel api={api} onError={onError} onAuthoring={() => {}} />));

    fireEvent.click(await screen.findByRole('combobox', { name: /curriculum/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'NIOS Mathematics Level A' }));
    await userEvent.click(screen.getByRole('button', { name: /create learning experience/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });
});
