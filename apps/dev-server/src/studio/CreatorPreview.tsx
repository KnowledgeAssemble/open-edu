import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuntimeProvider, LayoutShell, RewardEventBridge } from '@open-edu/runtime';
import { WorkflowEngine } from '@open-edu/workflow';
import type { WorkflowEvent } from '@open-edu/workflow';
import { AccessibilityProvider } from '@open-edu/accessibility';
import { createDefaultRegistry } from '@open-edu/widgets';
import { TelemetrySession } from '@open-edu/telemetry/session';
import { RewardBroker } from '@open-edu/rewards/broker';
import type { RewardReceipt } from '@open-edu/rewards';
import { Button } from '@open-edu/design-system';
import { useTranslation } from '@open-edu/i18n';
import { loadProgress, saveProgress, clearProgress } from '../progressStorage.js';
import { PreviewCourseSidebar } from './PreviewCourseSidebar.js';
import { InspectorPanel } from '../inspectors/InspectorPanel.js';
import { createRewardReceiptBridge } from '../createRewardReceiptBridge.js';
import { readDevtoolsState, writeDevtoolsState } from './devtoolsStorage.js';
import type { ProgressSnapshot, TelemetryEvent } from '@open-edu/schemas';
import type { LoadedPackage } from '@open-edu/core';

export function CreatorPreview({
  pkg,
  onExit,
}: {
  pkg: LoadedPackage;
  onExit?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [progressKey, setProgressKey] = useState(0);
  const [devtools, setDevtools] = useState(() => readDevtoolsState());
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [rewardReceipts, setRewardReceipts] = useState<RewardReceipt[]>([]);
  const telemetrySessionRef = useRef<TelemetrySession | null>(null);
  const brokerRef = useRef<RewardBroker | null>(null);

  const rewardBridge = useMemo(() => createRewardReceiptBridge(), []);

  const initialProgress = useMemo(() => {
    return loadProgress(pkg.manifest.id, pkg.manifest.version) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey, pkg.manifest.id, pkg.manifest.version]);

  const engine = useMemo(() => {
    if (!pkg.workflow) return null;
    const saved = initialProgress?.currentNodeId;
    const entry = saved && saved in pkg.workflow.routing ? saved : pkg.manifest.entry;
    return new WorkflowEngine(pkg.workflow, { entry });
  }, [pkg, initialProgress, progressKey]);

  const widgetRegistry = useMemo(() => createDefaultRegistry(), []);

  useEffect(() => {
    const session = new TelemetrySession();
    session.start();
    telemetrySessionRef.current = session;

    const eventSub = session.events$.subscribe({
      next: (event) => {
        setTelemetryEvents((prev) => [...prev, event]);
      },
    });

    const broker = pkg.rewards
      ? new RewardBroker({
          rewards: pkg.rewards,
          source: session.events$,
          onReceipt: (receipt) => {
            rewardBridge.onReceipt(receipt);
            setRewardReceipts((prev) => [...prev, receipt]);
          },
        })
      : null;
    broker?.start();
    brokerRef.current = broker;

    let engineUnsub: (() => void) | undefined;
    if (engine) {
      engineUnsub = engine.subscribe((event: WorkflowEvent) => {
        if (event.type === 'node.entered' && event.nodeId) {
          session.emit({ event: 'node_open', nodeId: event.nodeId } as never);
        } else if (event.type === 'node.completed' && event.nodeId) {
          session.emit({
            event: 'node_complete',
            nodeId: event.nodeId,
            score: event.score,
          } as never);
          broker?.updateContext({
            scores: event.score != null ? { [event.nodeId]: event.score } : undefined,
            completedNodes: [event.nodeId],
          });
        } else if (event.type === 'workflow.completed') {
          session.emit({ event: 'workflow_complete' } as never);
          broker?.updateContext({
            completedNodes: ['__workflow__'],
          });
        }
      });
    }

    return () => {
      engineUnsub?.();
      broker?.stop();
      eventSub.unsubscribe();
      void session.stop();
      telemetrySessionRef.current = null;
      brokerRef.current = null;
    };
  }, [engine, rewardBridge, progressKey, pkg]);

  const handleProgressChange = useCallback(
    (snapshot: ProgressSnapshot) => {
      saveProgress(pkg.manifest.id, pkg.manifest.version, snapshot);
    },
    [pkg.manifest.id, pkg.manifest.version],
  );

  const handleReset = useCallback(() => {
    clearProgress(pkg.manifest.id, pkg.manifest.version);
    setTelemetryEvents([]);
    setRewardReceipts([]);
    setProgressKey((k) => k + 1);
  }, [pkg.manifest.id, pkg.manifest.version]);

  const handleToggleDevtools = useCallback(() => {
    setDevtools((prev) => {
      const next = { open: !prev.open, tab: prev.tab };
      writeDevtoolsState(next);
      return next;
    });
  }, []);

  const handleTelemetryEvent = useCallback((event: TelemetryEvent) => {
    telemetrySessionRef.current?.emit(event);
  }, []);

  const definedRewards = useMemo(
    () =>
      pkg.rewards
        ? pkg.rewards.triggers.flatMap((tr) =>
            tr.rewards.map((r) => ({
              action: r.action,
              badge: (r as { badge?: string }).badge,
              condition: (r as { condition?: unknown }).condition,
            })),
          )
        : undefined,
    [pkg.rewards],
  );

  if (!engine) {
    return (
      <div className="text-error p-8">
        <p>{t('studio.preview.noWorkflow')}</p>
      </div>
    );
  }

  return (
    <AccessibilityProvider>
      <RuntimeProvider
        key={progressKey}
        loadedPackage={pkg}
        engine={engine}
        initialProgress={initialProgress}
        onProgressChange={handleProgressChange}
        widgetRegistry={widgetRegistry}
        onTelemetryEvent={handleTelemetryEvent}
      >
        <RewardEventBridge receipts$={rewardBridge.receipts$} />
        <div className="relative flex h-full flex-col">
          <div className="border-outline-variant bg-surface flex items-center justify-between border-b px-4 py-2">
            <Button variant="outline" size="sm" onClick={() => onExit?.()}>
              {t('studio.preview.exit')}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleDevtools}
                aria-pressed={devtools.open}
                aria-label={t(
                  devtools.open ? 'studio.preview.devtoolsClose' : 'studio.preview.devtoolsOpen',
                )}
              >
                {t('studio.preview.devtools')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                {t('studio.preview.resetProgress')}
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <PreviewCourseSidebar />
              <div className="min-h-0 flex-1 overflow-auto">
                <LayoutShell />
              </div>
            </div>
            {devtools.open && engine ? (
              <InspectorPanel
                telemetryEvents={telemetryEvents}
                rewardReceipts={rewardReceipts}
                definedRewards={definedRewards}
                open={devtools.open}
                onOpenChange={(open) => {
                  setDevtools((prev) => {
                    const next = { ...prev, open };
                    writeDevtoolsState(next);
                    return next;
                  });
                }}
                activeTab={devtools.tab}
                onActiveTabChange={(tab) => {
                  setDevtools((prev) => {
                    const next = { ...prev, tab };
                    writeDevtoolsState(next);
                    return next;
                  });
                }}
                auditRootSelector=".open-edu-runtime"
              />
            ) : null}
          </div>
        </div>
      </RuntimeProvider>
    </AccessibilityProvider>
  );
}
