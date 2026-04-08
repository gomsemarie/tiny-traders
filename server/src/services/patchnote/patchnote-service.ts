import { eq, isNull, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../../db/schema';

const BUNDLE_DELAY_MS = 5 * 60 * 1000; // 5 minutes

let bundleTimer: ReturnType<typeof setTimeout> | null = null;

/** Called after every admin change — resets the 5min idle timer */
export function schedulePatchNoteBundling(db: any) {
  if (bundleTimer) {
    clearTimeout(bundleTimer);
  }
  bundleTimer = setTimeout(() => {
    bundleChangeLogs(db).catch(console.error);
  }, BUNDLE_DELAY_MS);
}

/** Bundle all unbundled change logs into a single patch note */
async function bundleChangeLogs(db: any) {
  // Find all change logs without a patch_note_id
  const unbundled = await db
    .select()
    .from(schema.adminChangeLogs)
    .where(isNull(schema.adminChangeLogs.patchNoteId))
    .orderBy(schema.adminChangeLogs.createdAt);

  if (unbundled.length === 0) return;

  // Get latest version
  const [latest] = await db
    .select()
    .from(schema.patchNotes)
    .orderBy(desc(schema.patchNotes.createdAt))
    .limit(1);

  const nextVersion = incrementVersion(latest?.version ?? '0.0.0');

  // Group changes by table and action
  const summary = buildSummary(unbundled);

  const patchNoteId = randomUUID();

  // Create patch note
  await db.insert(schema.patchNotes).values({
    id: patchNoteId,
    version: nextVersion,
    title: `v${nextVersion} 업데이트`,
    content: summary.text,
    changesJson: summary.changes,
    createdAt: new Date(),
  });

  // Link all change logs to this patch note
  for (const log of unbundled) {
    await db
      .update(schema.adminChangeLogs)
      .set({ patchNoteId })
      .where(eq(schema.adminChangeLogs.id, log.id));
  }

  console.log(`📋 Patch note v${nextVersion} created (${unbundled.length} changes bundled)`);
}

function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

/** Human-readable summary of changes */
function buildSummary(logs: any[]) {
  const TABLE_LABELS: Record<string, string> = {
    character_templates: '캐릭터',
    skills: '스킬',
    item_templates: '아이템',
    gacha_banners: '뽑기 배너',
    facility_templates: '시설',
    tradable_assets: '투자 종목',
    title_definitions: '칭호',
    achievement_definitions: '업적',
    game_config: '게임 설정',
    event_history: '이벤트',
  };

  const ACTION_LABELS: Record<string, string> = {
    create: '추가',
    update: '수정',
    delete: '삭제',
  };

  const grouped: Record<string, Record<string, number>> = {};

  for (const log of logs) {
    const table = log.tableName;
    const action = log.action;
    if (!grouped[table]) grouped[table] = {};
    grouped[table][action] = (grouped[table][action] || 0) + 1;
  }

  const lines: string[] = [];
  const changes: Array<{ type: string; table: string; description: string }> = [];

  for (const [table, actions] of Object.entries(grouped)) {
    const label = TABLE_LABELS[table] || table;
    for (const [action, count] of Object.entries(actions)) {
      const actionLabel = ACTION_LABELS[action] || action;
      const line = `${label} ${count}건 ${actionLabel}`;
      lines.push(`- ${line}`);
      changes.push({ type: action, table, description: line });
    }
  }

  return {
    text: lines.join('\n'),
    changes,
  };
}
