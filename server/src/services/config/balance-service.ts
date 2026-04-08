/**
 * 게임 설정 및 밸런스 서비스
 * - 게임 설정 조회/수정
 * - 밸런스 프리셋 관리
 */
import { eq } from 'drizzle-orm';
import { gameConfig } from '../../db/schema';

export interface GameConfigEntry {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}

/**
 * 게임 설정값 조회
 */
export async function getConfig(
  db: any,
  key: string
): Promise<string | null> {
  const [entry] = await db
    .select()
    .from(gameConfig)
    .where(eq(gameConfig.key, key))
    .limit(1);

  return entry?.value ?? null;
}

/**
 * 게임 설정값 저장/수정
 */
export async function setConfig(
  db: any,
  key: string,
  value: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getConfig(db, key);

    if (existing === null) {
      await db.insert(gameConfig).values({
        key,
        value,
        description,
        updatedAt: new Date(),
      });
    } else {
      await db
        .update(gameConfig)
        .set({
          value,
          description: description || undefined,
          updatedAt: new Date(),
        })
        .where(eq(gameConfig.key, key));
    }

    return { success: true };
  } catch (error) {
    console.error('setConfig error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 모든 게임 설정 조회
 */
export async function getAllConfigs(db: any): Promise<GameConfigEntry[]> {
  return db.select().from(gameConfig);
}

/**
 * 밸런스 프리셋 (기본값 포함)
 */
export interface BalancePreset {
  maxCharactersPerUser: number;
  maxFacilitiesPerUser: number;
  initialGold: number;
  levelUpExperienceRequired: number;
  characterDissolutionRefundRate: number;
  tradeFeeRate: number;
  loanMaxInterestRate: number;
  savingsMinInterestRate: number;
  gachaNRate: number;
  gacharRate: number;
  gachaSRRate: number;
  gachaSSRRate: number;
  gachaURRate: number;
}

const DEFAULT_BALANCE: BalancePreset = {
  maxCharactersPerUser: 12,
  maxFacilitiesPerUser: 20,
  initialGold: 10000,
  levelUpExperienceRequired: 1000,
  characterDissolutionRefundRate: 0.8,
  tradeFeeRate: 0.001,
  loanMaxInterestRate: 0.3,
  savingsMinInterestRate: 0.05,
  gachaNRate: 0.50,
  gacharRate: 0.30,
  gachaSRRate: 0.15,
  gachaSSRRate: 0.04,
  gachaURRate: 0.01,
};

/**
 * 밸런스 프리셋 조회 (기본값 포함)
 */
export async function getBalancePreset(db: any): Promise<BalancePreset> {
  const configs = await getAllConfigs(db);
  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  return {
    maxCharactersPerUser: parseInt(configMap.get('max_characters_per_user') ?? String(DEFAULT_BALANCE.maxCharactersPerUser), 10),
    maxFacilitiesPerUser: parseInt(configMap.get('max_facilities_per_user') ?? String(DEFAULT_BALANCE.maxFacilitiesPerUser), 10),
    initialGold: parseFloat(configMap.get('initial_gold') ?? String(DEFAULT_BALANCE.initialGold)),
    levelUpExperienceRequired: parseInt(configMap.get('level_up_experience_required') ?? String(DEFAULT_BALANCE.levelUpExperienceRequired), 10),
    characterDissolutionRefundRate: parseFloat(configMap.get('character_dissolution_refund_rate') ?? String(DEFAULT_BALANCE.characterDissolutionRefundRate)),
    tradeFeeRate: parseFloat(configMap.get('trade_fee_rate') ?? String(DEFAULT_BALANCE.tradeFeeRate)),
    loanMaxInterestRate: parseFloat(configMap.get('loan_max_interest_rate') ?? String(DEFAULT_BALANCE.loanMaxInterestRate)),
    savingsMinInterestRate: parseFloat(configMap.get('savings_min_interest_rate') ?? String(DEFAULT_BALANCE.savingsMinInterestRate)),
    gachaNRate: parseFloat(configMap.get('gacha_n_rate') ?? String(DEFAULT_BALANCE.gachaNRate)),
    gacharRate: parseFloat(configMap.get('gacha_r_rate') ?? String(DEFAULT_BALANCE.gacharRate)),
    gachaSRRate: parseFloat(configMap.get('gacha_sr_rate') ?? String(DEFAULT_BALANCE.gachaSRRate)),
    gachaSSRRate: parseFloat(configMap.get('gacha_ssr_rate') ?? String(DEFAULT_BALANCE.gachaSSRRate)),
    gachaURRate: parseFloat(configMap.get('gacha_ur_rate') ?? String(DEFAULT_BALANCE.gachaURRate)),
  };
}
