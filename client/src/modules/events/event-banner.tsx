import { memo, useEffect, useState } from 'react';
import { useActiveEvent } from '../../api/events';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../lib/socket';
import { queryKeys } from '../../api/query-keys';

/**
 * EventBanner: Displays the current active event at the top of the dashboard
 * - Shows category icon, event name, description, and remaining time countdown
 * - Colors by category
 * - Socket listeners for real-time event updates
 */
const EventBanner = memo(() => {
  const { data } = useActiveEvent();
  const event = data?.event;
  const qc = useQueryClient();
  const socket = useSocket();

  // Listen for real-time event changes
  useEffect(() => {
    if (!socket) return;

    const handleEventStart = () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.active });
    };

    const handleEventEnd = () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.active });
    };

    socket.on('event:start', handleEventStart);
    socket.on('event:end', handleEventEnd);

    return () => {
      socket.off('event:start', handleEventStart);
      socket.off('event:end', handleEventEnd);
    };
  }, [socket, qc]);

  // Force re-render every second for countdown
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!event) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [event]);

  // Countdown timer - recalculate on every render to stay current
  const remainingTime = (() => {
    if (!event) return null;

    const now = Date.now();
    const remaining = event.endsAt - now;

    if (remaining <= 0) return null;

    const seconds = Math.floor((remaining % 60000) / 1000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const hours = Math.floor(remaining / 3600000);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  })();

  if (!event) return null;

  // Color map by type
  const colorMap: Record<string, { bg: string; text: string; tag: string }> = {
    investment: { bg: '#eff6ff', text: '#1e40af', tag: '[투자]' },
    labor: { bg: '#f0fdf4', text: '#166534', tag: '[노동]' },
    facility: { bg: '#fef3c7', text: '#b45309', tag: '[시설]' },
    character: { bg: '#f3e8ff', text: '#7e22ce', tag: '[캐릭터]' },
    economy: { bg: '#fef3c7', text: '#d97706', tag: '[경제]' },
    special: { bg: '#fdf2f8', text: '#be185d', tag: '[특수]' },
  };

  const colors = colorMap[event.type] || colorMap.special;

  return (
    <div
      style={{
        background: colors.bg,
        borderBottom: `1px solid ${colors.text}20`,
        padding: '6px 16px',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        height: 32,
        minHeight: 32,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          color: colors.text,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {colors.tag}
      </span>
      <span
        style={{
          color: colors.text,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {event.name}
      </span>
      <span
        style={{
          color: colors.text,
          fontWeight: 400,
          opacity: 0.7,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {event.description}
      </span>
      {remainingTime && (
        <span
          style={{
            color: colors.text,
            fontWeight: 600,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {remainingTime}
        </span>
      )}
    </div>
  );
});

EventBanner.displayName = 'EventBanner';

export default EventBanner;
