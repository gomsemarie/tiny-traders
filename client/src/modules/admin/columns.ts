import { GridCellKind } from '@glideapps/glide-data-grid';
import type { ColumnDef } from './AdminDataGrid';

/** 캐릭터 템플릿 컬럼 */
export const CHARACTER_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '이름', width: 120 },
  { key: 'grade', title: '등급', width: 80 },
  { key: 'spriteKey', title: '스프라이트', width: 120 },
  { key: 'stamina', title: '체력', width: 60, kind: GridCellKind.Number },
  { key: 'efficiency', title: '효율', width: 60, kind: GridCellKind.Number },
  { key: 'precision', title: '꼼꼼함', width: 70, kind: GridCellKind.Number },
  { key: 'mental', title: '멘탈', width: 60, kind: GridCellKind.Number },
  { key: 'initiative', title: '행동력', width: 70, kind: GridCellKind.Number },
  { key: 'discipline', title: '자제력', width: 70, kind: GridCellKind.Number },
  { key: 'luck', title: '운', width: 50, kind: GridCellKind.Number },
  { key: 'skillId', title: '스킬 ID', width: 150 },
  { key: 'trait', title: '성향', width: 80 },
];

/** 스킬 컬럼 */
export const SKILL_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '이름', width: 120 },
  { key: 'description', title: '설명', width: 200 },
  { key: 'type', title: '유형', width: 100 },
  { key: 'scope', title: '범위', width: 80 },
  { key: 'scopeValue', title: '범위값', width: 70, kind: GridCellKind.Number },
  { key: 'effectJson', title: '효과 JSON', width: 250 },
];

/** 아이템 템플릿 컬럼 */
export const ITEM_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '이름', width: 120 },
  { key: 'description', title: '설명', width: 200 },
  { key: 'type', title: '유형', width: 80 },
  { key: 'rarity', title: '등급', width: 80 },
  { key: 'effectJson', title: '효과 JSON', width: 200 },
  { key: 'recipeJson', title: '레시피 JSON', width: 200 },
  { key: 'sellPrice', title: '판매가', width: 80, kind: GridCellKind.Number },
];

/** 뽑기(가챠) 배너 컬럼 */
export const GACHA_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '배너명', width: 150 },
  { key: 'type', title: '유형', width: 100 },
  { key: 'isActive', title: '활성', width: 60, kind: GridCellKind.Boolean },
  { key: 'ratesJson', title: '확률 JSON', width: 200 },
  { key: 'featuredIds', title: '픽업 캐릭터', width: 200 },
  { key: 'startsAt', title: '시작일', width: 120 },
  { key: 'endsAt', title: '종료일', width: 120 },
];

/** 시설 템플릿 컬럼 */
export const FACILITY_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '이름', width: 120 },
  { key: 'type', title: '유형', width: 100 },
  { key: 'shapeJson', title: '모양 JSON', width: 200 },
  { key: 'maxLevel', title: '최대 등급', width: 80, kind: GridCellKind.Number },
  { key: 'baseCost', title: '건설비용', width: 100, kind: GridCellKind.Number },
  { key: 'buildTime', title: '건설시간(초)', width: 100, kind: GridCellKind.Number },
  { key: 'effectsJson', title: '효과 JSON', width: 250 },
];

/** 거래 가능 종목 컬럼 */
export const TRADABLE_ASSET_COLUMNS: ColumnDef[] = [
  { key: 'symbol', title: '심볼', width: 120 },
  { key: 'name', title: '종목명', width: 150 },
  { key: 'type', title: '유형', width: 80 },
  { key: 'category', title: '카테고리', width: 100 },
  { key: 'feeRate', title: '수수료율', width: 80, kind: GridCellKind.Number },
  { key: 'isActive', title: '활성', width: 60, kind: GridCellKind.Boolean },
];

/** 칭호 정의 컬럼 */
export const TITLE_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '칭호명', width: 120 },
  { key: 'description', title: '설명', width: 200 },
  { key: 'conditionJson', title: '조건 JSON', width: 300 },
];

/** 업적 정의 컬럼 */
export const ACHIEVEMENT_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'name', title: '업적명', width: 120 },
  { key: 'description', title: '설명', width: 200 },
  { key: 'iconKey', title: '아이콘', width: 100 },
  { key: 'conditionJson', title: '조건 JSON', width: 250 },
  { key: 'rewardJson', title: '보상 JSON', width: 200 },
];

/** 게임 설정 컬럼 */
export const GAME_CONFIG_COLUMNS: ColumnDef[] = [
  { key: 'key', title: '설정 키', width: 200 },
  { key: 'value', title: '값 (JSON)', width: 300 },
  { key: 'description', title: '설명', width: 250 },
];

/** 유저 관리 컬럼 */
export const USER_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'username', title: '아이디', width: 120, readonly: true },
  { key: 'displayName', title: '닉네임', width: 120 },
  { key: 'isAdmin', title: '관리자', width: 70, kind: GridCellKind.Boolean },
  { key: 'gold', title: '골드', width: 100, kind: GridCellKind.Number },
];

/** 패치노트 컬럼 */
export const PATCHNOTE_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'version', title: '버전', width: 80 },
  { key: 'title', title: '제목', width: 200 },
  { key: 'content', title: '내용', width: 300 },
  { key: 'changesJson', title: '변경사항 JSON', width: 250 },
];

/** 이벤트 히스토리 컬럼 */
export const EVENT_COLUMNS: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 220, readonly: true },
  { key: 'type', title: '유형', width: 100 },
  { key: 'name', title: '이벤트명', width: 150 },
  { key: 'description', title: '설명', width: 200 },
  { key: 'effectJson', title: '효과 JSON', width: 250 },
];

/** Table name → columns mapping */
export const TABLE_COLUMNS: Record<string, ColumnDef[]> = {
  character_templates: CHARACTER_COLUMNS,
  skills: SKILL_COLUMNS,
  item_templates: ITEM_COLUMNS,
  gacha_banners: GACHA_COLUMNS,
  facility_templates: FACILITY_COLUMNS,
  tradable_assets: TRADABLE_ASSET_COLUMNS,
  title_definitions: TITLE_COLUMNS,
  achievement_definitions: ACHIEVEMENT_COLUMNS,
  game_config: GAME_CONFIG_COLUMNS,
  users: USER_COLUMNS,
  patch_notes: PATCHNOTE_COLUMNS,
  event_history: EVENT_COLUMNS,
};

/** Primary key column for each table */
export const TABLE_PK: Record<string, string> = {
  character_templates: 'id',
  skills: 'id',
  item_templates: 'id',
  gacha_banners: 'id',
  facility_templates: 'id',
  tradable_assets: 'symbol',
  title_definitions: 'id',
  achievement_definitions: 'id',
  game_config: 'key',
  users: 'id',
  patch_notes: 'id',
  event_history: 'id',
};
