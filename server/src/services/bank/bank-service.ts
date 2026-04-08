import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { savingsAccounts, users } from '../../db/schema';

export interface SavingsAccount {
  id: string;
  userId: string;
  productName: string;
  principal: number;
  interestRate: number;
  termDays: number;
  status: 'active' | 'matured' | 'cancelled';
  createdAt: Date;
  maturesAt: Date;
}

/**
 * Open a new savings account
 * Deduct principal from user's gold
 */
export async function openSavingsAccount(
  db: any,
  userId: string,
  principal: number,
  productName: string,
  interestRate: number,
  termDays: number,
): Promise<{ accountId: string; error?: string }> {
  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return { accountId: '', error: 'User not found' };
  }

  // Check sufficient gold
  if (user.gold < principal) {
    return { accountId: '', error: 'Insufficient gold' };
  }

  const accountId = randomUUID();
  const now = new Date();
  const maturesAt = new Date(now.getTime() + termDays * 24 * 60 * 60 * 1000);

  try {
    // Create account
    await db.insert(savingsAccounts).values({
      id: accountId,
      userId,
      productName,
      principal,
      interestRate,
      termDays,
      status: 'active',
      createdAt: now,
      maturesAt,
    });

    // Deduct gold
    await db.update(users).set({ gold: user.gold - principal }).where(eq(users.id, userId));

    return { accountId };
  } catch (error) {
    return { accountId: '', error: String(error) };
  }
}

/**
 * Check for matured accounts and add principal + interest to user's gold
 */
export async function matureSavingsAccounts(db: any): Promise<number> {
  const now = new Date();

  // Find all active accounts that have matured
  const maturedAccounts = await db
    .select()
    .from(savingsAccounts)
    .where(eq(savingsAccounts.status, 'active'));

  let processedCount = 0;

  for (const account of maturedAccounts) {
    if (account.maturesAt <= now) {
      try {
        // Calculate interest
        const interest = account.principal * account.interestRate;
        const totalAmount = account.principal + interest;

        // Get user
        const [user] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);

        if (user) {
          // Add principal + interest to gold
          await db.update(users).set({ gold: user.gold + totalAmount }).where(eq(users.id, account.userId));

          // Mark account as matured
          await db.update(savingsAccounts).set({ status: 'matured' }).where(eq(savingsAccounts.id, account.id));

          processedCount++;
        }
      } catch (error) {
        console.error(`Error maturing account ${account.id}:`, error);
      }
    }
  }

  return processedCount;
}

/**
 * Cancel a savings account early (return principal only, no interest)
 */
export async function cancelSavingsAccount(
  db: any,
  accountId: string,
): Promise<{ success: boolean; error?: string }> {
  const [account] = await db
    .select()
    .from(savingsAccounts)
    .where(eq(savingsAccounts.id, accountId))
    .limit(1);

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  if (account.status !== 'active') {
    return { success: false, error: `Account is ${account.status}, cannot cancel` };
  }

  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Return principal only (no interest)
    await db.update(users).set({ gold: user.gold + account.principal }).where(eq(users.id, account.userId));

    // Mark as cancelled
    await db.update(savingsAccounts).set({ status: 'cancelled' }).where(eq(savingsAccounts.id, accountId));

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get all savings accounts for a user
 */
export async function getUserSavings(db: any, userId: string): Promise<SavingsAccount[]> {
  const accounts = await db
    .select()
    .from(savingsAccounts)
    .where(eq(savingsAccounts.userId, userId));

  return accounts.map((a: any) => ({
    id: a.id,
    userId: a.userId,
    productName: a.productName,
    principal: a.principal,
    interestRate: a.interestRate,
    termDays: a.termDays,
    status: a.status,
    createdAt: a.createdAt,
    maturesAt: a.maturesAt,
  }));
}
