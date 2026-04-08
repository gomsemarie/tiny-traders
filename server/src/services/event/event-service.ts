import { randomUUID } from 'crypto';
import type { Server as SocketServer } from 'socket.io';
import { getSqlite } from '../../db';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export type EventType = 'investment' | 'labor' | 'facility' | 'character' | 'economy' | 'special';

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  effectJson: string;
  startedAt: number;
  endsAt: number;
}

// ═══════════════════════════════════════════════
// Event Pool (hardcoded events)
// ═══════════════════════════════════════════════

interface EventTemplate {
  type: EventType;
  name: string;
  description: string;
  durationMs: number;
  effectJson: Record<string, unknown>;
}

const EVENT_POOL: EventTemplate[] = [
  {
    type: 'investment',
    name: '수수료 할인',
    description: '거래 수수료 50% 감소',
    durationMs: 30 * 60 * 1000,
    effectJson: { feeDiscount: 0.5 },
  },
  {
    type: 'investment',
    name: '수수료 폭탄',
    description: '거래 수수료 2배',
    durationMs: 30 * 60 * 1000,
    effectJson: { feeMultiplier: 2 },
  },
  {
    type: 'investment',
    name: '거래소 점검',
    description: '신규 매수 일시 중단 (매도만 가능)',
    durationMs: 10 * 60 * 1000,
    effectJson: { buyDisabled: true },
  },
  {
    type: 'labor',
    name: '야근 수당',
    description: '알바 수입 2배',
    durationMs: 30 * 60 * 1000,
    effectJson: { jobIncomeMultiplier: 2 },
  },
  {
    type: 'labor',
    name: '파업',
    description: '일부 알바 불가',
    durationMs: 15 * 60 * 1000,
    effectJson: { jobsDisabled: true },
  },
  {
    type: 'economy',
    name: '금리 인상',
    description: '적금 이자 1.5배',
    durationMs: 30 * 60 * 1000,
    effectJson: { savingsInterestMultiplier: 1.5 },
  },
  {
    type: 'economy',
    name: '세금 부과',
    description: '보유 현금의 3% 징수',
    durationMs: 0,
    effectJson: { taxRate: 0.03 },
  },
  {
    type: 'character',
    name: '컨디션 회복',
    description: '전체 캐릭터 컨디션 회복',
    durationMs: 0,
    effectJson: { conditionRestore: true },
  },
  {
    type: 'special',
    name: '잭팟 타임',
    description: '뽑기 확률 UP',
    durationMs: 15 * 60 * 1000,
    effectJson: { gachaRateUp: 2 },
  },
  {
    type: 'special',
    name: '마켓 프리데이',
    description: '마켓 거래 수수료 0%',
    durationMs: 30 * 60 * 1000,
    effectJson: { marketFeeFree: true },
  },
  {
    type: 'facility',
    name: '정전',
    description: '일부 시설 기능 중단',
    durationMs: 10 * 60 * 1000,
    effectJson: { facilityDisruption: true },
  },
  {
    type: 'facility',
    name: '세일 기간',
    description: '시설 건설 비용 20% 감소',
    durationMs: 30 * 60 * 1000,
    effectJson: { buildCostDiscount: 0.2 },
  },
];

// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════

let activeEvent: GameEvent | null = null;
let eventTimeoutId: NodeJS.Timeout | null = null;
let schedulerIntervalId: NodeJS.Timeout | null = null;
let ioInstance: SocketServer | null = null;

// ═══════════════════════════════════════════════
// Functions
// ═══════════════════════════════════════════════

function getRandomEvent(): EventTemplate {
  return EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
}

function createGameEvent(template: EventTemplate): GameEvent {
  const now = Date.now();
  const endsAt = template.durationMs > 0 ? now + template.durationMs : now;

  return {
    id: randomUUID(),
    type: template.type,
    name: template.name,
    description: template.description,
    effectJson: JSON.stringify(template.effectJson),
    startedAt: now,
    endsAt,
  };
}

function saveEventToDb(event: GameEvent): void {
  const sqlite = getSqlite();
  if (!sqlite) return;

  try {
    const stmt = sqlite.prepare(
      `INSERT INTO event_history (id, type, name, description, effect_json, started_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      event.id,
      event.type,
      event.name,
      event.description,
      event.effectJson,
      Math.floor(event.startedAt / 1000),
      Math.floor(event.endsAt / 1000)
    );
  } catch (err) {
    console.error('[EventService] Failed to save event to DB:', err);
  }
}

function emitEventStart(event: GameEvent): void {
  if (ioInstance) {
    ioInstance.emit('event:start', event);
  }
}

function emitEventEnd(eventId: string): void {
  if (ioInstance) {
    ioInstance.emit('event:end', { eventId });
  }
}

export function startNewEvent(): GameEvent {
  // Clear previous timeout
  if (eventTimeoutId) {
    clearTimeout(eventTimeoutId);
  }

  // Create new event
  const template = getRandomEvent();
  const event = createGameEvent(template);
  activeEvent = event;

  // Save to DB
  saveEventToDb(event);

  // Emit start event
  emitEventStart(event);

  console.log(`[EventService] Event started: ${event.name} (${event.type})`);

  // Schedule end event if duration > 0
  if (event.endsAt > event.startedAt) {
    const durationMs = event.endsAt - event.startedAt;
    eventTimeoutId = setTimeout(() => {
      activeEvent = null;
      emitEventEnd(event.id);
      console.log(`[EventService] Event ended: ${event.name}`);
    }, durationMs);
  }

  return event;
}

export function getActiveEvent(): GameEvent | null {
  return activeEvent;
}

export function getEventHistory(limit: number = 20): GameEvent[] {
  const sqlite = getSqlite();
  if (!sqlite) return [];

  try {
    const stmt = sqlite.prepare(
      `SELECT id, type, name, description, effect_json, started_at, ends_at
       FROM event_history
       ORDER BY started_at DESC
       LIMIT ?`
    );
    const rows = stmt.all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type as EventType,
      name: row.name,
      description: row.description,
      effectJson: row.effect_json,
      startedAt: row.started_at * 1000,
      endsAt: row.ends_at * 1000,
    }));
  } catch (err) {
    console.error('[EventService] Failed to fetch event history:', err);
    return [];
  }
}

/**
 * Initialize the event scheduler
 * @param io Socket.io server instance
 * @param intervalMs Interval between events (default: 10 minutes for testing, 30 minutes in production)
 */
export function initEventScheduler(io: SocketServer, intervalMs: number = 10 * 60 * 1000): void {
  ioInstance = io;

  // Start with first event
  startNewEvent();

  // Schedule periodic events
  schedulerIntervalId = setInterval(() => {
    startNewEvent();
  }, intervalMs);

  const intervalSeconds = Math.round(intervalMs / 1000);
  console.log(`[EventService] Scheduler initialized (${intervalSeconds}s interval)`);
}

export function stopEventScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
  }
  if (eventTimeoutId) {
    clearTimeout(eventTimeoutId);
  }
  console.log('[EventService] Scheduler stopped');
}
