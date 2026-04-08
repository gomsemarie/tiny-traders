import { eq, and, gt, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { loanRequests, users } from '../../db/schema';

export interface Loan {
  id: string;
  borrowerId: string;
  lenderId: string | null;
  amount: number;
  interestRate: number;
  termDays: number;
  collateralType?: string;
  collateralId?: string;
  status: 'open' | 'active' | 'repaid' | 'defaulted' | 'collecting';
  repaidAmount: number;
  defaultCount: number;
  createdAt: Date;
  dueAt: Date | null;
}

/**
 * Create a new loan request
 */
export async function createLoanRequest(
  db: any,
  borrowerId: string,
  amount: number,
  interestRate: number,
  termDays: number,
  collateralType?: string,
  collateralId?: string,
): Promise<string> {
  const id = randomUUID();

  await db.insert(loanRequests).values({
    id,
    borrowerId,
    amount,
    interestRate,
    termDays,
    collateralType: collateralType || 'none',
    collateralId: collateralId || null,
    status: 'open',
    repaidAmount: 0,
    defaultCount: 0,
    createdAt: new Date(),
    dueAt: null,
  });

  return id;
}

/**
 * Accept a loan request and transfer gold to borrower
 */
export async function acceptLoan(db: any, loanId: string, lenderId: string): Promise<boolean> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, loanId))
    .limit(1);

  if (!loan || loan.status !== 'open') {
    return false;
  }

  const [lender] = await db
    .select()
    .from(users)
    .where(eq(users.id, lenderId))
    .limit(1);

  if (!lender || lender.gold < loan.amount) {
    return false;
  }

  // Set due date (term_days from now)
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + loan.termDays);

  // Transfer gold: lender -> borrower
  await db
    .update(users)
    .set({ gold: lender.gold - loan.amount })
    .where(eq(users.id, lenderId));

  const [borrower] = await db
    .select()
    .from(users)
    .where(eq(users.id, loan.borrowerId))
    .limit(1);

  await db
    .update(users)
    .set({ gold: borrower.gold + loan.amount })
    .where(eq(users.id, loan.borrowerId));

  // Update loan status
  await db
    .update(loanRequests)
    .set({
      lenderId,
      status: 'active',
      dueAt,
    })
    .where(eq(loanRequests.id, loanId));

  return true;
}

/**
 * Repay loan (partial or full)
 */
export async function repayLoan(db: any, loanId: string, amount: number): Promise<boolean> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, loanId))
    .limit(1);

  if (!loan || loan.status !== 'active') {
    return false;
  }

  // Total to repay = principal + interest
  const totalDue = loan.amount * (1 + loan.interestRate);
  const remaining = totalDue - loan.repaidAmount;

  if (amount > remaining) {
    return false;
  }

  const newRepaidAmount = loan.repaidAmount + amount;
  const isFullRepayment = newRepaidAmount >= totalDue;

  // Transfer gold: borrower -> lender
  const [borrower] = await db
    .select()
    .from(users)
    .where(eq(users.id, loan.borrowerId))
    .limit(1);

  if (!borrower || borrower.gold < amount) {
    return false;
  }

  await db
    .update(users)
    .set({ gold: borrower.gold - amount })
    .where(eq(users.id, loan.borrowerId));

  const [lender] = await db
    .select()
    .from(users)
    .where(eq(users.id, loan.lenderId))
    .limit(1);

  await db
    .update(users)
    .set({ gold: lender.gold + amount })
    .where(eq(users.id, loan.lenderId));

  // Update loan
  await db
    .update(loanRequests)
    .set({
      repaidAmount: newRepaidAmount,
      status: isFullRepayment ? 'repaid' : 'active',
    })
    .where(eq(loanRequests.id, loanId));

  return true;
}

/**
 * Check for overdue loans and increment default_count
 */
export async function checkDefaults(db: any): Promise<number> {
  const now = new Date();
  const overdue = await db
    .select()
    .from(loanRequests)
    .where(
      and(
        eq(loanRequests.status, 'active'),
        lt(loanRequests.dueAt, now),
      ),
    );

  let count = 0;
  for (const loan of overdue) {
    await db
      .update(loanRequests)
      .set({
        defaultCount: loan.defaultCount + 1,
        status: 'defaulted',
      })
      .where(eq(loanRequests.id, loan.id));
    count++;
  }

  return count;
}

/**
 * Get all loans involving a user (as borrower or lender)
 */
export async function getUserLoans(db: any, userId: string): Promise<Loan[]> {
  const borrowerLoans = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.borrowerId, userId));

  const lenderLoans = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.lenderId, userId));

  return [...borrowerLoans, ...lenderLoans];
}
