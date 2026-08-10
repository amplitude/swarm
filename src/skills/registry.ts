import type { SkillDefinition } from '@/types/skill';

/**
 * Central skill registry. Skills register themselves here and the
 * prompt builder queries skill fragments for each agent.
 */
class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }
}

/** Singleton skill registry */
export const skillRegistry = new SkillRegistry();
