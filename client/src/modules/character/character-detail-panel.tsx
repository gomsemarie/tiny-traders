import type { CharacterData } from '../../api/characters';
import { useLevelUp, useDisposeCharacter } from '../../api/characters';

const STAT_INFO: Array<{ key: string; label: string; desc: string }> = [
  { key: 'stamina', label: '체력', desc: '컨디션 최대량' },
  { key: 'efficiency', label: '효율', desc: '작업 속도/산출량' },
  { key: 'precision', label: '정밀', desc: '품질/성공률' },
  { key: 'mental', label: '멘탈', desc: '디버프 저항' },
  { key: 'initiative', label: '행동력', desc: '스킬 발동 확률' },
  { key: 'discipline', label: '자제력', desc: '돌발 억제' },
  { key: 'luck', label: '운', desc: '랜덤 보정' },
];

interface CharacterDetailPanelProps {
  character: CharacterData;
  grade?: string;
  name?: string;
}

export default function CharacterDetailPanel({ character, grade = 'N', name }: CharacterDetailPanelProps) {
  const levelUp = useLevelUp();
  const dispose = useDisposeCharacter();
  const conditionMax = character.stamina * 10;
  const conditionPercent = Math.round((character.condition / conditionMax) * 100);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
            {name || character.nickname || '캐릭터'}
          </h3>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
            등급 {grade} · Lv.{character.level}/7
          </p>
        </div>
        <div style={{
          width: 48,
          height: 48,
          background: '#f9fafb',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#d1d5db',
        }}>
          sprite
        </div>
      </div>

      {/* Condition */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          <span>컨디션</span>
          <span>{character.condition}/{conditionMax} ({conditionPercent}%)</span>
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 3,
            width: `${conditionPercent}%`,
            background: conditionPercent > 50 ? '#22c55e' : conditionPercent > 20 ? '#eab308' : '#ef4444',
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {STAT_INFO.map(({ key, label, desc }) => {
          const value = (character as any)[key] as number;
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{desc}</span>
                </span>
                <span style={{ fontWeight: 700, color: '#111827' }}>{value}</span>
              </div>
              <div style={{ height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: '#2563eb',
                  borderRadius: 2,
                  width: `${value * 10}%`,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => levelUp.mutate(character.id)}
          disabled={character.level >= 7 || levelUp.isPending}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            opacity: (character.level >= 7 || levelUp.isPending) ? 0.4 : 1,
          }}
        >
          {levelUp.isPending ? '성장 중...' : `레벨업 (Lv.${character.level} → ${character.level + 1})`}
        </button>
        <button
          onClick={() => {
            if (confirm('정말 이 캐릭터를 처분하시겠습니까?')) {
              dispose.mutate(character.id);
            }
          }}
          disabled={dispose.isPending}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: '#dc2626',
            background: '#fff',
            border: '1px solid #fecaca',
            borderRadius: 6,
            cursor: 'pointer',
            opacity: dispose.isPending ? 0.4 : 1,
          }}
        >
          처분
        </button>
      </div>
    </div>
  );
}
