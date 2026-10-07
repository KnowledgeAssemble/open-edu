import type { CompanionSkill, SkillResolver } from '@open-edu/companion';
import type { StudioContextSnapshot } from '@open-edu/companion/context';

import { getProfile } from '@open-edu/domain-guidance';
import { getEngineSkillsData } from '@open-edu/domain-guidance';
import { detectEngineType } from './interactive-authoring.js';

/**
 * Resolve skills per-request (spec §13) so the whole skill library is never
 * injected into every model call. The resolver is deliberately trivial now: one
 * rule — a learner profile present in the context → `learner-adaptation`. Its
 * `resolve(context)` contract keeps future skills additive: add a rule + a skill
 * definition without loop changes.
 */
export function createSkillResolver(registry: { list(): CompanionSkill[] }): SkillResolver {
  return {
    resolve(context: unknown): CompanionSkill[] {
      const ctx = context as StudioContextSnapshot;
      const allSkills = registry.list();
      const resolved: CompanionSkill[] = [];

      // Rule 1: learner-adaptation
      if (ctx?.learner) {
        const profileDef = getProfile(ctx.learner.kind);
        const customInstructions = profileDef?.promptInstructions
          ? `Adapt explanations, examples, pacing, and assessment format to the target learner profile (${profileDef.name}): ${profileDef.promptInstructions}`
          : undefined;

        const adapted = allSkills
          .filter((skill) => skill.id === 'learner-adaptation')
          .map((skill) => ({
            ...skill,
            instructions: customInstructions || skill.instructions,
          }));
        resolved.push(...adapted);
      }

      // Rule 2: interactive engine detection
      const excerpt = ctx?.activity?.contentExcerpt ?? '';
      const selection = ctx?.activity?.selection?.text ?? '';
      const combined = `${excerpt} ${selection}`.toLowerCase();
      const hasInteractiveSignal =
        combined.includes('"type":"interactive"') ||
        combined.includes("'type':'interactive'") ||
        combined.includes('interactive');

      if (hasInteractiveSignal) {
        const engineTypes = getEngineSkillsData().engines.map((e) => e.type);
        const matchedEngine = detectEngineType(combined, engineTypes);

        if (matchedEngine) {
          const engineSkill = allSkills.find((s) => s.id === `interactive-${matchedEngine}`);
          if (engineSkill) {
            const learnerInstruction = resolved.length > 0 ? resolved[0]?.instructions : undefined;
            const merged = learnerInstruction
              ? {
                  ...engineSkill,
                  instructions: `${learnerInstruction}\n\n${engineSkill.instructions}`,
                }
              : engineSkill;
            resolved.push(merged);
          }
        } else {
          const routerSkill = allSkills.find((s) => s.id === 'interactive-authoring');
          if (routerSkill) resolved.push(routerSkill);
        }
      }

      return resolved;
    },
  };
}
