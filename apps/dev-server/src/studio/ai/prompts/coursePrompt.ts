import { renderWidgetCatalogSection } from './buildPrompt.js';
import { getArtifactContractPromptView } from '@open-edu/domain-guidance';
import type { AuthoringContext } from '@open-edu/packs';
import { renderAuthoringContextBlock } from './authoringContext.js';

export const COURSE_SPEC_CONTRACT = getArtifactContractPromptView();

export function buildCourseSpecPrompt(
  notes: string,
  options?: { locale?: string; authoring?: AuthoringContext },
): string {
  const sections = [
    "You are an expert curriculum designer. Turn the teacher's notes below into a short, high-quality OpenEdu course.",
    '',
    'TEACHER NOTES:',
    notes.trim(),
    '',
    COURSE_SPEC_CONTRACT,
    '',
    renderWidgetCatalogSection(),
  ];
  if (options?.authoring) {
    sections.push('', renderAuthoringContextBlock(options.authoring));
  }
  if (options?.locale) {
    sections.push(
      '',
      `The author has requested locale "${options.locale}". Set metadata.language to "${options.locale}".`,
    );
  }
  return sections.join('\n');
}
