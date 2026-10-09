declare module 'virtual:open-edu-package' {
  import type { LoadedPackage, LoadedBundle } from '@open-edu/core';
  export const packageData: LoadedPackage | null;
  export const bundleData: LoadedBundle | null;
}

declare module 'virtual:open-edu-packs' {
  import type { LoadedPack } from '@open-edu/packs';
  export const packData: LoadedPack[] | null;
}

declare const OPEN_EDU_STUDIO_ASSISTANT: string | undefined;

interface ImportMetaEnv {
  readonly VITE_OPEN_EDU_BROWSER?: string;
  readonly SSR?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
