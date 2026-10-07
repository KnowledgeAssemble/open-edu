import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { StudioApi } from '../studioApi';
import { EditorShell, type EditorShellHandle } from '../../editor/EditorShell';
import type { PackageFileApi } from '../../editor/types';

export interface PackageSourcePaneHandle {
  isDirty: () => boolean;
  save: () => Promise<void>;
}

export interface PackageSourcePaneProps {
  api: StudioApi;
  initialPath?: string | null;
  onOpenActivity?: (path: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onTreeChanged?: () => void;
  onSelectPath?: (path: string) => void;
}

export const PackageSourcePane = forwardRef<PackageSourcePaneHandle, PackageSourcePaneProps>(
  function PackageSourcePane(
    { api, initialPath, onOpenActivity, onDirtyChange, onTreeChanged, onSelectPath },
    ref,
  ) {
    const shellRef = useRef<EditorShellHandle>(null);

    useImperativeHandle(ref, () => ({
      isDirty: () => (shellRef.current?.dirtyCount ?? 0) > 0,
      save: () => shellRef.current?.save() ?? Promise.resolve(),
    }));

    const fileApi = useMemo<PackageFileApi>(
      () => ({
        listFiles: () => api.listFiles(),
        getPackageDir: () => api.getPackageDir(),
        readFile: (path) => api.readFile(path),
        writeFile: (path, content) => api.writeFile(path, content),
        deleteFile: (path) => api.deleteFile(path),
        renameFile: (oldPath, newPath) => api.renameFile(oldPath, newPath),
        createFile: (path, content) => api.createFile(path, content),
        uploadAsset: (file, path) => api.uploadAsset(file, path),
      }),
      [api],
    );

    return (
      <EditorShell
        ref={shellRef}
        variant="embedded"
        fileApi={fileApi}
        initialPath={initialPath}
        onOpenActivity={onOpenActivity}
        onDirtyChange={onDirtyChange}
        onTreeChanged={onTreeChanged}
        onSelectPath={onSelectPath}
        isOpen
        onToggle={() => {}}
        mode="edit"
        onModeChange={() => {}}
      />
    );
  },
);
