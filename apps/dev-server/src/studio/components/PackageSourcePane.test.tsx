import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@open-edu/i18n';
import studioEn from '@open-edu/i18n/locales/en/studio.json';
import { PackageSourcePane } from './PackageSourcePane';
import type { StudioApi } from '../studioApi';

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider locale="en" dictionaries={{ en: { studio: studioEn as Record<string, string> } }}>
      {ui}
    </I18nProvider>
  );
}

const files = [
  { path: 'package.json', label: 'package.json', category: 'manifest', extension: '.json' },
  { path: 'nodes/a.md', label: 'a.md', category: 'nodes', extension: '.md' },
];

function makeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    listFiles: vi.fn().mockResolvedValue(files),
    createFile: vi.fn().mockResolvedValue({ success: true, path: 'nodes/new.md' }),
    renameFile: vi.fn().mockResolvedValue({ success: true, oldPath: 'a', newPath: 'b' }),
    uploadAsset: vi.fn().mockResolvedValue({ success: true, path: 'assets/x.png' }),
    getPackageDir: vi.fn().mockResolvedValue('/pkg'),
    readFile: vi.fn().mockImplementation(async (path: string) => {
      const found = files.find((f) => f.path === path);
      return { path, content: found?.path.endsWith('.json') ? '{}' : '# Hello' };
    }),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    deleteFile: vi.fn().mockResolvedValue({ success: true, path: 'nodes/a.md' }),
    ...overrides,
  } as unknown as StudioApi;
}

describe('PackageSourcePane', () => {
  it('renders a tree and the default file', async () => {
    const api = makeApi();
    render(wrap(<PackageSourcePane api={api} />));
    expect((await screen.findAllByText('package.json')).length).toBeGreaterThan(0);
    expect(screen.getByText('a.md')).toBeInTheDocument();
  });

  it('does not render the Edit Package or Done Editing chrome', async () => {
    const api = makeApi();
    render(wrap(<PackageSourcePane api={api} />));
    await screen.findAllByText('package.json');
    expect(screen.queryByText(/edit package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/done editing/i)).not.toBeInTheDocument();
  });

  it('calls onOpenActivity when opening a node as an activity', async () => {
    const api = makeApi();
    const onOpenActivity = vi.fn();
    render(
      wrap(
        <PackageSourcePane api={api} initialPath="nodes/a.md" onOpenActivity={onOpenActivity} />,
      ),
    );
    const button = await screen.findByRole('button', { name: /open as activity/i });
    fireEvent.click(button);
    await waitFor(() => expect(onOpenActivity).toHaveBeenCalledWith('nodes/a.md'));
  });
});
