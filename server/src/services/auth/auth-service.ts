import { eq } from 'drizzle-orm';
import { randomUUID, createHash } from 'crypto';
import { users } from '../../db/schema/users';

/** 간단한 SHA-256 해싱 (프로덕션에서는 bcrypt 사용 권장) */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/** JWT 대신 간단한 토큰 (HMAC-SHA256) */
const SECRET = process.env.JWT_SECRET || 'tiny-traders-secret-key-change-in-production';

export function createToken(userId: string, role: string): string {
  const payload = JSON.stringify({ userId, role, iat: Date.now() });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = createHash('sha256').update(encoded + SECRET).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    const [encoded, sig] = token.split('.');
    const expectedSig = createHash('sha256').update(encoded + SECRET).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    // 토큰 만료: 7일
    if (Date.now() - payload.iat > 7 * 24 * 60 * 60 * 1000) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

/** 회원가입 요청 (pending 상태로 생성) */
export async function registerUser(
  db: any,
  username: string,
  password: string,
  displayName: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  // 중복 확인
  const existing = await db.select().from(users).where(eq(users.username, username));
  if (existing.length > 0) {
    return { success: false, error: '이미 사용 중인 아이디입니다.' };
  }

  if (username.length < 3 || username.length > 20) {
    return { success: false, error: '아이디는 3~20자여야 합니다.' };
  }
  if (password.length < 4) {
    return { success: false, error: '비밀번호는 4자 이상이어야 합니다.' };
  }
  if (displayName.length < 1 || displayName.length > 20) {
    return { success: false, error: '닉네임은 1~20자여야 합니다.' };
  }

  const userId = randomUUID();
  const passwordHash = hashPassword(password);

  // 첫 번째 유저는 자동으로 admin + approved
  const allUsers = await db.select().from(users);
  const isFirst = allUsers.length === 0;

  await db.insert(users).values({
    id: userId,
    username,
    displayName,
    passwordHash,
    role: isFirst ? 'admin' : 'user',
    status: isFirst ? 'approved' : 'pending',
    isAdmin: isFirst,
    gold: 10000,
    createdAt: new Date(),
  });

  return { success: true, userId };
}

/** 로그인 */
export async function loginUser(
  db: any,
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; token?: string; user?: any }> {
  const result = await db.select().from(users).where(eq(users.username, username));
  if (result.length === 0) {
    return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
  }

  const user = result[0];
  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
  }

  if (user.status === 'pending') {
    return { success: false, error: '가입 승인 대기 중입니다. 관리자의 승인을 기다려주세요.' };
  }
  if (user.status === 'rejected') {
    return { success: false, error: `가입이 거절되었습니다.${user.rejectedReason ? ` 사유: ${user.rejectedReason}` : ''}` };
  }

  // 마지막 로그인 시간 갱신
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const token = createToken(user.id, user.role);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      gold: user.gold,
      isAdmin: user.isAdmin,
    },
  };
}

/** 토큰으로 유저 정보 조회 */
export async function getUserByToken(db: any, token: string): Promise<any | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const result = await db.select().from(users).where(eq(users.id, payload.userId));
  if (result.length === 0) return null;

  const user = result[0];
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    gold: user.gold,
    isAdmin: user.isAdmin,
  };
}

/** 관리자: 가입 승인 */
export async function approveUser(db: any, userId: string): Promise<{ success: boolean; error?: string }> {
  const result = await db.select().from(users).where(eq(users.id, userId));
  if (result.length === 0) return { success: false, error: '유저를 찾을 수 없습니다.' };
  if (result[0].status !== 'pending') return { success: false, error: '대기 상태가 아닙니다.' };

  await db.update(users).set({ status: 'approved' }).where(eq(users.id, userId));
  return { success: true };
}

/** 관리자: 가입 거절 */
export async function rejectUser(
  db: any,
  userId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await db.select().from(users).where(eq(users.id, userId));
  if (result.length === 0) return { success: false, error: '유저를 찾을 수 없습니다.' };
  if (result[0].status !== 'pending') return { success: false, error: '대기 상태가 아닙니다.' };

  await db.update(users).set({ status: 'rejected', rejectedReason: reason ?? null }).where(eq(users.id, userId));
  return { success: true };
}

/** 관리자: 대기 중인 유저 목록 */
export async function getPendingUsers(db: any) {
  return db.select().from(users).where(eq(users.status, 'pending'));
}

/** 관리자: 전체 유저 목록 */
export async function getAllUsers(db: any) {
  return db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    status: users.status,
    isAdmin: users.isAdmin,
    gold: users.gold,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
    rejectedReason: users.rejectedReason,
  }).from(users);
}
