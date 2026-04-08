import { eq } from 'drizzle-orm';
import { characters, characterTemplates, skills } from '../../db/schema';

export interface SkillEffect {
  stat?: string;         // target stat
  modifier?: number;     // +/- value
  duration?: number;     // ticks
  chance?: number;       // trigger probability (0-1)
  condition?: string;    // trigger condition (e.g. 'on_trade', 'on_disruption')
}

/** Evaluate a skill for a character — returns applied effects */
export async function evaluateSkill(
  db: any,
  characterId: string,
): Promise<{ skillName: string; effects: SkillEffect[] } | null> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) return null;

  // Get template to find skillId
  const [template] = await db
    .select()
    .from(characterTemplates)
    .where(eq(characterTemplates.id, char.templateId))
    .limit(1);

  if (!template?.skillId) return null;

  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.id, template.skillId))
    .limit(1);

  if (!skill) return null;

  // Check trigger probability based on initiative stat
  const triggerChance = calculateTriggerChance(char.initiative, skill.type);
  if (Math.random() > triggerChance) return null;

  const effects = (skill.effectJson as Record<string, unknown>) || {};
  const parsedEffects: SkillEffect[] = [];

  // Parse effect JSON into structured effects
  if (effects.stat && effects.modifier) {
    parsedEffects.push({
      stat: effects.stat as string,
      modifier: effects.modifier as number,
      duration: (effects.duration as number) || 1,
    });
  }

  // For double-edged skills: add negative side effect
  if (skill.type === 'double_edged' && effects.penaltyStat) {
    parsedEffects.push({
      stat: effects.penaltyStat as string,
      modifier: -(effects.penaltyValue as number || 1),
      duration: (effects.duration as number) || 1,
    });
  }

  return { skillName: skill.name, effects: parsedEffects };
}

/** Higher initiative → higher trigger chance */
function calculateTriggerChance(initiative: number, skillType: string): number {
  // Base chance: 10% + (initiative * 5%) → range 15% ~ 60%
  const base = 0.10 + initiative * 0.05;

  // Trigger type skills have fixed conditions, always "check"
  if (skillType === 'trigger') return 1.0; // triggers are evaluated separately by condition

  return Math.min(base, 0.80);
}

/** Get skill info for display */
export async function getSkillInfo(db: any, skillId: string) {
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.id, skillId))
    .limit(1);

  return skill || null;
}
