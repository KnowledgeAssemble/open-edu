import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import * as api from './api';
import { CONFIG_TEMPLATES } from './api';
import { useTranslation } from '@open-edu/i18n';
import type {
  FileEntry,
  EditorFile,
  EditorMode,
  ViewMode,
  ContextMenuTarget,
  PackageFileApi,
} from './types';
import type { ValidationError } from './WidgetValidator';
import { FileTree } from './FileTree';
import { ManifestEditor } from './ManifestEditor';
import { MarkdownEditor } from './MarkdownEditor';
import { JSONNodeEditor } from './JSONNodeEditor';
import { WorkflowEditor } from './WorkflowEditor';
import { RewardsEditor } from './RewardsEditor';
import { CardsEditor } from './CardsEditor';
import { AssetManager } from './AssetManager';
import { RawJsonEditor } from './RawJsonEditor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Toaster,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@open-edu/design-system';
import { toast } from 'sonner';
import { Plus, Eye, FileText, EyeOff, Pencil, Trash2, Upload } from 'lucide-react';
import { SplitPaneLayout } from './SplitPaneLayout';
import { WidgetPreviewPanel } from './WidgetPreviewPanel';
import { useWidgetConfig } from './hooks/useWidgetConfig';
import { validateWidgetConfigForType } from './WidgetValidator';

const NODE_TYPES = ['lesson', 'quiz', 'reflection', 'exercise', 'custom'] as const;

function groupErrorsByField(errors: ValidationError[]): Record<string, ValidationError[]> {
  const grouped: Record<string, ValidationError[]> = {};
  for (const err of errors) {
    const field = err.path.split('.')[0]!;
    if (!grouped[field]) grouped[field] = [];
    grouped[field]!.push(err);
  }
  return grouped;
}

interface EditorShellProps {
  isOpen: boolean;
  onToggle: () => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  fileApi?: PackageFileApi;
  variant?: 'standalone' | 'embedded';
  initialPath?: string | null;
  onOpenActivity?: (path: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onTreeChanged?: () => void;
  onSelectPath?: (path: string) => void;
}

export interface EditorShellHandle {
  save: () => Promise<void>;
  dirtyCount: number;
}

const defaultFileApi: PackageFileApi = {
  listFiles: api.listFiles,
  getPackageDir: api.getPackageDir,
  readFile: api.readFile,
  writeFile: (path, content, validate) => api.writeFile(path, content, validate ?? true),
  deleteFile: api.deleteFile,
  renameFile: api.renameFile,
  createFile: api.createFile,
  uploadAsset: api.uploadAsset,
};

export const EditorShell = forwardRef<EditorShellHandle, EditorShellProps>(function EditorShell(
  {
    mode,
    onModeChange: rawOnModeChange,
    fileApi,
    variant = 'standalone',
    initialPath,
    onOpenActivity,
    onDirtyChange,
    onTreeChanged,
    onSelectPath,
  }: EditorShellProps,
  ref,
) {
  const { t } = useTranslation();
  const client = fileApi ?? defaultFileApi;
  const isEmbedded = variant === 'embedded';
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<Map<string, EditorFile>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [_packageDir, setPackageDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [showNewNode, setShowNewNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<string>('lesson');
  const [pendingModeChange, setPendingModeChange] = useState<EditorMode | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [renameTargetFromMenu, setRenameTargetFromMenu] = useState<FileEntry | null>(null);
  const [deleteTargetFromMenu, setDeleteTargetFromMenu] = useState<FileEntry | null>(null);

  const currentFile = selectedPath ? (openFiles.get(selectedPath) ?? null) : null;
  const effectiveShowPreview = isEmbedded ? false : showPreview;

  const { widgetType, widgetConfig, isWidgetNode } = useWidgetConfig(currentFile?.content ?? '');

  const validationErrors = useMemo(() => {
    if (!isWidgetNode || widgetType === null || widgetConfig === null) return [];
    return validateWidgetConfigForType(widgetType, widgetConfig);
  }, [isWidgetNode, widgetType, widgetConfig]);

  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const file of openFiles.values()) {
      if (file.isDirty) count++;
    }
    return count;
  }, [openFiles]);

  const refreshFiles = useCallback(() => {
    client
      .listFiles()
      .then(setFiles)
      .catch(() => {});
  }, [client]);

  useImperativeHandle(ref, () => ({
    save: () => handleSave(),
    dirtyCount,
  }));

  useEffect(() => {
    onDirtyChange?.(dirtyCount > 0);
  }, [dirtyCount, onDirtyChange]);

  const onModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === 'preview' && dirtyCount > 0) {
        setPendingModeChange(newMode);
        return;
      }
      rawOnModeChange(newMode);
    },
    [rawOnModeChange, dirtyCount],
  );

  // Load files on mount
  useEffect(() => {
    async function load() {
      try {
        const [fileList, dir] = await Promise.all([client.listFiles(), client.getPackageDir()]);
        setFiles(fileList);
        setPackageDir(dir);

        if (fileList.length > 0) {
          const initial = fileList.find((f) => f.path === initialPath) ?? fileList[0];
          if (initial) {
            setSelectedPath(initial.path);
          }
        } else if (initialPath) {
          setSelectedPath(initialPath);
        }
      } catch (err) {
        toast.error('Failed to load files: ' + (err as Error).message);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load file content when selected
  useEffect(() => {
    if (!selectedPath) return;
    if (openFiles.has(selectedPath)) return;

    async function loadContent() {
      try {
        const fileContent = await client.readFile(selectedPath!);
        setOpenFiles((prev) => {
          const next = new Map(prev);
          next.set(selectedPath!, {
            path: selectedPath!,
            content: fileContent.content,
            originalContent: fileContent.content,
            isDirty: false,
            validationError: null,
          });
          return next;
        });
      } catch (err) {
        toast.error('Failed to read file: ' + (err as Error).message);
      }
    }
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, openFiles]);

  const handleFileSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      setViewMode('form');
      onSelectPath?.(path);
    },
    [onSelectPath],
  );

  const handleFileDelete = useCallback(
    async (path: string) => {
      try {
        await client.deleteFile(path);
        refreshFiles();
        onTreeChanged?.();
        setOpenFiles((prev) => {
          const next = new Map(prev);
          next.delete(path);
          return next;
        });
        if (selectedPath === path) {
          setSelectedPath(null);
        }
        toast.success(`Deleted ${path}`);
      } catch (err) {
        toast.error('Failed to delete: ' + (err as Error).message);
      }
    },
    [selectedPath, refreshFiles, client, onTreeChanged],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!selectedPath) return;
      setOpenFiles((prev) => {
        const existing = prev.get(selectedPath);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(selectedPath, {
          ...existing,
          content,
          isDirty: content !== existing.originalContent,
          validationError: null,
        });
        return next;
      });
    },
    [selectedPath],
  );

  const handleSave = useCallback(async () => {
    if (!selectedPath || !currentFile) return;
    if (!currentFile.isDirty) {
      toast('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await client.writeFile(selectedPath, currentFile.content, true);
      setOpenFiles((prev) => {
        const next = new Map(prev);
        const existing = next.get(selectedPath);
        if (existing) {
          next.set(selectedPath, {
            ...existing,
            originalContent: existing.content,
            isDirty: false,
            validationError: null,
          });
        }
        return next;
      });
      toast.success('Saved successfully! Preview will reload.');
      onTreeChanged?.();
    } catch (err) {
      const message = (err as Error).message;
      toast.error(`Save failed: ${message}`);
      if (message.includes('Validation failed')) {
        setOpenFiles((prev) => {
          const next = new Map(prev);
          const existing = next.get(selectedPath);
          if (existing) {
            next.set(selectedPath, {
              ...existing,
              validationError: message,
            });
          }
          return next;
        });
      }
    } finally {
      setSaving(false);
    }
  }, [selectedPath, currentFile, client, onTreeChanged]);

  const handleSaveAll = useCallback(async () => {
    const dirtyFiles = Array.from(openFiles.values()).filter((f) => f.isDirty);
    if (dirtyFiles.length === 0) {
      toast('No changes to save');
      return;
    }

    setSavingAll(true);
    let errorCount = 0;
    for (const file of dirtyFiles) {
      try {
        await client.writeFile(file.path, file.content, true);
        setOpenFiles((prev) => {
          const next = new Map(prev);
          const existing = next.get(file.path);
          if (existing) {
            next.set(file.path, {
              ...existing,
              originalContent: existing.content,
              isDirty: false,
              validationError: null,
            });
          }
          return next;
        });
      } catch (err) {
        errorCount++;
        const message = (err as Error).message;
        toast.error(`Save failed for ${file.path}: ${message}`);
        if (message.includes('Validation failed')) {
          setOpenFiles((prev) => {
            const next = new Map(prev);
            const existing = next.get(file.path);
            if (existing) {
              next.set(file.path, {
                ...existing,
                validationError: message,
              });
            }
            return next;
          });
        }
        break;
      }
    }
    if (errorCount === 0) {
      toast.success(`Saved ${dirtyFiles.length} file(s)! Preview will reload.`);
      onTreeChanged?.();
    }
    setSavingAll(false);
  }, [openFiles, client, onTreeChanged]);

  const handleUndo = useCallback(() => {
    if (!selectedPath || !currentFile) return;
    setOpenFiles((prev) => {
      const next = new Map(prev);
      const existing = next.get(selectedPath);
      if (existing) {
        next.set(selectedPath, {
          ...existing,
          content: existing.originalContent,
          isDirty: false,
          validationError: null,
        });
      }
      return next;
    });
    toast('Reverted to last saved state');
  }, [selectedPath, currentFile]);

  const handleCreateConfigFile = useCallback(
    async (section: string) => {
      const fileName = section === 'manifest' ? 'package.json' : `${section}.json`;
      const template = CONFIG_TEMPLATES[fileName];
      if (!template) return;
      try {
        await client.createFile(fileName, template);
        refreshFiles();
        onTreeChanged?.();
        setSelectedPath(fileName);
        toast.success(`Created ${fileName}`);
      } catch (err) {
        toast.error('Failed to create config file: ' + (err as Error).message);
      }
    },
    [refreshFiles, client, onTreeChanged],
  );

  const handleRenameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      try {
        await client.renameFile(oldPath, newPath);
        refreshFiles();
        onTreeChanged?.();
        if (selectedPath === oldPath) {
          setSelectedPath(newPath);
        }
        setOpenFiles((prev) => {
          const next = new Map(prev);
          const file = next.get(oldPath);
          if (file) {
            next.delete(oldPath);
            next.set(newPath, { ...file, path: newPath });
          }
          return next;
        });
        toast.success(`Renamed to ${newPath}`);
      } catch (err) {
        toast.error('Rename failed: ' + (err as Error).message);
      }
    },
    [selectedPath, refreshFiles, client, onTreeChanged],
  );

  const handleCreateNode = useCallback(async () => {
    if (!newNodeName.trim()) return;
    const ext = newNodeType === 'lesson' ? '.md' : '.json';
    const fileName = newNodeName.trim().toLowerCase().replace(/\s+/g, '-') + ext;
    const filePath = `nodes/${fileName}`;

    try {
      const content =
        newNodeType === 'lesson'
          ? `# ${newNodeName.trim()}\n\nStart writing here...`
          : JSON.stringify(
              {
                type: newNodeType,
                title: newNodeName.trim(),
              },
              null,
              2,
            );

      await client.createFile(filePath, content);
      refreshFiles();
      onTreeChanged?.();
      setShowNewNode(false);
      setNewNodeName('');
      setNewNodeType('lesson');
      setSelectedPath(filePath);
      toast.success(`Created ${filePath}`);
    } catch (err) {
      toast.error('Failed to create node: ' + (err as Error).message);
    }
  }, [newNodeName, newNodeType, refreshFiles, client, onTreeChanged]);

  const handleStructuredDataChange = useCallback(
    (data: Record<string, unknown>) => {
      if (!selectedPath) return;
      const content = JSON.stringify(data, null, 2);
      handleContentChange(content);
    },
    [selectedPath, handleContentChange],
  );

  const handleRefreshAssets = useCallback(() => {
    refreshFiles();
  }, [refreshFiles]);

  const currentExtension = currentFile?.path ? '.' + (currentFile.path.split('.').pop() ?? '') : '';
  const isJsonFile = currentExtension === '.json';

  const fileEditorContent = useMemo(() => {
    if (!currentFile) return null;

    const ek = currentFile.path;

    if (currentFile.path === 'package.json') {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        const nodePaths = files
          .filter((f) => f.category === 'nodes')
          .map((f) => f.path)
          .sort();
        return (
          <ManifestEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
            nodePaths={nodePaths}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    if (currentFile.path === 'workflow.json') {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        return (
          <WorkflowEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    if (currentFile.path === 'rewards.json') {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        return (
          <RewardsEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    if (currentFile.path === 'cards.json') {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        return (
          <CardsEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    if (currentFile.path.startsWith('nodes/') && isJsonFile) {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        return (
          <JSONNodeEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
            fileName={currentFile.path}
            fieldErrors={validationErrors.length > 0 ? groupErrorsByField(validationErrors) : {}}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    if (currentExtension === '.md') {
      return (
        <MarkdownEditor
          key={ek}
          content={currentFile.content}
          onChange={handleContentChange}
          fileName={currentFile.path}
        />
      );
    }

    if (currentExtension === '.json') {
      if (viewMode === 'raw') {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
      try {
        const parsed = JSON.parse(currentFile.content);
        return (
          <JSONNodeEditor
            key={ek}
            data={parsed}
            onChange={(d) => handleStructuredDataChange(d as unknown as Record<string, unknown>)}
            fileName={currentFile.path}
            fieldErrors={validationErrors.length > 0 ? groupErrorsByField(validationErrors) : {}}
          />
        );
      } catch {
        return (
          <RawJsonEditor
            key={ek}
            content={currentFile.content}
            onChange={handleContentChange}
            fileName={currentFile.path}
          />
        );
      }
    }

    return (
      <div className="flex h-full flex-col">
        <div className="mb-2">
          <span className="text-on-surface-variant text-xs font-medium">{currentFile.path}</span>
        </div>
        <Textarea
          className="border-outline-variant flex-1 resize-none rounded border p-3 font-mono text-sm focus:outline-none focus-visible:ring-0"
          value={currentFile.content}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          aria-label="File editor"
        />
      </div>
    );
  }, [
    currentFile,
    viewMode,
    handleContentChange,
    handleStructuredDataChange,
    isJsonFile,
    currentExtension,
    files,
    validationErrors,
  ]);

  const assetFiles = useMemo(
    () => files.filter((f) => f.category === 'assets').map((f) => f.path),
    [files],
  );

  const showAssetManager = mode === 'edit' && selectedPath?.startsWith('assets/');

  return (
    <div className="bg-surface flex h-full flex-col" role="region" aria-label="Package editor">
      <div className="border-outline-variant bg-surface-container-low flex items-center justify-between border-b px-3 py-2">
        {isEmbedded ? (
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <span className="bg-secondary-container text-secondary rounded px-1.5 py-0.5 text-[10px] font-medium">
                {dirtyCount} unsaved
              </span>
            )}
            {onOpenActivity && selectedPath?.startsWith('nodes/') && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onOpenActivity(selectedPath)}
              >
                {t('studio.files.openAsActivity')}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="bg-primary-container text-on-primary-container rounded px-1.5 py-0.5 text-[10px] font-semibold">
              EDITOR
            </span>
            {mode === 'edit' && (
              <>
                <span className="text-on-surface-variant text-xs">Edit Mode</span>
                {dirtyCount > 0 && (
                  <span className="bg-secondary-container text-secondary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {dirtyCount} unsaved
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          {mode === 'edit' && isJsonFile && (
            <Button
              variant={viewMode === 'raw' ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setViewMode(viewMode === 'raw' ? 'form' : 'raw')}
            >
              {viewMode === 'raw' ? 'Form View' : 'Raw JSON'}
            </Button>
          )}
          {!isEmbedded && (
            <Button
              variant={mode === 'edit' ? 'default' : 'outline'}
              size="sm"
              className={mode === 'edit' ? 'bg-success hover:bg-success/90' : ''}
              onClick={() => onModeChange(mode === 'preview' ? 'edit' : 'preview')}
            >
              {mode === 'edit' ? 'Done Editing' : 'Edit Package'}
            </Button>
          )}
        </div>
      </div>

      {mode === 'edit' || isEmbedded ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="border-outline-variant flex w-56 shrink-0 flex-col overflow-hidden border-r">
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelect={handleFileSelect}
              onDelete={handleFileDelete}
              onContextMenu={(target: ContextMenuTarget) => setContextMenu(target)}
              onNewNode={() => setShowNewNode(true)}
              onUploadAsset={() => document.getElementById('asset-upload-input')?.click()}
              onCreateFile={handleCreateConfigFile}
              onRenameFile={handleRenameFile}
              externalRenameTarget={renameTargetFromMenu}
              onExternalRenameHandled={() => setRenameTargetFromMenu(null)}
              externalDeleteTarget={deleteTargetFromMenu}
              onExternalDeleteHandled={() => setDeleteTargetFromMenu(null)}
            />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {selectedPath && (
              <div className="border-outline-variant bg-surface flex items-center border-b px-2">
                <div className="border-outline-variant flex items-center gap-1 border-r pr-2">
                  <span className="text-on-surface-variant text-xs">
                    {currentFile?.isDirty ? '●' : '○'}
                  </span>
                  <span className="text-on-surface max-w-[200px] truncate text-xs font-medium">
                    {selectedPath}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-on-surface-variant text-xs font-medium"
                  onClick={handleUndo}
                  disabled={!currentFile?.isDirty}
                  title="Revert to last saved state"
                >
                  Undo
                </Button>
                {!isEmbedded && isWidgetNode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-on-surface-variant text-xs font-medium"
                    onClick={() => setShowPreview((p) => !p)}
                    title={effectiveShowPreview ? 'Hide preview' : 'Show preview'}
                  >
                    {effectiveShowPreview ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    <span className="ml-1">
                      {effectiveShowPreview ? 'Hide Preview' : 'Show Preview'}
                    </span>
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-on-surface-variant text-xs font-medium"
                  onClick={handleSaveAll}
                  disabled={dirtyCount === 0 || savingAll}
                >
                  {savingAll ? 'Saving...' : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary text-xs font-medium"
                  onClick={handleSave}
                  disabled={!currentFile?.isDirty || saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {showAssetManager ? (
                <AssetManager assets={assetFiles} onRefresh={handleRefreshAssets} />
              ) : currentFile ? (
                <SplitPaneLayout
                  editorContent={
                    <div className="h-full overflow-auto p-3">
                      {currentFile.validationError && (
                        <div className="border-error-container bg-error-container mb-3 rounded-lg border px-3 py-2">
                          <p className="text-error text-xs font-medium">Validation Error:</p>
                          <p className="text-error mt-0.5 text-xs">{currentFile.validationError}</p>
                        </div>
                      )}
                      {fileEditorContent}
                    </div>
                  }
                  previewContent={
                    <WidgetPreviewPanel
                      widgetType={isWidgetNode ? widgetType : null}
                      widgetConfig={isWidgetNode ? widgetConfig : null}
                      validationErrors={validationErrors}
                      onCollapse={() => setShowPreview(false)}
                    />
                  }
                  showPreview={effectiveShowPreview && isWidgetNode}
                  onTogglePreview={() => setShowPreview((p) => !p)}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileText
                      className="text-on-surface-variant/40 mx-auto mb-2 size-10"
                      strokeWidth={1}
                    />
                    <p className="text-on-surface-variant text-sm">
                      Select a file from the sidebar to edit
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-low flex flex-1 items-center justify-center">
          <div className="text-center">
            <Eye className="text-on-surface-variant/40 mx-auto mb-3 size-12" strokeWidth={1} />
            <p className="text-on-surface-variant text-sm font-medium">Package Preview Below</p>
            <p className="text-on-surface-variant mt-1 text-xs">
              Click "Edit Package" to start editing files
            </p>
          </div>
        </div>
      )}

      <Dialog open={showNewNode} onOpenChange={setShowNewNode}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Content Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-on-surface-variant mb-0.5 block text-xs font-medium">
                Filename
              </label>
              <Input
                placeholder="e.g., introduction"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNode();
                  if (e.key === 'Escape') setShowNewNode(false);
                }}
              />
              <p className="text-on-surface-variant mt-1 text-[10px]">
                Will create: nodes/
                {newNodeName.trim().toLowerCase().replace(/\s+/g, '-') || 'filename'}
                {newNodeType === 'lesson' ? '.md' : '.json'}
              </p>
            </div>
            <div>
              <label className="text-on-surface-variant mb-0.5 block text-xs font-medium">
                Type
              </label>
              <Select value={newNodeType} onValueChange={setNewNodeType}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {NODE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewNode(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateNode} disabled={!newNodeName.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingModeChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingModeChange(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-on-surface-variant text-sm">
            You have unsaved changes. Switch to preview anyway?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingModeChange(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (pendingModeChange) {
                  rawOnModeChange(pendingModeChange);
                }
                setPendingModeChange(null);
              }}
            >
              Switch Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}>
            <DropdownMenu
              open={true}
              onOpenChange={(open) => {
                if (!open) setContextMenu(null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <span />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  sideOffset={0}
                  className="min-w-[160px]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {contextMenu.file && (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenameTargetFromMenu(contextMenu.file);
                          setContextMenu(null);
                        }}
                      >
                        <Pencil className="mr-2 size-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-error focus:bg-error-container focus:text-error"
                        onSelect={() => {
                          setDeleteTargetFromMenu(contextMenu.file);
                          setContextMenu(null);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  {contextMenu.section === 'nodes' && !contextMenu.file && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setContextMenu(null);
                        setShowNewNode(true);
                      }}
                    >
                      <Plus className="mr-2 size-3.5" />
                      New Content Node
                    </DropdownMenuItem>
                  )}
                  {contextMenu.section === 'assets' && !contextMenu.file && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setContextMenu(null);
                        document.getElementById('asset-upload-input')?.click();
                      }}
                    >
                      <Upload className="mr-2 size-3.5" />
                      Upload Asset
                    </DropdownMenuItem>
                  )}
                  {contextMenu.section &&
                    ['manifest', 'workflow', 'rewards', 'cards'].includes(contextMenu.section) &&
                    !contextMenu.file && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setContextMenu(null);
                          handleCreateConfigFile(contextMenu.section!);
                        }}
                      >
                        <Plus className="mr-2 size-3.5" />
                        Create{' '}
                        {contextMenu.section === 'manifest'
                          ? 'package.json'
                          : `${contextMenu.section}.json`}
                      </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </div>
        </>
      )}

      <input
        id="asset-upload-input"
        type="file"
        className="hidden"
        aria-label="Upload asset"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await client.uploadAsset(file);
            refreshFiles();
            onTreeChanged?.();
            toast.success(`Uploaded ${file.name}`);
          } catch (err) {
            toast.error('Upload failed: ' + (err as Error).message);
          }
          e.target.value = '';
        }}
      />

      <Toaster position="bottom-right" />
    </div>
  );
});
