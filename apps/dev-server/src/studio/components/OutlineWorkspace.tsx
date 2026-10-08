import { useCallback, useState, type RefObject } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { OutlineView } from './OutlineView.js';
import { PackageSourcePane, type PackageSourcePaneHandle } from './PackageSourcePane.js';
import { PackBrowserPanel } from './PackBrowserPanel.js';
import { readFilesPath, writeFilesPath, type OutlineTab } from '../studioSession.js';
import type { StudioApi } from '../studioApi.js';
import type { AuthoringContext, PackDiagnostic } from '@open-edu/packs';

export function OutlineWorkspace({
  api,
  onEdit,
  onError,
  onTitleChange,
  onShare,
  onOutlineMutated,
  filesDirty,
  onDirtyChange,
  tab,
  onTabChange,
  paneRef,
  authoring = null,
  authoringWarnings = [],
  capabilityGaps = [],
}: {
  api: StudioApi;
  onEdit: (path: string) => void;
  onError: (message: string) => void;
  onTitleChange?: (title: string) => void;
  onShare?: () => void;
  onOutlineMutated?: () => void;
  filesDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  tab: OutlineTab;
  onTabChange: (tab: OutlineTab) => void;
  paneRef: RefObject<PackageSourcePaneHandle>;
  authoring?: AuthoringContext | null;
  authoringWarnings?: PackDiagnostic[];
  capabilityGaps?: string[];
}) {
  const { t } = useTranslation();
  const [pendingTab, setPendingTab] = useState<OutlineTab | null>(null);

  const selectTab = useCallback(
    (next: OutlineTab) => {
      if (next === 'outline' && filesDirty) {
        setPendingTab('outline');
        return;
      }
      onTabChange(next);
    },
    [filesDirty, onTabChange],
  );

  const handleSaveThenSwitch = useCallback(async () => {
    if (!pendingTab) return;
    try {
      await paneRef.current?.save();
      onTabChange(pendingTab);
    } catch {
      // Save failed; stay on Files.
    } finally {
      setPendingTab(null);
    }
  }, [pendingTab, onTabChange, paneRef]);

  const handleDiscardThenSwitch = useCallback(() => {
    if (!pendingTab) return;
    onDirtyChange(false);
    onTabChange(pendingTab);
    setPendingTab(null);
  }, [pendingTab, onTabChange, onDirtyChange]);

  const handleCancelSwitch = useCallback(() => {
    setPendingTab(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs value={tab} onValueChange={(value) => selectTab(value as OutlineTab)}>
        <TabsList aria-label={t('studio.outline.tabsLabel')} className="mx-auto mt-4">
          <TabsTrigger value="outline">{t('studio.outline.tabOutline')}</TabsTrigger>
          <TabsTrigger value="files">{t('studio.outline.tabFiles')}</TabsTrigger>
          <TabsTrigger value="packs">{t('studio.outline.tabPacks')}</TabsTrigger>
        </TabsList>
        <TabsContent value="outline" className="min-h-0 flex-1 overflow-auto">
          <OutlineView
            api={api}
            onEdit={onEdit}
            onError={onError}
            onTitleChange={onTitleChange}
            onShare={onShare}
          />
        </TabsContent>
        <TabsContent value="files" className="min-h-0 flex-1 overflow-hidden">
          <PackageSourcePane
            ref={paneRef}
            api={api}
            initialPath={readFilesPath()}
            onOpenActivity={onEdit}
            onDirtyChange={onDirtyChange}
            onTreeChanged={onOutlineMutated}
            onSelectPath={writeFilesPath}
          />
        </TabsContent>
        <TabsContent value="packs" className="min-h-0 flex-1 overflow-auto">
          <PackBrowserPanel
            authoring={authoring}
            warnings={authoringWarnings}
            capabilityGaps={capabilityGaps}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={pendingTab !== null} onOpenChange={(open) => !open && handleCancelSwitch()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('studio.files.unsavedTitle')}</DialogTitle>
            <DialogDescription>{t('studio.files.unsavedLede')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={handleCancelSwitch}>
              {t('studio.files.unsavedCancel')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleSaveThenSwitch()}>
              {t('studio.files.unsavedSave')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDiscardThenSwitch}>
              {t('studio.files.unsavedDiscard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
