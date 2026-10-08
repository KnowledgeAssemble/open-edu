import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { OutlineWorkspace } from './OutlineWorkspace.js';
import type { StudioApi } from '../studioApi.js';
import type { ActivitySummary } from '../types.js';
import type { OutlineTab } from '../studioSession.js';
import type { PackageSourcePaneHandle } from './PackageSourcePane.js';

const { mockAssistantContext } = vi.hoisted(() => ({
  mockAssistantContext: { panelOpen: false, openWithPreset: vi.fn(), enabled: true },
}));

vi.mock('../ai', () => ({
  useStudioAssistant: () => mockAssistantContext,
}));

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

function Controlled({
  initial,
  onDirtyChange,
}: {
  initial: OutlineTab;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [tab, setTab] = useState<OutlineTab>(initial);
  return (
    <OutlineWorkspace
      api={makeApi()}
      onEdit={() => {}}
      onError={() => {}}
      filesDirty={false}
      onDirtyChange={onDirtyChange ?? (() => {})}
      tab={tab}
      onTabChange={setTab}
      paneRef={{ current: null } as React.RefObject<PackageSourcePaneHandle>}
    />
  );
}

const sampleActivities: ActivitySummary[] = [
  { id: 'nodes/a.md', path: 'nodes/a.md', title: 'Intro', kind: 'lesson' },
];

const validLesson = '# Fractions\n\nHello';

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    getPackageDir: vi.fn().mockResolvedValue('/pkg'),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    getOutline: vi.fn().mockResolvedValue({ activities: sampleActivities, title: 'Test' }),
    saveOutlineOrder: vi.fn().mockResolvedValue({ success: true }),
    applyTemplate: vi.fn(),
    exportOep: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([
      { path: 'package.json', label: 'package.json', category: 'manifest', extension: '.json' },
      { path: 'nodes/a.md', label: 'a.md', category: 'nodes', extension: '.md' },
    ]),
    createFile: vi.fn().mockResolvedValue({ success: true, path: 'nodes/new.md' }),
    renameFile: vi.fn().mockResolvedValue({ success: true, oldPath: 'a', newPath: 'b' }),
    uploadAsset: vi.fn().mockResolvedValue({ success: true, path: 'assets/x.png' }),
    readFile: vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve({ path, content: path.endsWith('.json') ? '{}' : validLesson }),
      ),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    deleteFile: vi.fn().mockResolvedValue({ success: true, path: 'nodes/a.md' }),
    getAiStatus: vi.fn().mockResolvedValue({ available: true }),
    generateItemAdd: vi.fn(),
    ...overrides,
  } as unknown as StudioApi;
}

describe('OutlineWorkspace', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to the Outline tab', async () => {
    render(wrap(<Controlled initial="outline" />));
    expect(await screen.findByText('Intro')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Outline' })).toHaveAttribute('data-state', 'active');
  });

  it('switches to Files and lists the package tree', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    render(wrap(<Controlled initial="outline" onDirtyChange={onDirtyChange} />));
    await screen.findByText('Intro');
    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await waitFor(() => {
      expect(screen.getAllByText('a.md').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveAttribute('data-state', 'active');
  });

  it('retains both tab triggers on the outline page', async () => {
    render(wrap(<Controlled initial="outline" />));
    await screen.findByText('Intro');
    expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument();
  });

  it('shows a Packs tab that renders the pack browser panel', async () => {
    const user = userEvent.setup();
    render(wrap(<Controlled initial="outline" />));
    await screen.findByText('Intro');
    const packsTab = screen.getByRole('tab', { name: 'Packs' });
    expect(packsTab).toBeInTheDocument();
    await user.click(packsTab);
    expect((await screen.findAllByText('No concepts in scope.')).length).toBeGreaterThan(0);
  });
});
