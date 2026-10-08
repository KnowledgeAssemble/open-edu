import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { LibraryView } from './LibraryView';
import { UnitBuilderView } from './UnitBuilderView';
import { ImportCourseDialog } from './ImportCourseDialog';
import { ShareView } from './ShareView';
import { StudioChrome } from './StudioChrome';
import { HomeView } from './HomeView';
import { OutlineView } from './OutlineView';
import { OutlineWorkspace } from './OutlineWorkspace';
import type { PackageSourcePaneHandle } from './PackageSourcePane';
import type { OutlineTab } from '../studioSession.js';
import { CreatorPreview } from '../CreatorPreview';
import type { StudioApi } from '../studioApi.js';
import type { LibraryEntry } from '../library/types.js';
import type { LoadedPackage } from '@open-edu/core';

(globalThis as { axe?: typeof axe }).axe = axe;

const mockAssistantContext = {
  panelOpen: false,
  setPanelOpen: vi.fn(),
  panelWidth: 320,
  setPanelWidth: vi.fn(),
  context: null,
  setContext: vi.fn(),
  enabled: true,
  setEnabled: vi.fn(),
  pendingDrafts: null,
  setPendingDrafts: vi.fn(),
  openWithPreset: vi.fn(),
  ephemeralSuggestions: null,
  setEphemeralSuggestions: vi.fn(),
  lastCourseQuality: null,
  setLastCourseQuality: vi.fn(),
};

vi.mock('../ai', () => ({
  useStudioAssistant: () => mockAssistantContext,
}));

vi.mock('../ai/StudioAssistantProvider', () => ({
  useStudioAssistant: () => mockAssistantContext,
  StudioAssistantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const courseEntry: LibraryEntry = {
  id: 'fractions',
  title: 'Fractions',
  kind: 'course',
  relativePath: 'fractions',
  version: '1.0.0',
  updatedAt: 100,
};

const unitEntry: LibraryEntry = {
  id: 'numbers-unit',
  title: 'Numbers unit',
  kind: 'unit',
  relativePath: 'units/numbers-unit',
  version: '1.0.0',
  updatedAt: 200,
};

const validLesson = '# Fractions\n\nHello';
const validQuiz = JSON.stringify({
  type: 'quiz',
  question: 'Q?',
  options: [
    { id: 'a', text: 'A', correct: true },
    { id: 'b', text: 'B', correct: false },
  ],
});

vi.mock('@dotlottie/react-player', () => ({
  DotLottiePlayer: () => <div data-testid="mocked-dotlottie" />,
  PlayerEvents: {},
}));

const previewPkg: LoadedPackage = {
  rootDir: '/test',
  manifest: {
    id: 'test',
    title: 'Test',
    version: '1.0.0',
    author: 'Test',
    entry: 'nodes/lesson.md',
  },
  workflow: {
    routing: { 'nodes/lesson.md': { onComplete: 'COMPLETED' } },
  },
  rewards: null,
  cards: null,
  nodes: [
    {
      path: '/test/nodes/lesson.md',
      relativePath: 'nodes/lesson.md',
      content: '# Hello\nWorld',
      node: { type: 'lesson' },
    },
  ],
  assetPaths: [],
};

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

function ControlledWorkspace({ api }: { api: StudioApi }) {
  const [tab, setTab] = useState<OutlineTab>('outline');
  return (
    <OutlineWorkspace
      api={api}
      onEdit={() => {}}
      onError={() => {}}
      filesDirty={false}
      onDirtyChange={() => {}}
      tab={tab}
      onTabChange={setTab}
      paneRef={{ current: null } as React.RefObject<PackageSourcePaneHandle>}
    />
  );
}

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn(),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    getOutline: vi.fn().mockResolvedValue({
      title: 'Fractions',
      activities: [
        { id: 'nodes/lesson.md', path: 'nodes/lesson.md', title: 'Lesson', kind: 'lesson' },
        { id: 'nodes/q.json', path: 'nodes/q.json', title: 'Quiz', kind: 'quiz' },
      ],
    }),
    saveOutlineOrder: vi.fn(),
    applyTemplate: vi.fn(),
    exportOep: vi
      .fn()
      .mockResolvedValue({ blob: new Blob(['x']), fileName: 'fractions-1.0.0.oep' }),
    readFile: vi.fn().mockImplementation((path: string) =>
      Promise.resolve({
        path,
        content: path.endsWith('.json') ? validQuiz : validLesson,
      }),
    ),
    writeFile: vi.fn(),
    getAiStatus: vi.fn(),
    generateFromNotes: vi.fn(),
    getLibrary: vi
      .fn()
      .mockResolvedValue({ workspace: '/workspace', entries: [courseEntry, unitEntry] }),
    openLibraryCourse: vi.fn(),
    duplicateCourse: vi.fn(),
    renameCourse: vi.fn(),
    archiveCourse: vi.fn(),
    importCourseFolder: vi.fn(),
    createUnit: vi.fn(),
    exportUnitOep: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    createFile: vi.fn(),
    renameFile: vi.fn(),
    uploadAsset: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

async function runAxe(container: HTMLElement, extraRules?: Record<string, { enabled: boolean }>) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      ...extraRules,
    },
  });
  return results.violations;
}

describe('axe-core accessibility audits for studio components', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:url');
    URL.revokeObjectURL = vi.fn();
  });

  it('LibraryView is accessible with course and unit rows', async () => {
    const { container } = render(
      wrap(
        <LibraryView
          api={makeApi()}
          onOpen={() => {}}
          onCreateUnit={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await screen.findByText('Numbers unit');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('UnitBuilderView is accessible with selectable courses', async () => {
    const { container } = render(
      wrap(<UnitBuilderView api={makeApi()} onCreated={() => {}} onError={() => {}} />),
    );
    await screen.findByText('Fractions');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('ImportCourseDialog is accessible when open', async () => {
    render(
      wrap(
        <ImportCourseDialog
          api={makeApi()}
          open
          onOpenChange={() => {}}
          onImported={() => {}}
          onError={() => {}}
        />,
      ),
    );
    await screen.findByText('Import a course folder');
    const violations = await runAxe(document.body);
    expect(violations).toEqual([]);
  });

  it('ShareView is accessible including the share kit after export', async () => {
    const user = userEvent.setup();
    const { container } = render(wrap(<ShareView api={makeApi()} onError={() => {}} />));
    const exportButton = await screen.findByRole('button', { name: /export \.oep file/i });
    await user.click(exportButton);
    await screen.findByText('Share kit');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('StudioChrome is accessible on outline view', async () => {
    const { container } = render(
      wrap(<StudioChrome onNavigate={() => {}} courseTitle="Test Course" view="outline" />),
    );
    await screen.findByText('OpenEdu Studio');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('HomeView is accessible with template gallery and AI start panel', async () => {
    const { container } = render(
      wrap(
        <HomeView
          api={makeApi({ getAiStatus: vi.fn().mockResolvedValue({ available: false }) })}
          onOpened={() => {}}
          onError={() => {}}
          courseTitle="Fractions"
          onOpenCurrent={() => {}}
          onOpenLibrary={() => {}}
        />,
      ),
    );
    await screen.findByText('Reading lesson');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('OutlineView is accessible with a lesson row and advanced panels', async () => {
    const { container } = render(
      wrap(<OutlineView api={makeApi()} onEdit={() => {}} onError={() => {}} />),
    );
    await screen.findByRole('list');
    const violations = await runAxe(container, { 'heading-order': { enabled: false } });
    expect(violations).toEqual([]);
  });

  it('OutlineWorkspace is accessible with the Files tab selected', async () => {
    const { container } = render(
      wrap(<ControlledWorkspace api={makeApi({ listFiles: vi.fn().mockResolvedValue([]) })} />),
    );
    await screen.findAllByText('Lesson');
    await userEvent.click(screen.getByRole('tab', { name: 'Files' }));
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('data-state', 'active');
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });

  it('CreatorPreview is accessible with the DevTools drawer open', async () => {
    const { container } = render(wrap(<CreatorPreview pkg={previewPkg} />));
    await userEvent.click(await screen.findByRole('button', { name: 'Open DevTools' }));
    await screen.findByRole('complementary', { name: 'Preview DevTools' });
    const violations = await runAxe(container);
    expect(violations).toEqual([]);
  });
});
