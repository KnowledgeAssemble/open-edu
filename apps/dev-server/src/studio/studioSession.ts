import type { StudioView } from './types.js';

const VIEW_KEY = 'openedu.studio.view';
const PATH_KEY = 'openedu.studio.selectedPath';
const OUTLINE_TAB_KEY = 'openedu.studio.outlineTab';
const FILES_PATH_KEY = 'openedu.studio.filesPath';

export type OutlineTab = 'outline' | 'files' | 'packs';

const VALID_VIEWS: StudioView[] = [
  'home',
  'outline',
  'edit-activity',
  'preview',
  'share',
  'library',
  'unit-builder',
];

export function readStudioView(): StudioView {
  try {
    const value = sessionStorage.getItem(VIEW_KEY);
    return value && (VALID_VIEWS as string[]).includes(value) ? (value as StudioView) : 'home';
  } catch {
    return 'home';
  }
}

export function writeStudioView(view: StudioView): void {
  try {
    sessionStorage.setItem(VIEW_KEY, view);
  } catch {
    // storage unavailable
  }
}

export function readSelectedPath(): string | null {
  try {
    return sessionStorage.getItem(PATH_KEY);
  } catch {
    return null;
  }
}

export function writeSelectedPath(path: string | null): void {
  try {
    if (path === null) {
      sessionStorage.removeItem(PATH_KEY);
      return;
    }
    sessionStorage.setItem(PATH_KEY, path);
  } catch {
    // storage unavailable
  }
}

const VALID_OUTLINE_TABS: OutlineTab[] = ['outline', 'files', 'packs'];

export function readOutlineTab(): OutlineTab {
  try {
    const value = sessionStorage.getItem(OUTLINE_TAB_KEY);
    return value && (VALID_OUTLINE_TABS as string[]).includes(value)
      ? (value as OutlineTab)
      : 'outline';
  } catch {
    return 'outline';
  }
}

export function writeOutlineTab(tab: OutlineTab): void {
  try {
    sessionStorage.setItem(OUTLINE_TAB_KEY, tab);
  } catch {
    // storage unavailable
  }
}

export function readFilesPath(): string | null {
  try {
    return sessionStorage.getItem(FILES_PATH_KEY);
  } catch {
    return null;
  }
}

export function writeFilesPath(path: string | null): void {
  try {
    if (path === null) {
      sessionStorage.removeItem(FILES_PATH_KEY);
      return;
    }
    sessionStorage.setItem(FILES_PATH_KEY, path);
  } catch {
    // storage unavailable
  }
}
