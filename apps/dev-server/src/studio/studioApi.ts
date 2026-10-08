import type { CourseWorkspace } from '@open-edu/storage';
import type {
  AiEndpointErrorCode,
  AiItemAddResult,
  AiItemEditResult,
  AiStatus,
  CourseDraftResult,
  ItemIntent,
  ItemIntentParams,
} from './ai/types.js';
import type { LibraryEntry } from './library/types.js';
import type { ActivitySummary } from './types.js';
import type { LoadedPackage } from '@open-edu/core';
import type {
  PackSummary,
  PackDetail,
  AuthoringContext,
  PackDiagnostic,
} from '@open-edu/packs';

export interface StudioApiError extends Error {
  code?: AiEndpointErrorCode | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; error: string }>;
}

export interface OutlineResult {
  activities: ActivitySummary[];
  title: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  version: string;
  updatedAt: number;
  fileCount: number;
}

export interface LibraryResult {
  workspace: string;
  entries: LibraryEntry[];
}

export interface StorageStatus {
  available: boolean;
  reason?: 'storage-unavailable' | 'quota-exceeded' | 'unsupported';
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
}

export interface PackageFileEntry {
  path: string;
  label: string;
  category: string;
  extension: string;
}

export interface StudioApi {
  getPackageDir(): Promise<string>;
  getWorkspace(): Promise<CourseWorkspace>;
  validate(): Promise<ValidationResult>;
  getOutline(): Promise<OutlineResult>;
  saveOutlineOrder(paths: string[]): Promise<{ success: boolean }>;
  applyTemplate(templateId: string): Promise<{ success: boolean }>;
  getLibrary(): Promise<LibraryResult>;
  openLibraryCourse(relativePath: string): Promise<{ success: boolean; packageDir: string }>;
  duplicateCourse(
    relativePath: string,
    newId: string,
    newTitle: string,
  ): Promise<{ success: boolean; entry: LibraryEntry }>;
  renameCourse(
    relativePath: string,
    newTitle: string,
  ): Promise<{ success: boolean; entry: LibraryEntry }>;
  archiveCourse(relativePath: string): Promise<{ success: boolean; archivedPath?: string }>;
  exportOep(): Promise<ExportResult>;
  importOep(bytes: Uint8Array): Promise<CourseSummary>;
  readFile(path: string): Promise<{ path: string; content: string }>;
  writeFile(path: string, content: string): Promise<{ success: boolean }>;
  deleteFile(path: string): Promise<{ success: boolean; path: string }>;
  listFiles(): Promise<PackageFileEntry[]>;
  createFile(path: string, content?: string): Promise<{ success: boolean; path: string }>;
  renameFile(
    oldPath: string,
    newPath: string,
  ): Promise<{ success: boolean; oldPath: string; newPath: string }>;
  uploadAsset(file: File, path?: string): Promise<{ success: boolean; path: string }>;
  getPreviewPackage(): Promise<LoadedPackage | null>;
  getStorageStatus(): Promise<StorageStatus>;
  getAiStatus(): Promise<AiStatus>;
  generateFromNotes(notes: string, force?: boolean): Promise<CourseDraftResult>;
  uploadSpec(spec: string, specExt: '.json' | '.md', force?: boolean): Promise<CourseDraftResult>;
  generateCourseDraft(notes: string): Promise<CourseDraftResult>;
  uploadSpecDraft(spec: string, specExt: '.json' | '.md'): Promise<CourseDraftResult>;
  commitCourseDraft(
    draftId: string,
    force?: boolean,
  ): Promise<{ success: boolean; title?: string; error?: string }>;
  discardCourseDraft(draftId: string): Promise<{ success: boolean }>;
  generateItemAdd(
    kind: 'lesson' | 'quiz' | 'practice',
    description: string,
  ): Promise<AiItemAddResult>;
  generateItemEdit(
    kind: 'lesson' | 'quiz' | 'practice',
    intent: ItemIntent,
    currentContent: string,
    params?: ItemIntentParams,
  ): Promise<AiItemEditResult>;
  importCourseFolder(sourcePath: string): Promise<{ success: boolean; entry: LibraryEntry }>;
  createUnit(
    title: string,
    courseRelativePaths: string[],
  ): Promise<{ success: boolean; entry: LibraryEntry }>;
  exportUnitOep(relativePath: string): Promise<ExportResult>;
  listPacks(): Promise<PackSummary[]>;
  getPackDetail(id: string, version: string): Promise<PackDetail | null>;
  setAuthoringSelection(selection: {
    curriculum: string;
    unit?: string;
    learner?: string;
    locale?: string;
  }): Promise<{ context: AuthoringContext; warnings: PackDiagnostic[] }>;
}

export type { AiStatus, LibraryEntry, ActivitySummary };
