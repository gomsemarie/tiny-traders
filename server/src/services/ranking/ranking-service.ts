import { desc, eq } from 'drizzle-orm';
import { users } from '../../db/schema';

export type RankingType = 'net_worth' | 'gold' | 'level';

export interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  value: number;
}

/**
 * Get rankings by type (simplified - uses users.gold for net_worth)
 * Real net_worth would require portfolio valuation with quote data
 */
export async function getRankings(
  db: any,
  type: RankingType,
  limit: number = 100,
): Promise<Ranking[]> {
  let query: any;

  if (type === 'net_worth' || type === 'gold') {
    // Both use gold field for now
    query = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        value: users.gold,
      })
      .from(users)
      .orderBy(desc(users.gold))
      .limit(limit);
  } else if (type === 'level') {
    // TODO: Implement when character level is available
    query = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        value: users.gold, // placeholder
      })
      .from(users)
      .orderBy(desc(users.gold))
      .limit(limit);
  }

  return query.map((row: any, idx: number) => ({
    rank: idx + 1,
    userId: row.userId,
    displayName: row.displayName,
    value: row.value,
  }));
}

/**
 * Get user's position in ranking
 */
export async function getUserRank(
  db: any,
  userId: string,
  type: RankingType,
): Promise<number | null> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user[0]) {
    return null;
  }

  const value = type === 'level' ? 0 : user[0].gold; // level not tracked yet

  const rankings = await getRankings(db, type, 10000);
  const userRanking = rankings.find((r) => r.userId === userId);

  return userRanking ? userRanking.rank : null;
}
