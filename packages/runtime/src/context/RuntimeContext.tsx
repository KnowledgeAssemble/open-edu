import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LoadedPackage, LoadedNode } from '@open-edu/core';
import type { WorkflowEngine, WorkflowEvent } from '@open-edu/workflow';
import type { WidgetRegistry, WidgetResolver } from '@open-edu/widgets';
import { LiveRegionProvider, useLiveRegion } from '@open-edu/accessibility';
import { useTranslation } from '@open-edu/i18n';
import { normalizeAssetKey, isDataAssetId } from '@open-edu/interactive-runtime';
import type {
  ProgressSnapshot,
  SkillGraph,
  MasteryLevel,
  NodeAnswer,
  TelemetryEvent,
} from '@open-edu/schemas';
import { buildProgressSnapshot } from './progress';
import { computeSkillScores, getSkillMastery } from './skills';

const ASSET_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
};

export interface RuntimeContextValue {
  loadedPackage: LoadedPackage;
  currentNode: LoadedNode | null;
  currentNodeId: string;
  isCompleted: boolean;
  scores: Record<string, number>;
  lastScore: number | null;
  visitedNodes: string[];
  answers: Record<string, NodeAnswer>;
  saveAnswer: (nodeId: string, answer: NodeAnswer) => void;
  completeNode: (score?: number) => void;
  navigateToNode: (nodeId: string) => void;
  getNode: (nodeId: string) => LoadedNode | undefined;
  widgetRegistry: WidgetRegistry | undefined;
  widgetResolver?: WidgetResolver;
  progressSnapshot: ProgressSnapshot | null;
  skillScores: Record<string, number>;
  getSkillMastery: (skillId: string) => MasteryLevel;
  skillGraph: SkillGraph | undefined;
  resolveAsset: (path: string) => string;
  resolveEngineAsset: (id: string) => string;
  emitTelemetry?: (event: DistributiveOmit<TelemetryEvent, 'timestamp'>) => void;
}

export interface RuntimeProviderProps {
  loadedPackage: LoadedPackage;
  engine: WorkflowEngine;
  children: ReactNode;
  widgetRegistry?: WidgetRegistry;
  widgetResolver?: WidgetResolver;
  initialProgress?: ProgressSnapshot;
  onProgressChange?: (snapshot: ProgressSnapshot) => void;
  packageId?: string;
  packageVersion?: string;
  skillGraph?: SkillGraph;
  onTelemetryEvent?: (event: TelemetryEvent) => void;
}

export type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function RuntimeProvider({
  loadedPackage,
  engine,
  children,
  widgetRegistry,
  widgetResolver,
  initialProgress,
  onProgressChange,
  packageId,
  packageVersion,
  skillGraph,
  onTelemetryEvent,
}: RuntimeProviderProps): JSX.Element {
  const skillsRef = useRef(skillGraph);
  skillsRef.current = skillGraph;
  const nodeMap = useMemo(() => {
    const map: Record<string, LoadedNode> = {};
    for (const node of loadedPackage.nodes) {
      map[node.relativePath] = node;
    }
    return map;
  }, [loadedPackage.nodes]);

  const initialSnapshotValid = useMemo(() => {
    if (!initialProgress) return false;
    if (initialProgress.isCompleted) return true;
    return nodeMap[initialProgress.currentNodeId] !== undefined;
  }, [initialProgress, nodeMap]);

  const hasInitialProgress = initialProgress !== undefined;

  useEffect(() => {
    if (hasInitialProgress && !initialSnapshotValid) {
      console.warn(
        `Invalid progress snapshot for "${loadedPackage.manifest.id}" — currentNodeId "${initialProgress!.currentNodeId}" not found in package nodes. Starting from entry.`,
      );
    }
  }, [hasInitialProgress, initialSnapshotValid]); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentNodeId, setCurrentNodeId] = useState<string>(
    initialSnapshotValid ? initialProgress!.currentNodeId : (loadedPackage.manifest.entry ?? ''),
  );
  const [isCompleted, setIsCompleted] = useState<boolean>(
    initialSnapshotValid ? initialProgress!.isCompleted : false,
  );
  const [scores, setScores] = useState<Record<string, number>>(
    initialSnapshotValid ? initialProgress!.scores : {},
  );
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [visitedNodes, setVisitedNodes] = useState<string[]>(
    initialSnapshotValid ? initialProgress!.visitedNodes : [],
  );
  const [answers, setAnswers] = useState<Record<string, NodeAnswer>>(
    initialSnapshotValid && initialProgress!.answers ? { ...initialProgress!.answers } : {},
  );

  const saveAnswer = useCallback((nodeId: string, answer: NodeAnswer) => {
    setAnswers((prev) => ({ ...prev, [nodeId]: answer }));
  }, []);

  const getNode = useCallback(
    (nodeId: string): LoadedNode | undefined => nodeMap[nodeId],
    [nodeMap],
  );

  const completeNode = useCallback(
    (score?: number) => {
      engine.completeNode(score);
    },
    [engine],
  );

  const navigateToNode = useCallback(
    (nodeId: string) => {
      if (nodeMap[nodeId]) {
        setCurrentNodeId(nodeId);
        setVisitedNodes((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
        engine.navigateTo(nodeId);
      }
    },
    [nodeMap, engine],
  );

  useEffect(() => {
    const handleEvent = (event: WorkflowEvent) => {
      if (event.type === 'node.entered' && event.nodeId) {
        const id = event.nodeId;
        setCurrentNodeId(id);
        setVisitedNodes((prev) => (prev[prev.length - 1] === id ? prev : [...prev, id]));
      } else if (event.type === 'node.completed' && event.nodeId) {
        if (typeof event.score === 'number') {
          setScores((prev) => ({ ...prev, [event.nodeId!]: event.score! }));
          setLastScore(event.score);
        }
      } else if (event.type === 'workflow.completed') {
        setIsCompleted(true);
      }
    };

    const unsubscribe = engine.subscribe(handleEvent);
    engine.start();

    return () => {
      unsubscribe();
    };
  }, [engine]);

  const prevSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onProgressChange) return;
    const pkgId = packageId ?? loadedPackage.manifest.id;
    const pkgVer = packageVersion ?? loadedPackage.manifest.version;
    const content = { currentNodeId, visitedNodes, scores, answers, isCompleted };
    const contentJson = JSON.stringify(content);
    if (contentJson === prevSnapshotRef.current) return;
    prevSnapshotRef.current = contentJson;
    onProgressChange(buildProgressSnapshot(pkgId, pkgVer, content));
  }, [
    currentNodeId,
    visitedNodes,
    scores,
    answers,
    isCompleted,
    onProgressChange,
    loadedPackage.manifest.id,
    loadedPackage.manifest.version,
    packageId,
    packageVersion,
  ]);

  const skillScores = useMemo(() => computeSkillScores(scores, skillsRef.current), [scores]);

  const getContextSkillMastery = useCallback(
    (skillId: string): MasteryLevel => {
      const score = skillScores[skillId] ?? 0;
      const def = skillsRef.current?.skills.find((s) => s.id === skillId);
      return getSkillMastery(score, def);
    },
    [skillScores],
  );

  const blobUrlCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const cache = blobUrlCache.current;
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [loadedPackage.manifest.id]);

  const resolveAsset = useCallback(
    (path: string): string => {
      const normalized = (path ?? '')
        .replace(/^\//, '')
        .replace(/^(?:\.\.?\/)*/, '')
        .replace(/^assets\//, '');
      if (!normalized) return '';
      const cached = blobUrlCache.current.get(normalized);
      if (cached) return cached;
      const data = loadedPackage.assetMap?.get(normalized);
      if (data) {
        const ext = normalized.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
        const mimeType = ASSET_MIME_TYPES[ext] ?? '';
        const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
        blobUrlCache.current.set(normalized, url);
        return url;
      }
      console.warn(
        `[resolveAsset] "${normalized}" not found in assetMap for "${loadedPackage.manifest.id}". Available keys:`,
        loadedPackage.assetMap ? Array.from(loadedPackage.assetMap.keys()) : 'no assetMap',
      );
      return `/assets/${normalized}`;
    },
    [loadedPackage.assetMap, loadedPackage.manifest.id],
  );

  const resolveEngineAsset = useCallback(
    (id: string): string => {
      const normalized = normalizeAssetKey(id);
      if (!normalized) return '';
      if (isDataAssetId(normalized)) {
        const data = loadedPackage.assetMap?.get(normalized);
        if (data) return new TextDecoder().decode(data);
        console.warn(
          `[resolveEngineAsset] data asset "${normalized}" not found for "${loadedPackage.manifest.id}". Available keys:`,
          loadedPackage.assetMap ? Array.from(loadedPackage.assetMap.keys()) : 'no assetMap',
        );
        return '';
      }
      return resolveAsset(normalized);
    },
    [loadedPackage.assetMap, loadedPackage.manifest.id, resolveAsset],
  );

  const emitTelemetry = useCallback(
    (event: DistributiveOmit<TelemetryEvent, 'timestamp'>) => {
      onTelemetryEvent?.({ ...event, timestamp: Date.now() } as TelemetryEvent);
    },
    [onTelemetryEvent],
  );

  const value = useMemo<RuntimeContextValue>(
    () => ({
      loadedPackage,
      currentNode: currentNodeId ? (nodeMap[currentNodeId] ?? null) : null,
      currentNodeId,
      isCompleted,
      scores,
      lastScore,
      visitedNodes,
      answers,
      saveAnswer,
      completeNode,
      navigateToNode,
      getNode,
      widgetRegistry,
      widgetResolver,
      skillScores,
      getSkillMastery: getContextSkillMastery,
      skillGraph,
      resolveAsset,
      resolveEngineAsset,
      emitTelemetry,
      progressSnapshot: buildProgressSnapshot(
        packageId ?? loadedPackage.manifest.id,
        packageVersion ?? loadedPackage.manifest.version,
        { currentNodeId, visitedNodes, scores, answers, isCompleted },
      ),
    }),
    [
      loadedPackage,
      currentNodeId,
      nodeMap,
      isCompleted,
      scores,
      lastScore,
      visitedNodes,
      answers,
      saveAnswer,
      completeNode,
      navigateToNode,
      getNode,
      widgetRegistry,
      widgetResolver,
      skillScores,
      getContextSkillMastery,
      skillGraph,
      resolveAsset,
      resolveEngineAsset,
      emitTelemetry,
      packageId,
      packageVersion,
    ],
  );

  return (
    <RuntimeContext.Provider value={value}>
      <LiveRegionProvider>
        <WorkflowAnnouncer />
        {children}
      </LiveRegionProvider>
    </RuntimeContext.Provider>
  );
}

function WorkflowAnnouncer(): null {
  const { announce } = useLiveRegion();
  const { t } = useTranslation();
  const { currentNodeId, currentNode, isCompleted } = useRuntime();
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentNode && currentNodeId && !announcedRef.current.has(currentNodeId)) {
      announcedRef.current.add(currentNodeId);
      const title =
        currentNode.node.title ??
        currentNode.relativePath.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      announce(t('runtime.workflow.now_viewing', { title }));
    }
  }, [currentNodeId, currentNode, announce]);

  useEffect(() => {
    if (isCompleted) {
      announce(t('runtime.workflow.completed'), 'assertive');
    }
  }, [isCompleted, announce]);

  return null;
}

export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error(
      'useRuntime must be used within a <RuntimeProvider>. Wrap your component tree with <RuntimeProvider loadedPackage={...} engine={...}>.',
    );
  }
  return ctx;
}

export function useRuntimeOptional(): RuntimeContextValue | null {
  return useContext(RuntimeContext);
}
