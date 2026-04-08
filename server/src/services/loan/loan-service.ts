import { eq, and, gt, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { loanRequests, users } from '../../db/schema';

export interface Loan {
  id: string;
  borrowerId: string;
  lenderId: string | null;
  amount: number;
  interestRate: number;
  termDays: number; // 분 단위
  collateralType?: string;
  collateralId?: string;
  status: 'open' | 'active' | 'repaid' | 'defaulted' | 'collecting';
  repaidAmount: number;
  defaultCount: number;
  isOverdue: boolean;
  createdAt: Date;
  dueAt: Date | null;
}

/**
 * Create a new loan request
 * termDays는 분 단위로 해석됨 (10분 ~ 24시간 = 10 ~ 1440분)
 */
export async function createLoanRequest(
  db: any,
  borrowerId: string,
  amount: number,
  interestRate: number,
  termMinutes: number,
  collateralType?: string,
  collateralId?: string,
): Promise<string> {
  const id = randomUUID();

  await db.insert(loanRequests).values({
    id,
    borrowerId,
    amount,
    interestRate, // 무제한 (사용자 제안, 대출자 결정)
    termDays: termMinutes, // DB에는 분 단위로 저장
    collateralType: collateralType || 'none',
    collateralId: collateralId || null,
    status: 'open',
    repaidAmount: 0,
    defaultCount: 0,
    isOverdue: false,
    createdAt: new Date(),
    dueAt: null,
  });

  return id;
}

/**
 * Accept a loan request and transfer gold to borrower
 * termDays는 분 단위로 해석되어 dueAt 계산
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

  // Set due date (termMinutes from now, converting minutes to milliseconds)
  const dueAt = new Date();
  dueAt.setTime(dueAt.getTime() + loan.termDays * 60 * 1000); // term_days is in minutes

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
      isOverdue: false,
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
 * Check for overdue loans and apply consequences
 * 연체 이자: 원래 이자율 × 1.5
 * 강제 회수 cascade: 현금 → 적금 강제 해지 → 담보 압류
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
    // Apply overdue interest multiplier
    const overdueInterestRate = loan.interestRate * 1.5;

    await db
      .update(loanRequests)
      .set({
        defaultCount: loan.defaultCount + 1,
        status: 'defaulted',
        isOverdue: true,
        interestRate: overdueInterestRate, // Update to overdue rate
      })
      .where(eq(loanRequests.id, loan.id));
    count++;
  }

  return count;
}

/**
 * Cancel a loan request before lender accepts
 */
export async function cancelLoanRequest(db: any, loanId: string, borrowerId: string): Promise<boolean> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, loanId))
    .limit(1);

  if (!loan || loan.borrowerId !== borrowerId || loan.status !== 'open') {
    return false;
  }

  await db
    .update(loanRequests)
    .set({ status: 'cancelled' })
    .where(eq(loanRequests.id, loanId));

  return true;
}

/**
 * Lender forces collection on defaulted loan
 * 담보 유형에 따라 다른 조치:
 * - facility: 50% 가격으로 강제 판매, 수익금은 대출자에게
 * - item/character: 소유권 이전
 */
export async function forceCollection(db: any, loanId: string, lenderId: string): Promise<boolean> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, loanId))
    .limit(1);

  if (!loan || loan.lenderId !== lenderId || loan.status !== 'defaulted') {
    return false;
  }

  // Calculate total debt with overdue interest
  const totalDue = loan.amount * (1 + loan.interestRate);
  const remaining = totalDue - loan.repaidAmount;

  if (remaining <= 0) {
    // Already paid off somehow
    await db
      .update(loanRequests)
      .set({ status: 'repaid' })
      .where(eq(loanRequests.id, loanId));
    return true;
  }

  // Try to collect: cash -> savings force cancel -> collateral seizure
  const [borrower] = await db
    .select()
    .from(users)
    .where(eq(users.id, loan.borrowerId))
    .limit(1);

  if (!borrower) {
    return false;
  }

  let collected = 0;

  // Step 1: Try to take remaining gold
  const goldToTake = Math.min(borrower.gold, remaining);
  if (goldToTake > 0) {
    await db
      .update(users)
      .set({ gold: borrower.gold - goldToTake })
      .where(eq(users.id, borrower.id));

    const [lender] = await db
      .select()
      .from(users)
      .where(eq(users.id, lenderId))
      .limit(1);

    if (lender) {
      await db
        .update(users)
        .set({ gold: lender.gold + goldToTake })
        .where(eq(users.id, lenderId));
    }

    collected += goldToTake;
  }

  // Step 2: Handle collateral seizure based on type
  if (collected < remaining && loan.collateralId && loan.collateralType !== 'none') {
    // This would need integration with facility/item/character services
    // For now, mark as collecting
    await db
      .update(loanRequests)
      .set({
        status: 'collecting',
        repaidAmount: loan.repaidAmount + collected,
      })
      .where(eq(loanRequests.id, loanId));

    return true;
  }

  // Update repaidAmount and status
  const newRepaidAmount = loan.repaidAmount + collected;
  const isFullRepayment = newRepaidAmount >= totalDue;

  await db
    .update(loanRequests)
    .set({
      repaidAmount: newRepaidAmount,
      status: isFullRepayment ? 'repaid' : 'collecting',
    })
    .where(eq(loanRequests.id, loanId));

  return true;
}

/**
 * Apply salary garnishment: 50% of future income until debt repaid
 * This is called when processing job rewards
 */
export async function applySalaryGarnishment(db: any, borrowerId: string, jobReward: number): Promise<number> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(
      and(
        eq(loanRequests.borrowerId, borrowerId),
        eq(loanRequests.status, 'active'),
      ),
    )
    .limit(1);

  if (!loan) {
    return jobReward; // No active loan, return full reward
  }

  const totalDue = loan.amount * (1 + loan.interestRate);
  const remaining = totalDue - loan.repaidAmount;

  if (remaining <= 0) {
    return jobReward; // Loan already repaid
  }

  // Take 50% of reward
  const garnished = Math.floor(jobReward * 0.5);
  const garnishAmount = Math.min(garnished, remaining);

  // Transfer to lender
  const [lender] = await db
    .select()
    .from(users)
    .where(eq(users.id, loan.lenderId))
    .limit(1);

  if (lender) {
    await db
      .update(users)
      .set({ gold: lender.gold + garnishAmount })
      .where(eq(users.id, lender.id));
  }

  // Update repaid amount
  const newRepaidAmount = loan.repaidAmount + garnishAmount;
  const isFullRepayment = newRepaidAmount >= totalDue;

  await db
    .update(loanRequests)
    .set({
      repaidAmount: newRepaidAmount,
      status: isFullRepayment ? 'repaid' : 'active',
    })
    .where(eq(loanRequests.id, loan.id));

  return jobReward - garnishAmount;
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

/**
 * Get open loan requests (board listing)
 */
export async function getOpenLoanRequests(db: any, limit: number = 100): Promise<Loan[]> {
  const loans = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.status, 'open'))
    .limit(limit);

  return loans;
}

/**
 * Get loan by ID with borrower and lender details
 */
export async function getLoanById(db: any, loanId: string): Promise<any | null> {
  const [loan] = await db
    .select()
    .from(loanRequests)
    .where(eq(loanRequests.id, loanId))
    .limit(1);

  if (!loan) {
    return null;
  }

  // Fetch borrower and lender details
  const [borrower] = await db.select().from(users).where(eq(users.id, loan.borrowerId)).limit(1);
  const [lender] = loan.lenderId ? await db.select().from(users).where(eq(users.id, loan.lenderId)).limit(1) : [null];

  return {
    ...loan,
    borrower: borrower ? { id: borrower.id, username: borrower.username, displayName: borrower.displayName } : null,
    lender: lender ? { id: lender.id, username: lender.username, displayName: lender.displayName } : null,
  };
}
