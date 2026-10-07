import { useEffect } from 'react';
import { RuntimeThemeProvider, useThemePreference } from '@open-edu/runtime';
import type { ThemeId } from '@open-edu/runtime';
import type { LoadedPackage, LoadedBundle } from '@open-edu/core';
import { StudioApp } from './studio/StudioApp.js';
import './studio/browserPreview.js';
import { OPFSWorkspace } from '@open-edu/storage';
import { BrowserStudioProvider, useBrowserStudio } from './studio/browserPreview.js';
import { useTranslation } from '@open-edu/i18n';

import {
  packageData as rawPackageData,
  bundleData as rawBundleData,
} from 'virtual:open-edu-package';

const loadedPkg = rawPackageData as LoadedPackage | null;
const loadedBundle = rawBundleData
  ? ({
      ...rawBundleData,
      moduleMap: new Map((rawBundleData as any).moduleMap as [string, any][]),
    } as LoadedBundle)
  : null;

function BrowserStudioApp({
  themeId,
  onThemeChange,
}: {
  themeId: ThemeId;
  onThemeChange: (id: ThemeId) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { api, loadedPackage, isLoading, storageStatus } = useBrowserStudio();

  if (isLoading && !loadedPackage) {
    return (
      <div className="bg-surface flex h-screen items-center justify-center" role="status">
        <p className="text-on-surface-variant text-sm">{t('studio.browser.loadingCourses')}</p>
      </div>
    );
  }

  const storageNotice = storageStatus.available
    ? t('studio.browser.storageNotice')
    : storageStatus.reason === 'quota-exceeded'
      ? t('studio.browser.storageQuotaExceeded')
      : t('studio.browser.storageUnavailable');

  return (
    <StudioApp
      loadedPackage={loadedPackage}
      api={api}
      storageNotice={storageNotice}
      browserMode
      themeId={themeId}
      onThemeChange={onThemeChange}
    />
  );
}

export function DevApp(): JSX.Element {
  const [themeId, setThemeId] = useThemePreference();

  const isBrowserMode = import.meta.env.VITE_OPEN_EDU_BROWSER === '1';

  // Expose the workspace adapter on the browser build so Playwright can drive a
  // real OPFSWorkspace round-trip (tests/e2e/opfs-workspace.spec.ts). Harmless
  // outside tests; production behavior is unaffected.
  useEffect(() => {
    if (isBrowserMode) {
      (window as unknown as Record<string, unknown>).__openeduWorkspace = { OPFSWorkspace };
    }
  }, [isBrowserMode]);

  if (isBrowserMode) {
    return (
      <RuntimeThemeProvider themeId={themeId}>
        <BrowserStudioProvider>
          <BrowserStudioApp themeId={themeId} onThemeChange={setThemeId} />
        </BrowserStudioProvider>
      </RuntimeThemeProvider>
    );
  }

  return (
    <RuntimeThemeProvider themeId={themeId}>
      <StudioApp
        loadedPackage={loadedPkg}
        bundleUnsupported={Boolean(loadedBundle)}
        themeId={themeId}
        onThemeChange={setThemeId}
      />
    </RuntimeThemeProvider>
  );
}
