import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import axe from 'axe-core';
import { extractAlternativeRows, AlternativeList } from '../src/alternative-list';

describe('extractAlternativeRows', () => {
  it('keeps cycle rows with a label', () => {
    const rows = extractAlternativeRows([
      { kind: 'cycle', id: 'cycle-a-b', members: ['a', 'b'], label: 'Cycle: a → b' },
    ]);
    expect(rows).toEqual([{ id: 'cycle-a-b', kind: 'cycle', text: 'Cycle: a → b' }]);
  });

  it('falls back to the members join when a cycle row has no label', () => {
    const rows = extractAlternativeRows([{ kind: 'cycle', id: 'cycle-a-b', members: ['a', 'b'] }]);
    expect(rows).toEqual([{ id: 'cycle-a-b', kind: 'cycle', text: 'a → b' }]);
  });

  it('keeps node rows that carry a description', () => {
    const rows = extractAlternativeRows([
      { kind: 'node', id: 'n1', nodeId: 'a', label: 'Stage A', description: 'Water enters.' },
    ]);
    expect(rows).toEqual([{ id: 'n1', kind: 'node', text: 'Water enters.' }]);
  });

  it('drops node rows without a description', () => {
    const rows = extractAlternativeRows([
      { kind: 'node', id: 'n1', nodeId: 'a', label: 'Stage A' },
    ]);
    expect(rows).toEqual([]);
  });

  it('always drops edge rows', () => {
    const rows = extractAlternativeRows([
      { kind: 'edge', id: 'e1', label: 'a leads-to b' },
      { kind: 'cycle', id: 'c1', label: 'Cycle' },
    ]);
    expect(rows).toEqual([{ id: 'c1', kind: 'cycle', text: 'Cycle' }]);
  });

  it('drops rows without a kind (geomap shape)', () => {
    const rows = extractAlternativeRows([
      { entityId: 'odisha', type: 'state', name: 'Odisha', description: 'A state.' },
    ]);
    expect(rows).toEqual([]);
  });

  it('returns an empty array for undefined or empty input', () => {
    expect(extractAlternativeRows(undefined)).toEqual([]);
    expect(extractAlternativeRows([])).toEqual([]);
  });
});

describe('AlternativeList', () => {
  it('renders nothing for an empty row list', () => {
    const { container } = render(<AlternativeList title="Alt" cycleLabel="Cycle" rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a collapsed disclosure with the title in the summary', () => {
    const { container } = render(
      <AlternativeList
        title="Text alternative"
        cycleLabel="Cycle"
        rows={[{ id: 'c1', kind: 'cycle', text: 'Cycle: a → b' }]}
      />,
    );
    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
    expect(container.querySelector('summary')).toHaveTextContent('Text alternative');
  });

  it('renders the title in the summary for a non-empty list', () => {
    const { container } = render(
      <AlternativeList
        title="Text alternative"
        cycleLabel="Cycle"
        rows={[{ id: 'c1', kind: 'cycle', text: 'Cycle: a → b' }]}
      />,
    );
    expect(container.querySelector('summary')).toHaveTextContent('Text alternative');
  });

  it('shows the cycle badge and data-kind for cycle rows only', () => {
    const { container, getByTestId } = render(
      <AlternativeList
        title="Text alternative"
        cycleLabel="Cycle"
        rows={[
          { id: 'c1', kind: 'cycle', text: 'Cycle: a → b' },
          { id: 'n1', kind: 'node', text: 'Water enters.' },
        ]}
      />,
    );
    const region = getByTestId('interactive-alternative');
    const cycleRow = within(region).getByText('Cycle: a → b').closest('li');
    const nodeRow = within(region).getByText('Water enters.').closest('li');
    expect(cycleRow).toHaveAttribute('data-kind', 'cycle');
    expect(nodeRow).toHaveAttribute('data-kind', 'node');
    expect(within(region).getByText('Cycle')).toBeInTheDocument();
    expect(container.querySelectorAll('li[data-kind="cycle"] span')).toHaveLength(1);
  });

  it('renders node rows without a badge', () => {
    const { getByTestId } = render(
      <AlternativeList
        title="Text alternative"
        cycleLabel="Cycle"
        rows={[{ id: 'n1', kind: 'node', text: 'Water enters.' }]}
      />,
    );
    const region = getByTestId('interactive-alternative');
    expect(within(region).queryByText('Cycle')).not.toBeInTheDocument();
  });

  it('passes axe-core accessibility audits', async () => {
    const { container } = render(
      <AlternativeList
        title="Text alternative"
        cycleLabel="Cycle"
        rows={[
          { id: 'c1', kind: 'cycle', text: 'Cycle: a → b' },
          { id: 'n1', kind: 'node', text: 'Water enters.' },
        ]}
      />,
    );
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
