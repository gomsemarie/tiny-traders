import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  characters,
  characterTemplates,
} from '../../db/schema';

const GRADE_STAT_RANGES: Record<string, [number, number]> = {
  N: [21, 28],
  R: [29, 36],
  SR: [37, 45],
  SSR: [46, 55],
  UR: [56, 63],
};

/** Distribute statTotal randomly among 7 stats (each 1-10) */
function distributeStats(statTotal: number): Record<string, number> {
  const stats = ['stamina', 'efficiency', 'precision', 'mental', 'initiative', 'discipline', 'luck'];
  const values: Record<string, number> = {};

  // Start with minimum 1 for each
  let remaining = statTotal - stats.length; // subtract 7 for minimum 1 each

  for (let i = 0; i < stats.length; i++) {
    values[stats[i]] = 1;
  }

  // Distribute remaining randomly
  while (remaining > 0) {
    const idx = Math.floor(Math.random() * stats.length);
    const stat = stats[idx];
    if (values[stat] < 10) {
      values[stat]++;
      remaining--;
    }
  }

  return values;
}

/** Generate random stat total within grade range */
function randomStatTotal(grade: string): number {
  const [min, max] = GRADE_STAT_RANGES[grade] || [21, 28];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Create a character instance from a template */
export async function createCharacterFromTemplate(
  db: any,
  ownerId: string,
  templateId: string,
): Promise<string> {
  const [template] = await db
    .select()
    .from(characterTemplates)
    .where(eq(characterTemplates.id, templateId))
    .limit(1);

  if (!template) throw new Error(`Template ${templateId} not found`);

  const id = randomUUID();
  await db.insert(characters).values({
    id,
    ownerId,
    templateId,
    level: 1,
    experience: 0,
    condition: template.stamina * 10, // max condition = stamina * 10
    stamina: template.stamina,
    efficiency: template.efficiency,
    precision: template.precision,
    mental: template.mental,
    initiative: template.initiative,
    discipline: template.discipline,
    luck: template.luck,
    activity: 'idle',
    createdAt: new Date(),
  });

  return id;
}

/** Create a random character with given grade (no template, custom) */
export async function createRandomCharacter(
  db: any,
  ownerId: string,
  grade: string,
  name: string,
): Promise<string> {
  const statTotal = randomStatTotal(grade);
  const stats = distributeStats(statTotal);
  const id = randomUUID();

  // Create a template first (custom)
  const templateId = randomUUID();
  await db.insert(characterTemplates).values({
    id: templateId,
    name,
    grade: grade as 'N' | 'R' | 'SR' | 'SSR' | 'UR',
    spriteKey: `custom_${grade.toLowerCase()}`,
    stamina: stats.stamina,
    efficiency: stats.efficiency,
    precision: stats.precision,
    mental: stats.mental,
    initiative: stats.initiative,
    discipline: stats.discipline,
    luck: stats.luck,
    trait: 'neutral',
    createdAt: new Date(),
  });

  await db.insert(characters).values({
    id,
    ownerId,
    templateId,
    level: 1,
    experience: 0,
    condition: stats.stamina * 10,
    stamina: stats.stamina,
    efficiency: stats.efficiency,
    precision: stats.precision,
    mental: stats.mental,
    initiative: stats.initiative,
    discipline: stats.discipline,
    luck: stats.luck,
    activity: 'idle',
    createdAt: new Date(),
  });

  return id;
}

/** Level up a character: lowest stat gets +1, max level 7 */
export async function levelUpCharacter(db: any, characterId: string): Promise<boolean> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) throw new Error(`Character ${characterId} not found`);
  if (char.level >= 7) return false; // already max

  // Find lowest stat
  const statEntries: [string, number][] = [
    ['stamina', char.stamina],
    ['efficiency', char.efficiency],
    ['precision', char.precision],
    ['mental', char.mental],
    ['initiative', char.initiative],
    ['discipline', char.discipline],
    ['luck', char.luck],
  ];
  statEntries.sort((a, b) => a[1] - b[1]);

  // If multiple stats tied at lowest, pick random
  const lowestValue = statEntries[0][1];
  const tiedStats = statEntries.filter(([, v]) => v === lowestValue);
  const [chosenStat] = tiedStats[Math.floor(Math.random() * tiedStats.length)];

  if (statEntries.find(([k]) => k === chosenStat)![1] >= 10) return false; // stat already maxed

  const update: Record<string, number | boolean | string> = {
    level: char.level + 1,
    [chosenStat]: (char as any)[chosenStat] + 1,
  };

  await db.update(characters).set(update as any).where(eq(characters.id, characterId));
  return true;
}

/** Dispose character → generate experience item */
export async function disposeCharacter(db: any, characterId: string): Promise<void> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) throw new Error(`Character ${characterId} not found`);

  // Remove from slot, delete character
  await db.delete(characters).where(eq(characters.id, characterId));

  // TODO Phase 2: Generate 인수인계 문서 (experience item) based on character level/grade
}

/** Get all characters for a user */
export async function getUserCharacters(db: any, userId: string) {
  return db
    .select()
    .from(characters)
    .where(eq(characters.ownerId, userId));
}

/** Get character detail with template info */
export async function getCharacterDetail(db: any, characterId: string) {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) return null;

  const [template] = await db
    .select()
    .from(characterTemplates)
    .where(eq(characterTemplates.id, char.templateId))
    .limit(1);

  return { ...char, template };
}
