import type { CharacterData } from '../../api/characters';

const GRADE_BORDER: Record<string, string> = {
  N: '#d1d5db',
  R: '#93c5fd',
  SR: '#c4b5fd',
  SSR: '#fde68a',
  UR: '#fca5a5',
};

const GRADE_BG: Record<string, string> = {
  N: '#fafafa',
  R: '#eff6ff',
  SR: '#f5f3ff',
  SSR: '#fffbeb',
  UR: '#fef2f2',
};

const STAT_LABELS: Record<string, string> = {
  stamina: '체력',
  efficiency: '효율',
  precision: '정밀',
  mental: '멘탈',
  initiative: '행동',
  discipline: '자제',
  luck: '운',
};

const ACTIVITY_LABELS: Record<string, string> = {
  idle: '대기',
  work: '알바',
  craft: '제작',
  train: '훈련',
  rest: '휴식',
};

interface CharacterCardProps {
  character: CharacterData;
  grade?: string;
  name?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function CharacterCard({ character, grade = 'N', name, onClick, selected }: CharacterCardProps) {
  const conditionMax = character.stamina * 10;
  const conditionPercent = Math.round((character.condition / conditionMax) * 100);

  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${selected ? '#2563eb' : (GRADE_BORDER[grade] || '#d1d5db')}`,
        background: selected ? '#eff6ff' : (GRADE_BG[grade] || '#fafafa'),
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            color: '#6b7280',
            background: '#fff',
            border: '1px solid #e5e7eb',
          }}>
            {grade}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {name || character.nickname || '캐릭터'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Lv.{character.level}</span>
      </div>

      {/* Sprite placeholder */}
      <div style={{
        width: '100%',
        height: 56,
        background: '#fff',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        fontSize: 11,
        color: '#d1d5db',
      }}>
        sprite
      </div>

      {/* Condition bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>
          <span>컨디션</span>
          <span>{conditionPercent}%</span>
        </div>
        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 2,
            width: `${conditionPercent}%`,
            background: conditionPercent > 50 ? '#22c55e' : conditionPercent > 20 ? '#eab308' : '#ef4444',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Stats mini */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '2px 4px',
        fontSize: 10,
        marginBottom: 6,
      }}>
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', gap: 2 }}>
            <span style={{ color: '#9ca3af' }}>{label}</span>
            <span style={{ fontWeight: 600, color: '#374151' }}>{(character as any)[key]}</span>
          </div>
        ))}
      </div>

      {/* Activity */}
      <div style={{
        fontSize: 10,
        textAlign: 'center',
        color: '#6b7280',
        background: '#fff',
        borderRadius: 4,
        padding: '2px 0',
        border: '1px solid #f3f4f6',
      }}>
        {ACTIVITY_LABELS[character.activity] || character.activity}
      </div>
    </div>
  );
}
