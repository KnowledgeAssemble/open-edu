import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { AiStartPanel } from './AiStartPanel';
import { StudioAssistantProvider } from '../ai/StudioAssistantProvider';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <StudioAssistantProvider>{ui}</StudioAssistantProvider>
    </I18nProvider>
  );
}

describe('AiStartPanel', () => {
  it('renders the heading and lede', async () => {
    render(wrap(<AiStartPanel />));
    expect(await screen.findByText('Or start with AI')).toBeInTheDocument();
    expect(screen.getByText(/Paste your notes or lesson outline/)).toBeInTheDocument();
  });

  it('renders a CTA button to open the assistant', async () => {
    render(wrap(<AiStartPanel />));
    expect(screen.getByRole('button', { name: /open author assistant/i })).toBeInTheDocument();
  });

  it('renders an upload course spec control', async () => {
    render(wrap(<AiStartPanel />));
    expect(screen.getByRole('button', { name: /upload spec/i })).toBeInTheDocument();
  });

  it('opens the assistant with the composer prefilled instead of auto-sending a course draft', async () => {
    const presetSpy = vi.fn();
    window.addEventListener('studio:assistant:preset', presetSpy as EventListener);
    render(wrap(<AiStartPanel />));
    await userEvent.click(screen.getByRole('button', { name: /open author assistant/i }));
    await waitFor(() => expect(presetSpy).toHaveBeenCalled());
    const detail = presetSpy.mock.calls[0]![0].detail;
    expect(detail.prefill).toBe(true);
    expect(detail.message).toBeTruthy();
    window.removeEventListener('studio:assistant:preset', presetSpy as EventListener);
  });
});
