import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { marketListings, users, characters, inventory } from '../../db/schema';

export type ListingType = 'character' | 'item';

export interface Listing {
  id: string;
  sellerId: string;
  type: ListingType;
  targetId: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: Date;
}

/**
 * Create a market listing
 */
export async function createListing(
  db: any,
  sellerId: string,
  type: ListingType,
  targetId: string,
  price: number,
): Promise<string> {
  // Verify ownership
  if (type === 'character') {
    const [char] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, targetId))
      .limit(1);

    if (!char || char.ownerId !== sellerId) {
      throw new Error('Character not owned by seller');
    }
  } else if (type === 'item') {
    const [item] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, targetId))
      .limit(1);

    if (!item || item.ownerId !== sellerId) {
      throw new Error('Item not owned by seller');
    }
  }

  const id = randomUUID();

  await db.insert(marketListings).values({
    id,
    sellerId,
    type,
    targetId,
    price,
    status: 'active',
    createdAt: new Date(),
  });

  return id;
}

/**
 * Buy a listing
 */
export async function buyListing(db: any, listingId: string, buyerId: string): Promise<boolean> {
  const [listing] = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.id, listingId))
    .limit(1);

  if (!listing || listing.status !== 'active') {
    return false;
  }

  const [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.id, buyerId))
    .limit(1);

  if (!buyer || buyer.gold < listing.price) {
    return false;
  }

  const [seller] = await db
    .select()
    .from(users)
    .where(eq(users.id, listing.sellerId))
    .limit(1);

  if (!seller) {
    return false;
  }

  // Transfer gold
  await db
    .update(users)
    .set({ gold: buyer.gold - listing.price })
    .where(eq(users.id, buyerId));

  await db
    .update(users)
    .set({ gold: seller.gold + listing.price })
    .where(eq(users.id, listing.sellerId));

  // Transfer ownership
  if (listing.type === 'character') {
    await db
      .update(characters)
      .set({ ownerId: buyerId })
      .where(eq(characters.id, listing.targetId));
  } else if (listing.type === 'item') {
    await db
      .update(inventory)
      .set({ ownerId: buyerId })
      .where(eq(inventory.id, listing.targetId));
  }

  // Mark listing as sold
  await db
    .update(marketListings)
    .set({ status: 'sold' })
    .where(eq(marketListings.id, listingId));

  return true;
}

/**
 * Cancel a listing
 */
export async function cancelListing(db: any, listingId: string): Promise<boolean> {
  const [listing] = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.id, listingId))
    .limit(1);

  if (!listing || listing.status !== 'active') {
    return false;
  }

  await db
    .update(marketListings)
    .set({ status: 'cancelled' })
    .where(eq(marketListings.id, listingId));

  return true;
}

/**
 * Get active market listings
 */
export async function getActiveListings(
  db: any,
  type?: ListingType,
  limit: number = 100,
): Promise<Listing[]> {
  let query = db
    .select()
    .from(marketListings)
    .where(eq(marketListings.status, 'active'));

  if (type) {
    query = db
      .select()
      .from(marketListings)
      .where(and(
        eq(marketListings.status, 'active'),
        eq(marketListings.type, type),
      ));
  }

  return query.limit(limit);
}
