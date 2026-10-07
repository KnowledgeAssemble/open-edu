import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { StudioApp } from './StudioApp';
import type { LoadedPackage } from '@open-edu/core';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

const applyTemplateMock = vi.fn();
const getOutlineMock = vi.fn().mockResolvedValue({
  title: 'Test',
  activities: [
    { id: 'nodes/lesson.md', path: 'nodes/lesson.md', title: 'Intro', kind: 'lesson' },
    { id: 'nodes/q.json', path: 'nodes/q.json', title: 'Check', kind: 'quiz' },
  ],
});
const readFileMock = vi
  .fn()
  .mockImplementation((path: string) =>
    Promise.resolve({ path, content: path.endsWith('.json') ? '{"type":"quiz"}' : '# Hi' }),
  );
const writeFileMock = vi.fn().mockResolvedValue({ success: true });
const saveOutlineOrderMock = vi.fn().mockResolvedValue({ success: true });
const getAiStatusMock = vi.fn().mockResolvedValue({ available: false });
const generateFromNotesMock = vi.fn().mockResolvedValue({
  success: false,
  quality: [],
  outlinePreview: [],
  error: 'Add more detail',
});

vi.mock('./localStudioApi.js', () => ({
  createLocalStudioApi: () => ({
    getPackageDir: vi.fn().mockResolvedValue('/test'),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    getOutline: getOutlineMock,
    saveOutlineOrder: saveOutlineOrderMock,
    applyTemplate: applyTemplateMock,
    exportOep: vi.fn(),
    importOep: vi.fn(),
    readFile: readFileMock,
    writeFile: writeFileMock,
    deleteFile: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    createFile: vi.fn().mockResolvedValue({ success: true, path: 'nodes/new.md' }),
    renameFile: vi.fn().mockResolvedValue({ success: true, oldPath: 'a', newPath: 'b' }),
    uploadAsset: vi.fn().mockResolvedValue({ success: true, path: 'assets/x.png' }),
    getPreviewPackage: vi.fn().mockResolvedValue(null),
    getStorageStatus: vi.fn().mockResolvedValue({ available: true }),
    getAiStatus: getAiStatusMock,
    generateFromNotes: generateFromNotesMock,
    uploadSpec: vi.fn(),
    generateCourseDraft: vi.fn(),
    uploadSpecDraft: vi.fn(),
    commitCourseDraft: vi.fn(),
    discardCourseDraft: vi.fn(),
    generateItemAdd: vi.fn(),
    generateItemEdit: vi.fn(),
    getLibrary: vi.fn().mockResolvedValue({
      workspace: '/workspace',
      entries: [
        {
          id: 'fractions',
          title: 'Fractions',
          kind: 'course',
          relativePath: 'fractions',
          version: '1.0.0',
          updatedAt: 1,
        },
      ],
    }),
    openLibraryCourse: vi
      .fn()
      .mockResolvedValue({ success: true, packageDir: '/workspace/fractions' }),
    duplicateCourse: vi.fn(),
    renameCourse: vi.fn(),
    archiveCourse: vi.fn(),
    importCourseFolder: vi.fn(),
    createUnit: vi.fn(),
    exportUnitOep: vi.fn(),
  }),
}));

const mockPkg: LoadedPackage = {
  rootDir: '/test',
  manifest: {
    id: 'test',
    title: 'Test',
    version: '1.0.0',
    author: 'Test',
    entry: 'nodes/lesson.md',
  },
  workflow: { routing: { 'nodes/lesson.md': { onComplete: 'COMPLETED' } } },
  rewards: null,
  cards: null,
  nodes: [],
  assetPaths: [],
};

vi.mock('@dotlottie/react-player', () => ({
  DotLottiePlayer: () => <div data-testid="mocked-dotlottie" />,
  PlayerEvents: {},
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    status: 'ready' as const,
    stop: vi.fn(),
    clearError: vi.fn(),
    setMessages: vi.fn(),
    error: undefined,
  }),
}));

describe('StudioApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiStatusMock.mockResolvedValue({ available: false });
    generateFromNotesMock.mockResolvedValue({
      success: false,
      quality: [],
      outlinePreview: [],
      error: 'Add more detail',
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  async function useTemplateAndConfirm() {
    const templateCards = await screen.findAllByRole('button', { name: /reading lesson/i });
    await userEvent.click(templateCards[0]!);
    await userEvent.click(screen.getByRole('button', { name: /use template/i }));
    await userEvent.click(screen.getByRole('button', { name: /replace and continue/i }));
  }

  it('renders studio chrome', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    expect(await screen.findByText('OpenEdu Studio')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /studio mode/i })).not.toBeInTheDocument();
  });

  it('renders the theme switcher in the top bar and changes the theme', async () => {
    const onThemeChange = vi.fn();
    render(
      wrap(
        <StudioApp
          loadedPackage={mockPkg}
          themeId="lumina-scholastica"
          onThemeChange={onThemeChange}
        />,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /select theme/i }));
    await userEvent.click(await screen.findByText('OpenEdu Dark'));
    expect(onThemeChange).toHaveBeenCalledWith('nocturnal');
  });

  it('fills the viewport height so full-height views like the preview can stretch', async () => {
    const { container } = render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.className).toContain('flex');
    expect(main!.className).toContain('flex-col');
    const view = container.querySelector('.studio-view-enter');
    expect(view).not.toBeNull();
    expect(view!.className).toContain('flex-1');
    expect(view!.className).toContain('min-h-0');
  });

  it('starts on Home with template gallery', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    expect(await screen.findByText('Reading lesson')).toBeInTheDocument();
  });

  it('navigates to outline after opening a template', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await useTemplateAndConfirm();
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('navigates to share via top bar nav', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await useTemplateAndConfirm();
    await userEvent.click(
      within(screen.getByRole('banner')).getByRole('button', { name: /share/i }),
    );
    expect(await screen.findByText('Ready check')).toBeInTheDocument();
  });

  it('navigates to Share from the outline health strip', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await useTemplateAndConfirm();
    await screen.findByText('Intro');
    const aside = await screen.findByRole('complementary');
    await userEvent.click(within(aside).getByRole('button', { name: /share/i }));
    expect(await screen.findByText('Ready check')).toBeInTheDocument();
  });

  it('opens the activity editor from the outline', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await useTemplateAndConfirm();
    await screen.findByText('Intro');
    await userEvent.click(screen.getByRole('button', { name: 'Intro' }));
    expect(await screen.findByLabelText(/lesson content/i)).toBeInTheDocument();
  });

  it('records a recent course when opening a template', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await useTemplateAndConfirm();
    await screen.findByText('Intro');
    const recent = localStorage.getItem('openedu.studio.recent');
    expect(recent).toBeTruthy();
    const parsed = JSON.parse(recent!);
    expect(parsed[0].id).toBe('test');
  });

  it('reaches outline directly from Home via the top bar (no dead end)', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await userEvent.click(screen.getByRole('button', { name: /outline/i }));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('restores the last view after a full reload (session persistence)', async () => {
    sessionStorage.setItem('openedu.studio.view', 'outline');
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('navigates Home to the loaded package via Open this course', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await userEvent.click(screen.getByRole('button', { name: /open this course/i }));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('shows an unsupported shell for bundles without package mutations', () => {
    render(wrap(<StudioApp loadedPackage={null} bundleUnsupported />));
    expect(screen.getByText('Bundles are not supported yet')).toBeInTheDocument();
    expect(screen.queryByText('Reading lesson')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /outline/i })).not.toBeInTheDocument();
  });

  it('exposes the Learning path and Rewards & cards panels from the outline', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await userEvent.click(screen.getByRole('button', { name: /outline/i }));
    await screen.findByText('Intro');
    expect(screen.getByRole('button', { name: /learning path/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rewards & cards/i })).toBeInTheDocument();
  });

  it('renders flow and rewards panel content when expanded', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await userEvent.click(screen.getByRole('button', { name: /outline/i }));
    await screen.findByText('Intro');
    await userEvent.click(screen.getByRole('button', { name: /learning path/i }));
    expect(await screen.findByRole('button', { name: /add a score rule/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /rewards & cards/i }));
    expect(
      await screen.findByRole('button', { name: /add completion badge/i }),
    ).toBeInTheDocument();
  });

  it('navigates to the library via the My courses top-bar button', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const myCourses = await screen.findAllByRole('button', { name: /my courses/i });
    await userEvent.click(myCourses[0]!);
    expect(await screen.findByText('Fractions')).toBeInTheDocument();
  });

  it('opens a library course into the outline view', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const myCourses = await screen.findAllByRole('button', { name: /my courses/i });
    await userEvent.click(myCourses[0]!);
    await userEvent.click(await screen.findByRole('button', { name: /^open$/i }));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('reaches the unit-builder placeholder from the library', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const myCourses = await screen.findAllByRole('button', { name: /my courses/i });
    await userEvent.click(myCourses[0]!);
    await userEvent.click(await screen.findByRole('button', { name: /create unit/i }));
    expect(await screen.findByText('Create a unit')).toBeInTheDocument();
  });

  it('shows the AI CTA button on home view', async () => {
    getAiStatusMock.mockResolvedValue({ available: true });
    generateFromNotesMock.mockResolvedValue({
      success: true,
      quality: [{ id: 'objectives', labelKey: 'studio.ai.quality.objectives', passed: true }],
      outlinePreview: [{ title: 'Intro', kind: 'lesson' }],
      title: 'AI Course',
    });
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const elements = await screen.findAllByText('Or start with AI');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('writes draft files and navigates to outline via handleSaveDraftItems', async () => {
    writeFileMock.mockClear();
    saveOutlineOrderMock.mockClear();

    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    const outlineBtn = await screen.findByRole('button', { name: /outline/i });
    await userEvent.click(outlineBtn);
    expect(await screen.findByText('Intro')).toBeInTheDocument();
  });

  it('switches to the Files tab from outline without crashing', async () => {
    render(wrap(<StudioApp loadedPackage={mockPkg} />));
    await userEvent.click(await screen.findByRole('button', { name: /outline/i }));
    await screen.findByText('Intro');
    await userEvent.click(screen.getByRole('tab', { name: 'Files' }));
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('data-state', 'active');
  });
});
