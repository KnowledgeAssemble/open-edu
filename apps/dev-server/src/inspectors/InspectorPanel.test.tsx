import { describe, it, expect, vi } from 'vitest';

vi.mock('axe-core', () => ({
  default: {
    run: vi.fn().mockResolvedValue({ violations: [] }),
  },
}));
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { InspectorPanel } from './InspectorPanel';
import type { RewardReceipt } from '@open-edu/rewards';

const emptyEvents: never[] = [];

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

const sampleRewardReceipts: RewardReceipt[] = [
  {
    actionId: 'r1',
    actionType: 'badge.award',
    dispatchedAt: Date.now(),
    status: 'delivered',
    detail: 'Badge awarded',
  },
];

describe('InspectorPanel', () => {
  it('should render telemetry tab by default in the drawer', () => {
    render(
      wrap(<InspectorPanel telemetryEvents={emptyEvents} open={true} onOpenChange={() => {}} />),
    );
    expect(screen.getByRole('complementary', { name: 'Preview DevTools' })).toBeInTheDocument();
    expect(screen.getByText('Telemetry')).toBeInTheDocument();
    expect(screen.getByText('Rewards')).toBeInTheDocument();
    expect(screen.getByText('A11y')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      wrap(<InspectorPanel telemetryEvents={emptyEvents} open={false} onOpenChange={() => {}} />),
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('should switch to accessibility tab on click', async () => {
    const user = userEvent.setup();
    render(
      wrap(<InspectorPanel telemetryEvents={emptyEvents} open={true} onOpenChange={() => {}} />),
    );
    await user.click(screen.getByRole('tab', { name: 'A11y' }));
    expect(screen.getByRole('tab', { name: 'A11y' })).toHaveAttribute('data-state', 'active');
  });

  it('should switch to rewards tab on click', async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <InspectorPanel
          telemetryEvents={emptyEvents}
          rewardReceipts={sampleRewardReceipts}
          definedRewards={[{ action: 'badge.award', badge: 'test' }]}
          open={true}
          onOpenChange={() => {}}
        />,
      ),
    );
    await user.click(screen.getByRole('tab', { name: 'Rewards' }));
    expect(screen.getByRole('tab', { name: 'Rewards' })).toHaveAttribute('data-state', 'active');
  });

  it('should show telemetry empty state', () => {
    render(
      wrap(<InspectorPanel telemetryEvents={emptyEvents} open={true} onOpenChange={() => {}} />),
    );
    expect(
      screen.getByText('No telemetry events yet. Interact with the content above.'),
    ).toBeInTheDocument();
  });

  it('should call onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      wrap(
        <InspectorPanel telemetryEvents={emptyEvents} open={true} onOpenChange={onOpenChange} />,
      ),
    );
    fireEvent.click(screen.getByLabelText('Close DevTools'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should close when Escape is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      wrap(
        <InspectorPanel telemetryEvents={emptyEvents} open={true} onOpenChange={onOpenChange} />,
      ),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show rewards in rewards tab', async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <InspectorPanel
          telemetryEvents={emptyEvents}
          rewardReceipts={sampleRewardReceipts}
          definedRewards={[{ action: 'badge.award', badge: 'test' }]}
          open={true}
          onOpenChange={() => {}}
        />,
      ),
    );
    await user.click(screen.getByRole('tab', { name: 'Rewards' }));
    expect(screen.getByText(/badge\.award/)).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
  });
});
