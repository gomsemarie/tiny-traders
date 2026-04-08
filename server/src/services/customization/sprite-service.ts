/**
 * 커스텀 스프라이트 검증 및 관리
 * - 스프라이트 데이터 형식 검증 (JSON/Base64)
 * - 크기 및 프레임 수 검증
 * - 유니크 키 생성
 */

export const MAX_SIZE = 32; // 픽셀 단위
export const MAX_FRAMES = 4;
export const MAX_DATA_SIZE = 50000; // 바이트

export interface SpriteData {
  width: number;
  height: number;
  frames: number;
  data: string; // base64 encoded
}

/**
 * 스프라이트 데이터 검증
 * - 유효한 JSON 구조
 * - 바이트 크기 <= 50KB
 * - 가로/세로 32px
 * - 프레임 <= 4
 */
export function validateSpriteData(data: string): { valid: boolean; error?: string } {
  try {
    // 크기 검증 (Base64 인코딩 기준)
    if (Buffer.byteLength(data, 'utf8') > MAX_DATA_SIZE) {
      return { valid: false, error: `Sprite data too large (max ${MAX_DATA_SIZE} bytes)` };
    }

    // JSON 파싱 시도
    let spriteObj: unknown;
    try {
      spriteObj = JSON.parse(data);
    } catch {
      // Base64로 시도
      try {
        const decoded = Buffer.from(data, 'base64').toString('utf8');
        spriteObj = JSON.parse(decoded);
      } catch {
        return { valid: false, error: 'Invalid JSON or Base64 format' };
      }
    }

    if (typeof spriteObj !== 'object' || spriteObj === null) {
      return { valid: false, error: 'Sprite data must be an object' };
    }

    const sprite = spriteObj as Record<string, unknown>;

    // 필수 필드 검증
    if (typeof sprite.width !== 'number' || typeof sprite.height !== 'number') {
      return { valid: false, error: 'Missing or invalid width/height' };
    }

    if (typeof sprite.frames !== 'number') {
      return { valid: false, error: 'Missing or invalid frames' };
    }

    // 치수 검증
    if (sprite.width !== MAX_SIZE || sprite.height !== MAX_SIZE) {
      return {
        valid: false,
        error: `Sprite dimensions must be ${MAX_SIZE}x${MAX_SIZE} (got ${sprite.width}x${sprite.height})`,
      };
    }

    // 프레임 수 검증
    if (sprite.frames < 1 || sprite.frames > MAX_FRAMES) {
      return {
        valid: false,
        error: `Frame count must be 1-${MAX_FRAMES} (got ${sprite.frames})`,
      };
    }

    // 데이터 필드 검증
    if (typeof sprite.data !== 'string') {
      return { valid: false, error: 'Missing or invalid data field' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Validation error: ${String(error)}` };
  }
}

/**
 * 스프라이트 유니크 키 생성
 * userId + name 조합으로 생성
 */
export function encodeSpriteKey(userId: string, name: string): string {
  // URL-safe Base64 인코딩
  const combined = `${userId}:${name}`;
  return Buffer.from(combined, 'utf8').toString('base64').replace(/[+/=]/g, (c) => {
    const map: Record<string, string> = { '+': '-', '/': '_', '=': '' };
    return map[c] || c;
  });
}

/**
 * 스프라이트 키 디코딩
 */
export function decodeSpriteKey(spriteKey: string): { userId: string; name: string } | null {
  try {
    // URL-safe Base64 디코딩
    const normalized = spriteKey
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(spriteKey.length + ((4 - (spriteKey.length % 4)) % 4), '=');

    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    const [userId, name] = decoded.split(':');

    if (!userId || !name) return null;
    return { userId, name };
  } catch {
    return null;
  }
}
