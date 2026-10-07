import type { CompanionSkill, SkillRegistry } from '@open-edu/companion';
import { learnerAdaptationSkill } from './skills/learner-adaptation.js';
import {
  createInteractiveAuthoringSkills,
  interactiveAuthoringRouterSkill,
} from './skills/interactive-authoring.js';

/** In-memory `SkillRegistry` (spec §11): data-driven, no plugin system. */
export class InMemorySkillRegistry implements SkillRegistry {
  private readonly skills = new Map<string, CompanionSkill>();

  constructor(
    skills: CompanionSkill[] = [
      learnerAdaptationSkill,
      ...createInteractiveAuthoringSkills(),
      interactiveAuthoringRouterSkill,
    ],
  ) {
    for (const skill of skills) this.skills.set(skill.id, skill);
  }

  register(skill: CompanionSkill): void {
    this.skills.set(skill.id, skill);
  }

  list(): CompanionSkill[] {
    return [...this.skills.values()];
  }
}
