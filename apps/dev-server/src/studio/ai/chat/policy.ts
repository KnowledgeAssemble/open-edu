import type { StudioContextSnapshot, StudioView } from '../context.js';
import { MAX_SUGGESTED_NEXT_STEPS } from './metadata.js';
import { studioChatMessage } from './messages.js';

export interface ExtractNextStepsInput {
  mode: 'explain' | 'draft' | 'course_draft';
  view: StudioView;
  hasCourseDraft: boolean;
  locale?: string;
}

/**
 * Server-suggested follow-up chips attached to assistant message metadata.
 * Returns localized plain strings (max 4) so the client renders them without
 * additional lookups. Derived from the response mode + current view.
 */
export function extractSuggestedNextSteps(input: ExtractNextStepsInput): string[] {
  const locale = input.locale || 'en';
  const next = (key: string): string => studioChatMessage(`assistant.next.${key}`, locale);

  const steps: string[] = [];

  if (input.mode === 'draft') {
    steps.push(next('applyDraft'), next('makeEasier'), next('addQuiz'));
  } else if (input.mode === 'course_draft') {
    steps.push(next('reviewChecklist'), next('acceptDraft'), next('addNotes'));
  } else {
    switch (input.view) {
      case 'outline':
        steps.push(next('addLesson'), next('addQuiz'), next('previewCourse'));
        break;
      case 'home':
        steps.push(next('createFromNotes'), next('summarizeCourse'));
        break;
      case 'edit-activity':
        steps.push(next('improveActivity'), next('checkQuality'));
        break;
      case 'preview':
        steps.push(next('previewFeedback'), next('addFollowup'));
        break;
      case 'share':
        steps.push(next('fixIssues'), next('improveDescription'));
        break;
      default:
        steps.push(next('whatCanYouDo'));
    }
  }

  return steps.slice(0, MAX_SUGGESTED_NEXT_STEPS);
}

const COMPACT_MAX_PACKS = 20;
const COMPACT_MAX_OBJECTIVE_IDS = 50;

export function buildSystemPrompt(ctx: StudioContextSnapshot): string {
  const { view, course, activity, lastCourseDraftQuality } = ctx;

  let prompt = `You are the OpenEdu Author Assistant, a specialized AI companion for teachers creating educational courses.
Your goal is to help authors improve their course structure, activity quality, and pedagogical flow.

CAPABILITIES:
1. Answer questions about course design, pedagogy, and OpenEdu features (explain mode).
2. When the user asks to create a course, generate a lesson, quiz, or practice, or edit content, the system will handle it automatically — you do not need to call any tools.
3. Provide clear, actionable suggestions for course improvement.

CORE CONSTRAINTS:
1. Your responses should be supportive, professional, and focused on instructional design.
2. Always refer to the current course context provided.
3. When asked to generate content, describe what you would create and let the system handle execution.
`;

  if (course) {
    prompt += `\n\nCURRENT COURSE CONTEXT:
Title: ${course.title}
Activities: ${course.activityCount}
Outline:
${course.outline.map((a) => `- [${a.kind}] ${a.title} (${a.path})`).join('\n')}
`;
  }

  if (activity) {
    prompt += `\n\nCURRENTLY EDITING:
Activity: ${activity.title || 'Untitled'}
Kind: ${activity.kind}
Path: ${activity.path}
`;
    if (activity.contentExcerpt) {
      prompt += `\nContent excerpt:\n${activity.contentExcerpt.slice(0, 2000)}`;
    }
  }

  if (lastCourseDraftQuality && lastCourseDraftQuality.length > 0) {
    prompt += `\n\nLAST COURSE DRAFT QUALITY CHECKS:
${lastCourseDraftQuality
  .map((item) => {
    const status = item.passed ? 'PASS' : 'FAIL';
    const detail = !item.passed && item.detail ? ` — ${item.detail}` : '';
    return `- [${status}] ${item.id} (${item.labelKey})${detail}`;
  })
  .join('\n')}

If the user asks why a quality check failed (e.g. "why did assessment fail?"), explain using the FAIL detail above.
If they ask to fix failing checks, give concrete edit suggestions for each failed id.
`;
  }

  prompt += `\n\nCURRENT VIEW: ${view}

QUALITY RUBRIC:
- Lessons should have clear headings and one core idea.
- Quizzes should align directly with lesson objectives.
- Practice activities should be focused and provide immediate feedback.
- The learning path should flow logically from simple to complex.

Respond concisely and provide actionable suggestions. When you generate drafts, present them and ask the user if they want to apply them.`;

  if (ctx.authoring) {
    const a = ctx.authoring;
    const shownPacks = a.packs.slice(0, COMPACT_MAX_PACKS);
    const packsLine = `${shownPacks.map((p) => `${p.type}/${p.id}@${p.version}`).join(', ')}${
      a.packs.length > COMPACT_MAX_PACKS ? ` …(+${a.packs.length - COMPACT_MAX_PACKS} more)` : ''
    }`;
    const shownIds = a.objectives.slice(0, COMPACT_MAX_OBJECTIVE_IDS);
    const idsLine = `${shownIds.map((o) => o.id).join(', ')}${
      a.objectives.length > COMPACT_MAX_OBJECTIVE_IDS
        ? ` …(+${a.objectives.length - COMPACT_MAX_OBJECTIVE_IDS} more)`
        : ''
    }`;
    prompt += `\n\nAUTHORING CONTEXT (compact):
Packs: ${packsLine || '(none)'}
Curriculum unit: ${a.curriculumUnit ?? '(none)'}
Learner: ${a.learner ?? '(none)'} | Locale: ${a.locale ?? 'en'}
Objectives: ${a.objectives.length} | Concepts: ${a.concepts.length} | Available activities: ${a.availableActivities.length}
Objective ids: ${idsLine || '(none)'}
`;
  }

  return prompt;
}
