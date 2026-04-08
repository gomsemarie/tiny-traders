import { useCallback, useRef, memo, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import type { Position } from 'react-rnd';

/* ─── Types ─── */
type Size = { width: number | string; height: number | string };
type Bounds = Position & Required<Size>;
export type ScreenMode = 'normal' | 'maximized' | 'hidden';

export interface WindowDef {
  id: string;
  title: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

export interface WindowFrameProps {
  id: string;
  title: string;
  defaultBounds: Bounds & { minWidth: number; minHeight: number };
  screenMode: ScreenMode;
  isFocused: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onScreenModeChange: (id: string, mode: ScreenMode) => void;
  children: ReactNode;
}

/* ─── drag handle class (shared with Rnd) ─── */
const DRAG_HANDLE_CLASS = 'win-drag-handle';

/* ═══════════════════════════════════════════════
 *  WindowFrame — uncontrolled Rnd wrapper
 *  Key optimization: uses `default` prop so React
 *  never re-renders during drag/resize moves.
 *  Programmatic changes go through rndRef methods.
 * ═══════════════════════════════════════════════ */
function WindowFrameInner({
  id, title, defaultBounds, screenMode, isFocused, onFocus, onClose, onScreenModeChange, children,
}: WindowFrameProps) {
  const rndRef = useRef<Rnd>(null);
  const previousBounds = useRef<Bounds>({
    x: defaultBounds.x,
    y: defaultBounds.y,
    width: defaultBounds.defaultWidth ?? defaultBounds.width,
    height: defaultBounds.defaultHeight ?? defaultBounds.height,
  });

  /* ── helpers ── */
  const getBounds = (): Bounds | undefined => {
    const r = rndRef.current;
    if (!r) return;
    const pos = r.getDraggablePosition();
    const size = r.resizable.size;
    return { x: pos.x, y: pos.y, width: size.width, height: size.height };
  };

  const saveCurrent = () => {
    const b = getBounds();
    if (b) previousBounds.current = b;
  };

  const updateScreen = (patch: Partial<Position & Size>, savePrev = true) => {
    const r = rndRef.current;
    const now = getBounds();
    if (!r || !now) return;
    if (savePrev) saveCurrent();
    r.updatePosition({ x: patch.x ?? now.x, y: patch.y ?? now.y });
    r.updateSize({ width: patch.width ?? now.width, height: patch.height ?? now.height });
  };

  const restorePrevious = () => {
    updateScreen(previousBounds.current, false);
    onScreenModeChange(id, 'normal');
  };

  /* ── actions ── */
  const focusAction = useCallback(() => onFocus(id), [id, onFocus]);

  const toggleMinimize = useCallback(() => {
    if (screenMode === 'hidden') {
      restorePrevious();
    } else {
      onScreenModeChange(id, 'hidden');
    }
  }, [id, screenMode, onScreenModeChange]);

  const toggleMaximize = useCallback(() => {
    if (screenMode === 'maximized') {
      restorePrevious();
    } else if (screenMode === 'normal') {
      updateScreen({ x: 0, y: 0, width: '100%', height: '100%' });
      onScreenModeChange(id, 'maximized');
    }
  }, [id, screenMode, onScreenModeChange]);

  const handleClose = useCallback(() => onClose(id), [id, onClose]);

  /* ── render ── */
  if (screenMode === 'hidden') return null;

  const iconColor = isFocused ? '#6b7280' : '#9ca3af';

  return (
    <Rnd
      ref={rndRef}
      default={defaultBounds}
      minWidth={defaultBounds.minWidth}
      minHeight={defaultBounds.minHeight}
      maxWidth="100%"
      maxHeight="100%"
      bounds="parent"
      dragHandleClassName={DRAG_HANDLE_CLASS}
      disableDragging={screenMode === 'maximized'}
      enableResizing={screenMode === 'normal' ? undefined : false}
      onMouseDown={focusAction}
      onResizeStart={focusAction}
      style={{
        zIndex: isFocused ? 2 : 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderRadius: screenMode === 'maximized' ? 0 : 8,
        border: `1px solid ${isFocused ? '#cdd1d8' : '#e2e5ea'}`,
        boxShadow: isFocused
          ? '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)'
          : '0 2px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        filter: isFocused ? 'none' : 'brightness(0.98)',
      }}
    >
      {/* ── Title bar — clean light ── */}
      <div
        className={DRAG_HANDLE_CLASS}
        onDoubleClick={toggleMaximize}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 36,
          padding: '0 8px 0 14px',
          background: isFocused ? '#ffffff' : '#fafbfc',
          borderBottom: `1px solid ${isFocused ? '#e2e5ea' : '#eef0f2'}`,
          cursor: screenMode === 'maximized' ? 'default' : 'move',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: isFocused ? '#1e2028' : '#9ca3af',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <WinBtn onClick={toggleMinimize} title="최소화">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect y="8" width="10" height="1.5" rx="0.5" fill={iconColor} />
            </svg>
          </WinBtn>
          <WinBtn onClick={toggleMaximize} title={screenMode === 'maximized' ? '복원' : '최대화'}>
            {screenMode === 'maximized' ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke={iconColor} strokeWidth="1.3" />
                <rect x="0" y="2" width="8" height="8" rx="1" fill="#ffffff" stroke={iconColor} strokeWidth="1.3" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke={iconColor} strokeWidth="1.3" />
              </svg>
            )}
          </WinBtn>
          <WinBtn onClick={handleClose} title="닫기" variant="close">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </WinBtn>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, background: '#fff' }}>
        {children}
      </div>
    </Rnd>
  );
}

/* ── Memoized export: only re-renders when props actually change ── */
export default memo(WindowFrameInner, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.title === next.title &&
    prev.screenMode === next.screenMode &&
    prev.isFocused === next.isFocused
    // onFocus/onClose/onScreenModeChange are stable callbacks (useCallback in parent)
    // children identity may change but content components handle their own memo
  );
});

/* ── Tiny button ── */
function WinBtn({ onClick, title, variant, children }: {
  onClick: () => void; title: string; variant?: 'close'; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = variant === 'close'
          ? 'rgba(239, 68, 68, 0.1)'
          : 'rgba(0, 0, 0, 0.05)';
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      style={{
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/* ─── Cascade spawn helper ─── */
let spawnIndex = -1;
const SPAWN_STEP = 24;
const SPAWN_MAX = 10;

export function getSpawnOffset(): number {
  spawnIndex++;
  return (spawnIndex % SPAWN_MAX) * SPAWN_STEP;
}
