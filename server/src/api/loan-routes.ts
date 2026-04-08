import type { FastifyInstance } from 'fastify';
import {
  createLoanRequest,
  acceptLoan,
  repayLoan,
  checkDefaults,
  getUserLoans,
  cancelLoanRequest,
  forceCollection,
  getOpenLoanRequests,
  getLoanById,
} from '../services/loan/loan-service';

export async function loanRoutes(fastify: FastifyInstance) {
  // POST /api/loans/request - borrower creates loan request
  fastify.post<{ Body: { borrowerId: string; amount: number; interestRate: number; termMinutes: number; collateralType?: string; collateralId?: string } }>(
    '/api/loans/request',
    async (request) => {
      const db = (fastify as any).db;
      const {
        borrowerId,
        amount,
        interestRate,
        termMinutes,
        collateralType,
        collateralId,
      } = request.body;

      if (!borrowerId || amount <= 0 || interestRate < 0 || termMinutes < 10) {
        return { success: false, error: 'Invalid parameters' };
      }

      const loanId = await createLoanRequest(
        db,
        borrowerId,
        amount,
        interestRate,
        termMinutes,
        collateralType,
        collateralId,
      );

      return { success: true, loanId };
    },
  );

  // POST /api/loans/:id/accept - lender accepts open loan request
  fastify.post<{ Params: { id: string }; Body: { lenderId: string } }>(
    '/api/loans/:id/accept',
    async (request) => {
      const db = (fastify as any).db;
      const { id } = request.params;
      const { lenderId } = request.body;

      const success = await acceptLoan(db, id, lenderId);
      return { success };
    },
  );

  // POST /api/loans/:id/cancel - borrower cancels open loan request
  fastify.post<{ Params: { id: string }; Body: { borrowerId: string } }>(
    '/api/loans/:id/cancel',
    async (request) => {
      const db = (fastify as any).db;
      const { id } = request.params;
      const { borrowerId } = request.body;

      const success = await cancelLoanRequest(db, id, borrowerId);
      return { success };
    },
  );

  // POST /api/loans/:id/repay - borrower repays loan (partial or full)
  fastify.post<{ Params: { id: string }; Body: { amount: number } }>(
    '/api/loans/:id/repay',
    async (request) => {
      const db = (fastify as any).db;
      const { id } = request.params;
      const { amount } = request.body;

      const success = await repayLoan(db, id, amount);
      return { success };
    },
  );

  // POST /api/loans/:id/collect - lender forces collection on defaulted loan
  fastify.post<{ Params: { id: string }; Body: { lenderId: string } }>(
    '/api/loans/:id/collect',
    async (request) => {
      const db = (fastify as any).db;
      const { id } = request.params;
      const { lenderId } = request.body;

      const success = await forceCollection(db, id, lenderId);
      return { success };
    },
  );

  // GET /api/loans/board - list open loan requests (public board)
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/loans/board',
    async (request) => {
      const db = (fastify as any).db;
      const limit = parseInt(request.query.limit || '100', 10);

      const loans = await getOpenLoanRequests(db, limit);
      return { loans };
    },
  );

  // GET /api/loans/:userId - user's loans (as borrower and lender)
  fastify.get<{ Params: { userId: string } }>(
    '/api/loans/user/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const { userId } = request.params;

      const loans = await getUserLoans(db, userId);
      return { loans };
    },
  );

  // POST /api/loans/check-defaults - check and mark overdue loans (admin/scheduler)
  fastify.post('/api/loans/check-defaults', async () => {
    const db = (fastify as any).db;
    const count = await checkDefaults(db);
    return { defaultsDetected: count };
  });
}
