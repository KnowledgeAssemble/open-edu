import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@open-edu/i18n';
import runtimeDict from '@open-edu/i18n/locales/en/runtime.json';
import studioDict from '@open-edu/i18n/locales/en/studio.json';
import type { LoadedBundle, LoadedPackage } from '@open-edu/core';

const mockModule: LoadedPackage = {
  rootDir: '/test-bundle/mod-a',
  manifest: {
    id: 'mod-a',
    title: 'Module A',
    version: '1.0.0',
    author: 'Test',
    entry: 'nodes/a.md',
  },
  workflow: { routing: { 'nodes/a.md': { onComplete: 'COMPLETED' } } },
  nodes: [
    {
      path: '/test-bundle/nodes/a.md',
      relativePath: 'nodes/a.md',
      content: '# A',
      node: { type: 'lesson' },
    },
  ],
  rewards: null,
  cards: null,
  assetPaths: [],
};

const mockBundle: LoadedBundle = {
  rootDir: '/test-bundle',
  manifest: {
    type: 'bundle',
    id: 'test-bundle',
    title: 'Test Bundle',
    version: '1.0.0',
    author: 'Test',
    modules: [{ path: 'mod-a', id: 'mod-a', title: 'Module A', chapterCode: 'M1', dependsOn: [] }],
  },
  moduleMap: new Map([['mod-a', mockModule]]),
  modules: [mockModule],
  rewards: null,
  cards: null,
};

vi.mock('virtual:open-edu-package', () => ({
  packageData: null,
  bundleData: {
    ...mockBundle,
    moduleMap: [['mod-a', mockModule]] as unknown as Map<string, unknown>,
  },
}));

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

const { DevApp } = await import('./DevApp');

function renderWithI18n() {
  return render(
    <I18nProvider dictionaries={{ en: { runtime: runtimeDict, studio: studioDict } }}>
      <DevApp />
    </I18nProvider>,
  );
}

describe('DevApp bundle mode', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows the Studio bundle unsupported empty state without a mode switch', async () => {
    renderWithI18n();
    expect(await screen.findByText('OpenEdu Studio')).toBeInTheDocument();
    expect(await screen.findByText('Bundles are not supported yet')).toBeInTheDocument();
    expect(screen.queryByText('Reading lesson')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /studio mode/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Preview DevTools' }),
    ).not.toBeInTheDocument();
  });
});
