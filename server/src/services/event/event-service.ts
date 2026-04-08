import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { eventHistory } from '../../db/schema';

export type EventType = 'investment' | 'labor' | 'facility' | 'character' | 'economy' | 'special';

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description?: string;
  effectJson?: Record<string, unknown>;
  startedAt: Date;
  endsAt: Date;
}

const EVENT_POOL: Array<{
  type: EventType;
  name: string;
  description: string;
  effects: Record<string, unknown>;
}> = [
  {
    type: 'investment',
    name: 'Bull Market',
    description: 'Stock prices are rising',
    effects: { priceMultiplier: 1.2 },
  },
  {
    type: 'investment',
    name: 'Market Crash',
    description: 'Stock prices are falling',
    effects: { priceMultiplier: 0.8 },
  },
  {
    type: 'labor',
    name: 'Job Bonus',
    description: 'Jobs pay more gold today',
    effects: { goldMultiplier: 1.5 },
  },
  {
    type: 'labor',
    name: 'Labor Strike',
    description: 'Reduced job availability',
    effects: { jobAvailability: 0.5 },
  },
  {
    type: 'facility',
    name: 'Building Boom',
    description: 'Facility construction is faster',
    effects: { buildTimeMultiplier: 0.7 },
  },
  {
    type: 'character',
    name: 'Character Awakening',
    description: 'Characters gain bonus experience',
    effects: { expMultiplier: 1.5 },
  },
  {
    type: 'economy',
    name: 'Economic Growth',
    description: 'Gold rewards increased across the board',
    effects: { globalGoldMultiplier: 1.2 },
  },
  {
    type: 'special',
    name: 'Meteor Shower',
    description: 'Rare items appear from the sky',
    effects: { specialDropRate: 10 },
  },
];

/**
 * Generate a random event with 30-minute duration
 */
export async function generateRandomEvent(db: any): Promise<GameEvent> {
  const event = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  const id = randomUUID();
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + 30 * 60 * 1000); // 30 minutes

  await db.insert(eventHistory).values({
    id,
    type: event.type,
    name: event.name,
    description: event.description,
    effectJson: event.effects,
    startedAt,
    endsAt,
  });

  return {
    id,
    type: event.type,
    name: event.name,
    description: event.description,
    effectJson: event.effects,
    startedAt,
    endsAt,
  };
}

/**
 * Get all currently active events
 */
export async function getActiveEvents(db: any): Promise<GameEvent[]> {
  const now = new Date();
  const events = await db
    .select()
    .from(eventHistory);

  // Filter in-memory since Drizzle timestamp comparison can be tricky
  return events.filter((e: any) => {
    const endsAtTime = e.endsAt instanceof Date ? e.endsAt.getTime() : e.endsAt;
    return endsAtTime > now.getTime();
  });
}

/**
 * Delete expired events
 */
export async function cleanupExpiredEvents(db: any): Promise<number> {
  const now = new Date();
  const expired = await db
    .select()
    .from(eventHistory);

  let count = 0;
  const toDelete = expired.filter((e: any) => {
    const endsAtTime = e.endsAt instanceof Date ? e.endsAt.getTime() : e.endsAt;
    return endsAtTime < now.getTime();
  });

  for (const event of toDelete) {
    await db
      .delete(eventHistory)
      .where(eq(eventHistory.id, event.id));
    count++;
  }

  return count;
}
