import { useState } from 'react';
import { useGachaBanners, useGachaRoll, type GachaResult } from '../../api/characters';

interface GachaPanelProps {
  userId: string;
}

export default function GachaPanel({ userId }: GachaPanelProps) {
  const { data: bannersData } = useGachaBanners();
  const rollMutation = useGachaRoll();
  const [result, setResult] = useState<GachaResult | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);

  const banners = bannersData?.banners ?? [];

  const handleRoll = async () => {
    if (!selectedBanner) return;
    const res = await rollMutation.mutateAsync({ userId, bannerId: selectedBanner });
    setResult(res);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      padding: 16,
    }}>
      {banners.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>
          활성화된 배너가 없습니다. 데이터 관리에서 배너를 추가해주세요.
        </p>
      ) : (
        <>
          {/* Banner selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {banners.map((banner) => (
              <button
                key={banner.id}
                onClick={() => setSelectedBanner(banner.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: `1px solid ${selectedBanner === banner.id ? '#2563eb' : '#e5e7eb'}`,
                  background: selectedBanner === banner.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{banner.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {banner.type === 'limited' ? '기간 한정' : banner.type === 'premium' ? '프리미엄' : '일반'}
                </div>
              </button>
            ))}
          </div>

          {/* Roll button */}
          <button
            onClick={handleRoll}
            disabled={!selectedBanner || rollMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 600,
              background: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: (!selectedBanner || rollMutation.isPending) ? 'default' : 'pointer',
              opacity: (!selectedBanner || rollMutation.isPending) ? 0.4 : 1,
            }}
          >
            {rollMutation.isPending ? '뽑는 중...' : '뽑기'}
          </button>

          {/* Result */}
          {result && (
            <div style={{
              marginTop: 14,
              padding: 14,
              background: '#f9fafb',
              borderRadius: 6,
              textAlign: 'center',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{result.templateName}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>등급: {result.grade}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
