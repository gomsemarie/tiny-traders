import { eq } from 'drizzle-orm';
import { characters, characterTemplates } from '../../db/schema';

export type Trait = 'yolo' | 'steady' | 'neutral';

export interface TraitBuff {
  active: boolean;
  dominantTrait: Trait | null;
  buffDescription: string;
  statBonus: Record<string, number>;
}

const TRAIT_BUFFS: Record<Trait, { description: string; bonus: Record<string, number> }> = {
  yolo: {
    description: '한탕충 다수결: 행동력 +2, 자제력 -1',
    bonus: { initiative: 2, discipline: -1 },
  },
  steady: {
    description: '월급충 다수결: 자제력 +2, 행동력 -1',
    bonus: { discipline: 2, initiative: -1 },
  },
  neutral: {
    description: '중립 다수결: 운 +1',
    bonus: { luck: 1 },
  },
};

/**
 * Check trait majority among placed characters.
 * If more than half share the same trait, apply group buff.
 */
export async function evaluateTraitBuff(db: any, userId: string): Promise<TraitBuff> {
  // Get all placed characters (slotIndex is not null)
  const charList = await db
    .select({
      id: characters.id,
      templateId: characters.templateId,
      slotIndex: characters.slotIndex,
    })
    .from(characters)
    .where(eq(characters.ownerId, userId));

  const placed = charList.filter((c: { slotIndex: null | number }) => c.slotIndex !== null);
  if (placed.length === 0) {
    return { active: false, dominantTrait: null, buffDescription: '', statBonus: {} };
  }

  // Get traits from templates
  const traitCounts: Record<Trait, number> = { yolo: 0, steady: 0, neutral: 0 };

  for (const char of placed) {
    const [template] = await db
      .select()
      .from(characterTemplates)
      .where(eq(characterTemplates.id, char.templateId))
      .limit(1);

    if (template) {
      const trait = (template.trait as Trait) || 'neutral';
      traitCounts[trait]++;
    }
  }

  // Find majority (> 50%)
  const total = placed.length;
  let dominantTrait: Trait | null = null;

  for (const [trait, count] of Object.entries(traitCounts)) {
    if (count > total / 2) {
      dominantTrait = trait as Trait;
      break;
    }
  }

  if (!dominantTrait) {
    return { active: false, dominantTrait: null, buffDescription: '다수결 미달성', statBonus: {} };
  }

  const buff = TRAIT_BUFFS[dominantTrait];
  return {
    active: true,
    dominantTrait,
    buffDescription: buff.description,
    statBonus: buff.bonus,
  };
}
