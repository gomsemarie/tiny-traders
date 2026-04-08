import type { FastifyInstance } from 'fastify';
import {
  registerUser,
  loginUser,
  getUserByToken,
  approveUser,
  rejectUser,
  getPendingUsers,
  getAllUsers,
  verifyToken,
} from '../services/auth/auth-service';

/** 토큰에서 유저 인증 헬퍼 */
function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return authHeader;
}

export async function authRoutes(fastify: FastifyInstance) {
  // ─── 회원가입 요청 ───
  fastify.post<{ Body: { username: string; password: string; displayName: string } }>(
    '/api/auth/register',
    async (request, reply) => {
      const { username, password, displayName } = request.body;
      if (!username || !password || !displayName) {
        return reply.code(400).send({ error: '모든 필드를 입력해주세요.' });
      }
      const db = (fastify as any).db;
      const result = await registerUser(db, username, password, displayName);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return reply.code(201).send({
        success: true,
        message: '가입 요청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
        userId: result.userId,
      });
    },
  );

  // ─── 로그인 ───
  fastify.post<{ Body: { username: string; password: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { username, password } = request.body;
      if (!username || !password) {
        return reply.code(400).send({ error: '아이디와 비밀번호를 입력해주세요.' });
      }
      const db = (fastify as any).db;
      const result = await loginUser(db, username, password);
      if (!result.success) {
        return reply.code(401).send({ error: result.error });
      }
      return { success: true, token: result.token, user: result.user };
    },
  );

  // ─── 내 정보 조회 ───
  fastify.get('/api/auth/me', async (request, reply) => {
    const token = extractToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: '인증이 필요합니다.' });
    }
    const db = (fastify as any).db;
    const user = await getUserByToken(db, token);
    if (!user) {
      return reply.code(401).send({ error: '유효하지 않은 토큰입니다.' });
    }
    return { user };
  });

  // ─── 관리자: 대기 중인 유저 목록 ───
  fastify.get('/api/auth/pending', async (request, reply) => {
    const token = extractToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: '인증이 필요합니다.' });
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
    }
    const db = (fastify as any).db;
    const pending = await getPendingUsers(db);
    return {
      users: pending.map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        createdAt: u.createdAt,
      })),
    };
  });

  // ─── 관리자: 전체 유저 목록 ───
  fastify.get('/api/auth/users', async (request, reply) => {
    const token = extractToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: '인증이 필요합니다.' });
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
    }
    const db = (fastify as any).db;
    const allUsersList = await getAllUsers(db);
    return { users: allUsersList };
  });

  // ─── 관리자: 가입 승인 ───
  fastify.post<{ Params: { userId: string } }>(
    '/api/auth/approve/:userId',
    async (request, reply) => {
      const token = extractToken(request.headers.authorization);
      if (!token) return reply.code(401).send({ error: '인증이 필요합니다.' });
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'admin') {
        return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
      }
      const db = (fastify as any).db;
      const result = await approveUser(db, request.params.userId);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return { success: true, message: '승인되었습니다.' };
    },
  );

  // ─── 관리자: 가입 거절 ───
  fastify.post<{ Params: { userId: string }; Body: { reason?: string } }>(
    '/api/auth/reject/:userId',
    async (request, reply) => {
      const token = extractToken(request.headers.authorization);
      if (!token) return reply.code(401).send({ error: '인증이 필요합니다.' });
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'admin') {
        return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
      }
      const db = (fastify as any).db;
      const result = await rejectUser(db, request.params.userId, request.body?.reason);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return { success: true, message: '거절되었습니다.' };
    },
  );
}
