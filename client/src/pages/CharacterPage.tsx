import { useState } from 'react';
import { useCharacters } from '../api/characters';
import CharacterCard from '../modules/character/CharacterCard';
import CharacterDetailPanel from '../modules/character/CharacterDetailPanel';
import GachaPanel from '../modules/character/GachaPanel';

// TODO: Replace with actual auth user ID
const TEMP_USER_ID = 'user-1';

export default function CharacterPage() {
  const { data, isLoading } = useCharacters(TEMP_USER_ID);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'roster' | 'gacha'>('roster');

  const characters = data?.characters ?? [];
  const selected = characters.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full">
      {/* Left: Character grid / Gacha */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4">
          <button
            onClick={() => setTab('roster')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'roster'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            내 캐릭터 ({characters.length})
          </button>
          <button
            onClick={() => setTab('gacha')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'gacha'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            🎰 뽑기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'roster' ? (
            isLoading ? (
              <p className="text-slate-400 text-sm">로딩 중...</p>
            ) : characters.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🥚</p>
                <p className="text-slate-500 text-sm">아직 캐릭터가 없습니다.</p>
                <button
                  onClick={() => setTab('gacha')}
                  className="mt-3 px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  뽑기로 캐릭터 획득하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {characters.map((char) => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    grade="N"
                    onClick={() => setSelectedId(char.id)}
                    selected={selectedId === char.id}
                  />
                ))}
              </div>
            )
          ) : (
            <GachaPanel userId={TEMP_USER_ID} />
          )}
        </div>
      </div>

      {/* Right: Detail panel */}
      {selected && tab === 'roster' && (
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto">
          <CharacterDetailPanel character={selected} grade="N" />
        </aside>
      )}
    </div>
  );
}
