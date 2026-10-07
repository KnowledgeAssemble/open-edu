import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import type { LoadedPackage } from '@open-edu/core';
import { I18nProvider } from '@open-edu/i18n';
import runtimeDict from '@open-edu/i18n/locales/en/runtime.json';
import studioDict from '@open-edu/i18n/locales/en/studio.json';
import { createRewardReceiptBridge } from './createRewardReceiptBridge.js';

function renderWithI18n() {
  return render(
    <I18nProvider dictionaries={{ en: { runtime: runtimeDict, studio: studioDict } }}>
      <DevApp />
    </I18nProvider>,
  );
}

const mockPackageData: LoadedPackage = {
  rootDir: '/test',
  manifest: {
    id: 'test',
    title: 'Test Package',
    version: '1.0.0',
    author: 'Test',
    entry: 'nodes/lesson.md',
  },
  workflow: {
    routing: {
      'nodes/lesson.md': { onComplete: 'COMPLETED' },
    },
  },
  rewards: {
    triggers: [
      {
        onEvent: 'node_complete',
        rewards: [{ action: 'badge.award', badge: 'First Steps' }],
      },
    ],
  },
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

vi.mock('virtual:open-edu-package', () => ({
  packageData: mockPackageData,
  bundleData: null,
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

describe('DevApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the Studio chrome and no DevTools on first paint', async () => {
    renderWithI18n();
    expect(await screen.findByText('OpenEdu Studio')).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Preview DevTools' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /studio mode/i })).not.toBeInTheDocument();
  });

  it('does not render a studio mode toggle', async () => {
    renderWithI18n();
    await screen.findByText('OpenEdu Studio');
    expect(screen.queryByRole('switch', { name: /studio mode/i })).not.toBeInTheDocument();
  });
});

describe('DevApp reward overlay wiring', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('composes createRewardReceiptBridge and RewardEventBridge in the preview', () => {
    const src = fs.readFileSync(path.resolve(__dirname, './studio/CreatorPreview.tsx'), 'utf8');
    expect(src).toContain('createRewardReceiptBridge');
    expect(src).toContain('RewardEventBridge');
    expect(createRewardReceiptBridge).toBeTypeOf('function');
  });
});
