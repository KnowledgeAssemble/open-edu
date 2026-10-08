export interface AiGenerateRequest {
  notes: string;
  titleHint?: string;
  locale?: string;
}

export interface AiQualityItem {
  id: string;
  labelKey: string;
  passed: boolean;
  detail?: string;
}

export type AiGenerateErrorCode =
  | 'notes-too-short'
  | 'has-content'
  | 'llm'
  | 'parse'
  | 'write'
  | 'compile'
  | 'spec-invalid'
  | 'item-retry-failed'
  | 'invalid-blueprint';

export interface AiGenerateResult {
  success: boolean;
  quality: AiQualityItem[];
  outlinePreview: Array<{ title: string; kind: string }>;
  title?: string;
  error?: string;
  code?: AiGenerateErrorCode;
}

export interface CourseDraftResult {
  success: boolean;
  title?: string;
  outlinePreview: Array<{ title: string; kind: string }>;
  quality: AiQualityItem[];
  draftId: string;
  error?: string;
  code?: AiGenerateErrorCode;
}

export interface AiStatus {
  available: boolean;
  reason?: 'missing-key' | 'disabled';
}

export type AiEndpointErrorCode =
  | 'no-active-package'
  | 'missing-notes'
  | 'missing-spec'
  | 'unknown-ai-endpoint'
  | 'ai-unavailable'
  | 'invalid-request'
  | 'draft-not-found'
  | 'draft-expired';

export type DraftItem =
  | { kind: 'lesson'; title: string; content: string }
  | { kind: 'quiz'; title: string; content: string }
  | { kind: 'practice'; title: string; content: string };

export type ItemIntent =
  | 'rewrite'
  | 'expand'
  | 'fix-quality'
  | 'difficulty'
  | 'translate'
  | 'add-questions'
  | 'improve-prompt';

export type ItemIntentParams = { targetLocale: string } | { direction: 'easier' | 'harder' };

export type AiItemAddResult =
  | { ok: true; item: DraftItem }
  | { ok: false; code: 'item-retry-failed'; error: string };

export type AiItemEditResult =
  | { ok: true; items: DraftItem[] }
  | { ok: false; code: 'item-retry-failed'; error: string };
