import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  userAchievements,
  achievementDefinitions,
  userTitles,
  titleDefinitions,
} from '../../db/schema';

export interface Achievement {
  id: string;
  name: string;
  description?: string;
  iconKey?: string;
}

export interface UserAchievement extends Achievement {
  completedAt: Date;
}

export interface Title {
  id: string;
  name: string;
  description?: string;
  isEquipped: boolean;
  earnedAt: Date;
}

/**
 * Evaluate user stats against achievement conditions
 */
export async function checkAchievements(
  db: any,
  userId: string,
  stats: Record<string, number>,
): Promise<Achievement[]> {
  // Get all achievement definitions
  const achievements = await db
    .select()
    .from(achievementDefinitions);

  const newAchievements: Achievement[] = [];

  for (const def of achievements) {
    // Check if user already has this achievement
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, def.id),
        ),
      )
      .limit(1);

    if (existing) continue; // Already earned

    // Evaluate condition
    if (evaluateCondition(def.conditionJson, stats)) {
      const id = randomUUID();
      await db.insert(userAchievements).values({
        id,
        userId,
        achievementId: def.id,
        completedAt: new Date(),
      });

      newAchievements.push({
        id: def.id,
        name: def.name,
        description: def.description,
        iconKey: def.iconKey,
      });
    }
  }

  return newAchievements;
}

/**
 * Get all achievements earned by user
 */
export async function getUserAchievements(
  db: any,
  userId: string,
): Promise<UserAchievement[]> {
  const records = await db
    .select({
      id: achievementDefinitions.id,
      name: achievementDefinitions.name,
      description: achievementDefinitions.description,
      iconKey: achievementDefinitions.iconKey,
      completedAt: userAchievements.completedAt,
    })
    .from(userAchievements)
    .innerJoin(
      achievementDefinitions,
      eq(userAchievements.achievementId, achievementDefinitions.id),
    )
    .where(eq(userAchievements.userId, userId));

  return records;
}

/**
 * Check title conditions and grant/revoke
 */
export async function checkTitles(
  db: any,
  userId: string,
  stats: Record<string, number>,
): Promise<void> {
  const titles = await db
    .select()
    .from(titleDefinitions);

  for (const def of titles) {
    const [existing] = await db
      .select()
      .from(userTitles)
      .where(
        and(
          eq(userTitles.userId, userId),
          eq(userTitles.titleId, def.id),
        ),
      )
      .limit(1);

    const shouldHave = evaluateCondition(def.conditionJson, stats);

    if (shouldHave && !existing) {
      // Grant title
      const id = randomUUID();
      await db.insert(userTitles).values({
        id,
        userId,
        titleId: def.id,
        isEquipped: false,
        earnedAt: new Date(),
      });
    } else if (!shouldHave && existing) {
      // Revoke title (and unequip if equipped)
      await db
        .delete(userTitles)
        .where(
          and(
            eq(userTitles.userId, userId),
            eq(userTitles.titleId, def.id),
          ),
        );
    }
  }
}

/**
 * Equip a title (unequip others)
 */
export async function equipTitle(db: any, userId: string, titleId: string): Promise<boolean> {
  // Verify user has this title
  const [title] = await db
    .select()
    .from(userTitles)
    .where(
      and(
        eq(userTitles.userId, userId),
        eq(userTitles.titleId, titleId),
      ),
    )
    .limit(1);

  if (!title) return false;

  // Unequip all other titles
  await db
    .update(userTitles)
    .set({ isEquipped: false })
    .where(eq(userTitles.userId, userId));

  // Equip this one
  await db
    .update(userTitles)
    .set({ isEquipped: true })
    .where(
      and(
        eq(userTitles.userId, userId),
        eq(userTitles.titleId, titleId),
      ),
    );

  return true;
}

/**
 * Get user's titles
 */
export async function getUserTitles(db: any, userId: string): Promise<Title[]> {
  const records = await db
    .select({
      id: titleDefinitions.id,
      name: titleDefinitions.name,
      description: titleDefinitions.description,
      isEquipped: userTitles.isEquipped,
      earnedAt: userTitles.earnedAt,
    })
    .from(userTitles)
    .innerJoin(
      titleDefinitions,
      eq(userTitles.titleId, titleDefinitions.id),
    )
    .where(eq(userTitles.userId, userId));

  return records;
}

/**
 * Evaluate condition JSON against stats
 */
function evaluateCondition(condition: Record<string, unknown>, stats: Record<string, number>): boolean {
  const type = condition.type as string;

  switch (type) {
    case 'net_worth_gte':
      return stats.netWorth >= (condition.value as number);
    case 'gold_gte':
      return stats.gold >= (condition.value as number);
    case 'level_gte':
      return stats.level >= (condition.value as number);
    case 'jobs_completed_gte':
      return stats.jobsCompleted >= (condition.value as number);
    default:
      return false;
  }
}
