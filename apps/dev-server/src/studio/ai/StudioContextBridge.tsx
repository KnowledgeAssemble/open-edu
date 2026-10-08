import { useEffect, useRef, useState } from 'react';
import {
  ActivityKindSchema,
  buildOutlineSummary,
  studioContextSnapshotSchema,
  truncateExcerpt,
  type ActivityKind,
  type LearnerProfile,
  type StudioContextSnapshot,
} from './context';
import { useStudioAssistant } from './StudioAssistantProvider';
import { useEditorBridge } from './EditorBridgeContext';
import type { AuthoringContext } from '@open-edu/packs';

interface StudioContextBridgeProps {
  view: string;
  selectedPath: string | null;
  loadedPackage: {
    manifest: { id: string; title: string };
    workflow?: { routing?: Record<string, unknown> } | null;
  } | null;
  aiAvailable: boolean;
  locale: string;
  /** Author-facing learner profile (spec §12). Default undefined → no styling. */
  learner?: LearnerProfile;
  /** Resolved authoring context (packs). Travels with the snapshot to the AI. */
  authoring?: AuthoringContext | null;
  api?: {
    getOutline: () => Promise<{
      activities: Array<{ path: string; title: string; kind: string }>;
      title: string;
    }>;
    readFile?: (path: string) => Promise<{ path: string; content: string }>;
  };
}

function coerceKind(kind: string | undefined): ActivityKind {
  const parsed = ActivityKindSchema.safeParse(kind);
  return parsed.success ? parsed.data : 'other';
}

export function StudioContextBridge({
  view,
  selectedPath,
  loadedPackage,
  aiAvailable,
  locale,
  learner,
  authoring,
  api,
}: StudioContextBridgeProps) {
  const { setContext } = useStudioAssistant();
  const { currentEditor, selection } = useEditorBridge();
  const baseRef = useRef<StudioContextSnapshot | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function syncContext() {
      const snapshot: Record<string, unknown> = {
        view,
        locale,
        aiAvailable,
      };

      if (learner) {
        snapshot.learner = learner;
      }

      if (authoring) {
        snapshot.authoring = authoring;
      }

      if (loadedPackage) {
        snapshot.course = {
          id: loadedPackage.manifest.id,
          title: loadedPackage.manifest.title,
          activityCount: 0,
          outline: [],
        };

        if (api) {
          try {
            const outline = await api.getOutline();
            const summarized = buildOutlineSummary(
              outline.activities.map((a) => ({
                title: a.title,
                kind: coerceKind(a.kind),
                path: a.path,
              })),
            );
            (snapshot.course as { activityCount: number; outline: unknown[] }).activityCount =
              outline.activities.length;
            (snapshot.course as { outline: unknown[] }).outline = summarized;
          } catch {
            if (loadedPackage.workflow?.routing) {
              const paths = Object.keys(loadedPackage.workflow.routing);
              const summarized = buildOutlineSummary(
                paths.map((path) => ({
                  title: path.split('/').pop() || 'Untitled',
                  kind: 'other' as const,
                  path,
                })),
              );
              (snapshot.course as { activityCount: number; outline: unknown[] }).activityCount =
                paths.length;
              (snapshot.course as { outline: unknown[] }).outline = summarized;
            }
          }
        }
      }

      if (selectedPath && loadedPackage) {
        const activity: {
          path: string;
          kind: ActivityKind;
          title?: string;
          contentExcerpt?: string;
          isDirty?: boolean;
          selection?: { start: number; end: number; text: string };
        } = {
          path: selectedPath,
          kind: 'other',
          title: selectedPath.split('/').pop() || 'Activity',
        };

        if (api?.getOutline) {
          try {
            const outline = await api.getOutline();
            const match = outline.activities.find((a) => a.path === selectedPath);
            if (match) {
              activity.kind = coerceKind(match.kind);
              activity.title = match.title || match.path.split('/').pop();
            }
          } catch {
            // keep defaults
          }
        }

        if (api?.readFile) {
          try {
            const file = await api.readFile(selectedPath);
            activity.contentExcerpt = truncateExcerpt(file.content);
          } catch {
            // excerpt optional
          }
        }

        snapshot.activity = activity;
      }

      if (cancelled) return;
      const validated = studioContextSnapshotSchema.parse(snapshot);
      baseRef.current = validated;
      setContext(validated);
      setBaseVersion((v) => v + 1);
    }

    setContext(
      studioContextSnapshotSchema.parse({
        view,
        locale,
        aiAvailable,
        ...(learner ? { learner } : {}),
      }),
    );
    void syncContext();

    return () => {
      cancelled = true;
    };
  }, [view, selectedPath, loadedPackage, aiAvailable, locale, learner, authoring, setContext, api]);

  // Patch live editor fields (selection, dirty, buffer excerpt) without re-fetching.
  // Debounced at ~300ms to avoid request spam while typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      const base = baseRef.current;
      if (!base?.activity || !selectedPath) return;
      if (!currentEditor || currentEditor.path !== selectedPath) return;

      const next = studioContextSnapshotSchema.parse({
        ...base,
        activity: {
          ...base.activity,
          contentExcerpt: truncateExcerpt(currentEditor.getCurrentContent()),
          isDirty: currentEditor.isDirty(),
          title: currentEditor.title || base.activity.title,
          kind: currentEditor.kind !== 'other' ? currentEditor.kind : base.activity.kind,
          selection: selection && selection.text.trim() ? selection : undefined,
        },
      });
      setContext(next);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentEditor, selection, selectedPath, baseVersion, setContext]);

  return null;
}
