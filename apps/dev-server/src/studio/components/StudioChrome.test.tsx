import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import type { ThemeId } from '@open-edu/runtime';
import { StudioChrome } from './StudioChrome';
import type { StudioView } from '../types.js';

(globalThis as { axe?: typeof axe }).axe = axe;

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

function renderChrome(props: {
  view?: StudioView;
  courseTitle?: string;
  minimal?: boolean;
  activityLabel?: string;
  panelOpen?: boolean;
  setPanelOpen?: (open: boolean) => void;
  themeId?: ThemeId;
  onThemeChange?: (id: ThemeId) => void;
}) {
  const onNavigate = vi.fn();
  return {
    onNavigate,
    ...render(
      wrap(
        <StudioChrome
          onNavigate={onNavigate}
          courseTitle={props.courseTitle}
          view={props.view ?? 'home'}
          minimal={props.minimal}
          activityLabel={props.activityLabel}
          panelOpen={props.panelOpen}
          setPanelOpen={props.setPanelOpen}
          themeId={props.themeId}
          onThemeChange={props.onThemeChange}
        />,
      ),
    ),
  };
}

describe('StudioChrome', () => {
  it('renders brand text OpenEdu Studio', () => {
    renderChrome({});
    expect(screen.getByText('OpenEdu Studio')).toBeInTheDocument();
  });

  it('shows active aria-current on matching nav item', () => {
    renderChrome({ view: 'outline', courseTitle: 'Test' });
    const outlineBtn = screen.getByRole('button', { name: /outline/i });
    expect(outlineBtn).toHaveAttribute('aria-current', 'page');
  });

  it('disables course-required nav when no courseTitle', () => {
    renderChrome({ view: 'home', courseTitle: undefined });
    const outlineBtn = screen.getByRole('button', { name: /outline/i });
    expect(outlineBtn).toBeDisabled();
  });

  it('keeps Home enabled when no courseTitle', () => {
    renderChrome({ view: 'home', courseTitle: undefined });
    const homeBtn = screen.getByRole('button', { name: /^home$/i });
    expect(homeBtn).toBeEnabled();
  });

  it('shows Home before My courses in the top nav', () => {
    renderChrome({ view: 'home' });
    const banner = screen.getByRole('banner');
    const labels = within(banner)
      .getAllByRole('button')
      .map((btn) => (btn.getAttribute('aria-label') ?? btn.textContent ?? '').trim())
      .filter((label) => ['Home', 'My courses', 'Outline', 'Preview'].includes(label));
    expect(labels).toEqual(['Home', 'My courses', 'Outline', 'Preview']);
  });

  it('navigates Home from the top nav', async () => {
    const { onNavigate } = renderChrome({ view: 'library', courseTitle: 'Test' });
    await userEvent.click(screen.getAllByRole('button', { name: /^home$/i })[0]!);
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('renders the theme switcher and calls onThemeChange on selection', async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    renderChrome({
      view: 'home',
      themeId: 'lumina-scholastica',
      onThemeChange,
    });
    await user.click(screen.getByRole('button', { name: /select theme/i }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByText('OpenEdu Dark'));
    expect(onThemeChange).toHaveBeenCalledWith('nocturnal');
  });

  it('places the theme switcher after the author companion toggle', () => {
    renderChrome({
      view: 'home',
      panelOpen: false,
      setPanelOpen: vi.fn(),
      themeId: 'lumina-scholastica',
      onThemeChange: vi.fn(),
    });
    const buttons = within(screen.getByRole('banner')).getAllByRole('button');
    const assistantIdx = buttons.findIndex((btn) =>
      (btn.getAttribute('aria-label') ?? '').includes('Author Assistant'),
    );
    const themeIdx = buttons.findIndex((btn) => btn.getAttribute('aria-label') === 'Select theme');
    expect(assistantIdx).toBeGreaterThanOrEqual(0);
    expect(themeIdx).toBeGreaterThan(assistantIdx);
  });

  it('does not render the theme switcher without theme props', () => {
    renderChrome({ view: 'home' });
    expect(screen.queryByRole('button', { name: /select theme/i })).not.toBeInTheDocument();
  });

  it('disables the Share CTA when no courseTitle', () => {
    renderChrome({ view: 'home', courseTitle: undefined });
    const shareBtn = screen.getByRole('button', { name: /share/i });
    expect(shareBtn).toBeDisabled();
  });

  it('calls onNavigate on Share click', async () => {
    const { onNavigate } = renderChrome({ courseTitle: 'Test' });
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onNavigate).toHaveBeenCalledWith('share');
  });

  it('does not render a studio mode switch', () => {
    renderChrome({});
    expect(screen.queryByRole('switch', { name: /studio mode/i })).not.toBeInTheDocument();
  });

  it('hides nav when minimal', () => {
    renderChrome({ minimal: true, courseTitle: 'Test' });
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /outline/i })).not.toBeInTheDocument();
  });

  it('renders breadcrumbs when not on home', () => {
    renderChrome({ view: 'outline', courseTitle: 'Test Course' });
    expect(screen.getByText('Test Course')).toBeInTheDocument();
    const outlineElements = screen.getAllByText('Outline');
    expect(outlineElements.length).toBeGreaterThanOrEqual(1);
  });

  it('is accessible', async () => {
    const { container } = renderChrome({ view: 'outline', courseTitle: 'Test' });
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it('shows the author assistant header button when setPanelOpen is provided', () => {
    renderChrome({ view: 'home', panelOpen: false, setPanelOpen: vi.fn() });
    expect(screen.getByRole('button', { name: /open author assistant/i })).toBeInTheDocument();
  });
});
