import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { HomeView } from './HomeView';
import { StudioAssistantProvider } from '../ai/StudioAssistantProvider';
import type { StudioApi } from '../studioApi.js';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      <StudioAssistantProvider>{ui}</StudioAssistantProvider>
    </I18nProvider>
  );
}

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn(),
    getOutline: vi.fn(),
    saveOutlineOrder: vi.fn(),
    applyTemplate: vi.fn().mockResolvedValue({ success: true }),
    exportOep: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    getAiStatus: vi.fn().mockResolvedValue({ available: false }),
    ...overrides,
  } as unknown as StudioApi;
}

function renderHome(
  overrides: {
    api?: StudioApi;
    onOpened?: () => void;
    onError?: (message: string) => void;
    courseTitle?: string;
    onOpenCurrent?: () => void;
    onOpenLibrary?: () => void;
  } = {},
) {
  return render(
    wrap(
      <HomeView
        api={overrides.api ?? makeApi()}
        onOpened={overrides.onOpened ?? (() => {})}
        onError={overrides.onError ?? (() => {})}
        courseTitle={overrides.courseTitle}
        onOpenCurrent={overrides.onOpenCurrent ?? (() => {})}
        onOpenLibrary={overrides.onOpenLibrary ?? (() => {})}
      />,
    ),
  );
}

describe('HomeView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all studio templates', async () => {
    renderHome();
    expect(await screen.findByText('Reading lesson')).toBeInTheDocument();
    expect(screen.getByText('Lesson + quiz')).toBeInTheDocument();
    expect(screen.getByText('Practice warm-up')).toBeInTheDocument();
    expect(screen.getByText('Short unit')).toBeInTheDocument();
  });

  it('selects a template card and applies via single Use template button', async () => {
    const api = makeApi();
    const onOpened = vi.fn();
    renderHome({ api, onOpened });
    const templateCard = await screen.findByRole('button', { name: /reading lesson/i });
    await userEvent.click(templateCard);
    expect(templateCard).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /use template/i }));
    expect(api.applyTemplate).not.toHaveBeenCalled();
    expect(screen.getByText('Replace this course?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /replace and continue/i }));
    expect(api.applyTemplate).toHaveBeenCalledWith('reading-lesson');
    expect(onOpened).toHaveBeenCalled();
  });

  it('cancels template overwrite without applying', async () => {
    const api = makeApi();
    renderHome({ api });
    const templateCard = await screen.findByRole('button', { name: /reading lesson/i });
    await userEvent.click(templateCard);
    await userEvent.click(screen.getByRole('button', { name: /use template/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(api.applyTemplate).not.toHaveBeenCalled();
    expect(screen.queryByText('Replace this course?')).not.toBeInTheDocument();
  });

  it('calls onError when template apply fails after confirm', async () => {
    const onError = vi.fn();
    const api = makeApi({
      applyTemplate: vi.fn().mockRejectedValue(new Error('boom')),
    });
    renderHome({ api, onError });
    const templateCard = await screen.findByRole('button', { name: /reading lesson/i });
    await userEvent.click(templateCard);
    await userEvent.click(screen.getByRole('button', { name: /use template/i }));
    await userEvent.click(screen.getByRole('button', { name: /replace and continue/i }));
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('shows the AI panel with a CTA button', async () => {
    renderHome();
    expect((await screen.findAllByText('Or start with AI')).length).toBeGreaterThanOrEqual(1);
  });

  it('shows recent courses from storage', async () => {
    localStorage.setItem(
      'openedu.studio.recent',
      JSON.stringify([
        { id: 'a', title: 'My Course', packageDir: '/tmp/a', updatedAt: Date.now() },
      ]),
    );
    renderHome();
    expect(await screen.findByText('My Course')).toBeInTheDocument();
  });

  it('shows empty recent with description when no courses', async () => {
    renderHome();
    expect(await screen.findByText('No recent courses yet.')).toBeInTheDocument();
    expect(
      await screen.findByText('Start from a template or import a course folder to see it here.'),
    ).toBeInTheDocument();
  });

  it('opens a recent course via Open button', async () => {
    const onOpened = vi.fn();
    localStorage.setItem(
      'openedu.studio.recent',
      JSON.stringify([
        { id: 'a', title: 'My Course', packageDir: '/tmp/a', updatedAt: Date.now() },
      ]),
    );
    renderHome({ onOpened });
    const list = screen.getByRole('list');
    await userEvent.click(within(list).getByRole('button', { name: /open/i }));
    expect(onOpened).toHaveBeenCalled();
  });

  it('shows an Open this course CTA for the loaded package', async () => {
    const onOpenCurrent = vi.fn();
    renderHome({ courseTitle: 'Fractions', onOpenCurrent });
    expect(screen.getByText('Fractions')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open this course/i }));
    expect(onOpenCurrent).toHaveBeenCalled();
  });

  it('calls onOpenLibrary when the My courses button is clicked', async () => {
    const onOpenLibrary = vi.fn();
    renderHome({ onOpenLibrary });
    await userEvent.click(await screen.findByRole('button', { name: /my courses/i }));
    expect(onOpenLibrary).toHaveBeenCalled();
  });
});
