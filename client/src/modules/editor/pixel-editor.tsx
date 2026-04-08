import { useState, useEffect, useRef, useCallback, memo } from 'react';

// ═══════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════

const GRID_SIZE = 32;
const PIXEL_SCALE = 10;
const CANVAS_DISPLAY = GRID_SIZE * PIXEL_SCALE; // 320
const PREVIEW_SIZE = 64;
const FRAME_COUNT = 4;
const MAX_UNDO = 50;
const ANIMATION_INTERVAL_MS = 200;

type PixelData = (string | null)[][];
type Tool = 'pencil' | 'eraser' | 'fill' | 'picker';

interface FrameClipboard {
  data: PixelData;
}

interface PixelEditorProps {
  /** Called when user clicks "완료" with spritesheet base64 and frame data */
  onComplete?: (spritesheet: string, frames: PixelData[]) => void;
  /** Initial frame data to load (e.g., for editing existing sprite) */
  initialFrames?: PixelData[];
}

const DEFAULT_PALETTE = [
  // Skin tones
  '#fdd5b1', '#f4a460', '#d2691e', '#8b4513',
  // Reds/Pinks
  '#ff0000', '#ff69b4', '#ff1493', '#dc143c',
  // Blues
  '#0000ff', '#1e90ff', '#00bfff', '#87ceeb',
  // Greens
  '#00ff00', '#32cd32', '#228b22', '#006400',
  // Yellows/Oranges
  '#ffff00', '#ffa500', '#ff8c00', '#ff4500',
  // Neutrals
  '#000000', '#808080', '#c0c0c0', '#ffffff',
];

const TOOL_DEFS: { id: Tool; icon: string; label: string; shortcut: string }[] = [
  { id: 'pencil', icon: '✏️', label: '연필', shortcut: 'B' },
  { id: 'eraser', icon: '🧹', label: '지우개', shortcut: 'E' },
  { id: 'fill', icon: '🪣', label: '채우기', shortcut: 'F' },
  { id: 'picker', icon: '💧', label: '스포이드', shortcut: 'I' },
];

const COLORS = {
  bg: '#111827',
  toolbar: '#1f2937',
  panel: '#1f2937',
  border: '#374151',
  borderLight: '#4b5563',
  text: '#e5e7eb',
  textDim: '#9ca3af',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  btnHover: '#374151',
  canvasBg: '#0f172a',
  checkerLight: '#3f3f46',
  checkerDark: '#27272a',
};

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function createEmptyFrame(): PixelData {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  );
}

function cloneFrame(frame: PixelData): PixelData {
  return frame.map((row) => [...row]);
}

function framesEqual(a: PixelData, b: PixelData): boolean {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (a[y][x] !== b[y][x]) return false;
    }
  }
  return true;
}

/** Standard BFS flood fill */
function floodFill(
  frame: PixelData,
  startX: number,
  startY: number,
  fillColor: string | null,
): PixelData {
  const result = cloneFrame(frame);
  const targetColor = result[startY][startX];

  if (targetColor === fillColor) return result;

  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue;
    if (result[y][x] !== targetColor) continue;

    visited.add(key);
    result[y][x] = fillColor;

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return result;
}

/** Render a single frame to a canvas context at given offset & scale */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  frame: PixelData,
  offsetX: number,
  offsetY: number,
  scale: number,
  showGrid: boolean,
  showChecker: boolean,
) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const px = offsetX + x * scale;
      const py = offsetY + y * scale;
      const color = frame[y][x];

      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, scale, scale);
      } else if (showChecker) {
        // Checkerboard transparency pattern
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.checkerLight : COLORS.checkerDark;
        ctx.fillRect(px, py, scale, scale);
      }
    }
  }

  if (showGrid && scale > 2) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      // Vertical
      const vx = offsetX + i * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(vx, offsetY);
      ctx.lineTo(vx, offsetY + GRID_SIZE * scale);
      ctx.stroke();
      // Horizontal
      const hy = offsetY + i * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(offsetX, hy);
      ctx.lineTo(offsetX + GRID_SIZE * scale, hy);
      ctx.stroke();
    }
  }
}

/** Export all 4 frames as a horizontal spritesheet (128x32) to base64 PNG */
function exportSpritesheet(frames: PixelData[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_SIZE * FRAME_COUNT;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Clear to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  frames.forEach((frame, i) => {
    renderFrame(ctx, frame, i * GRID_SIZE, 0, 1, false, false);
  });

  return canvas.toDataURL('image/png');
}

// ═══════════════════════════════════════════════
// PixelEditor Component
// ═══════════════════════════════════════════════

function PixelEditor({ onComplete, initialFrames }: PixelEditorProps) {
  // ─── State ───
  const [frames, setFrames] = useState<PixelData[]>(() =>
    initialFrames
      ? initialFrames.map(cloneFrame)
      : Array.from({ length: FRAME_COUNT }, createEmptyFrame),
  );
  const [activeFrame, setActiveFrame] = useState(0);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [showGrid, setShowGrid] = useState(true);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [customColorInput, setCustomColorInput] = useState('#000000');
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [clipboard, setClipboard] = useState<FrameClipboard | null>(null);

  // Undo/Redo per frame
  const undoStacksRef = useRef<PixelData[][]>(
    Array.from({ length: FRAME_COUNT }, () => []),
  );
  const redoStacksRef = useRef<PixelData[][]>(
    Array.from({ length: FRAME_COUNT }, () => []),
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Canvas refs
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const isPaintingRef = useRef(false);
  const lastPaintPosRef = useRef<{ x: number; y: number } | null>(null);

  // ─── Undo/Redo helpers ───
  const syncUndoRedoState = useCallback(() => {
    setCanUndo(undoStacksRef.current[activeFrame].length > 0);
    setCanRedo(redoStacksRef.current[activeFrame].length > 0);
  }, [activeFrame]);

  const pushUndo = useCallback(
    (frameIndex: number, snapshot: PixelData) => {
      const stack = undoStacksRef.current[frameIndex];
      stack.push(cloneFrame(snapshot));
      if (stack.length > MAX_UNDO) stack.shift();
      redoStacksRef.current[frameIndex] = [];
      syncUndoRedoState();
    },
    [syncUndoRedoState],
  );

  const performUndo = useCallback(() => {
    const undoStack = undoStacksRef.current[activeFrame];
    if (undoStack.length === 0) return;

    const prev = undoStack.pop()!;
    redoStacksRef.current[activeFrame].push(cloneFrame(frames[activeFrame]));

    setFrames((f) => {
      const next = [...f];
      next[activeFrame] = prev;
      return next;
    });
    syncUndoRedoState();
  }, [activeFrame, frames, syncUndoRedoState]);

  const performRedo = useCallback(() => {
    const redoStack = redoStacksRef.current[activeFrame];
    if (redoStack.length === 0) return;

    const next = redoStack.pop()!;
    undoStacksRef.current[activeFrame].push(cloneFrame(frames[activeFrame]));

    setFrames((f) => {
      const newFrames = [...f];
      newFrames[activeFrame] = next;
      return newFrames;
    });
    syncUndoRedoState();
  }, [activeFrame, frames, syncUndoRedoState]);

  // ─── Color management ───
  const addRecentColor = useCallback((c: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((rc) => rc !== c);
      return [c, ...filtered].slice(0, 8);
    });
  }, []);

  const selectColor = useCallback(
    (c: string) => {
      setColor(c);
      setCustomColorInput(c);
      addRecentColor(c);
    },
    [addRecentColor],
  );

  // ─── Paint logic ───
  const getGridPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const gx = Math.floor(mx / PIXEL_SCALE);
      const gy = Math.floor(my / PIXEL_SCALE);
      if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return null;
      return { x: gx, y: gy };
    },
    [],
  );

  const applyTool = useCallback(
    (x: number, y: number, isRightClick: boolean) => {
      const effectiveTool = isRightClick ? 'eraser' : tool;
      const currentFrame = frames[activeFrame];

      if (effectiveTool === 'picker') {
        const pickedColor = currentFrame[y][x];
        if (pickedColor) {
          selectColor(pickedColor);
          setTool('pencil');
        }
        return;
      }

      if (effectiveTool === 'fill') {
        const fillColor = isRightClick ? null : color;
        const newFrame = floodFill(currentFrame, x, y, fillColor);
        if (!framesEqual(currentFrame, newFrame)) {
          pushUndo(activeFrame, currentFrame);
          setFrames((f) => {
            const next = [...f];
            next[activeFrame] = newFrame;
            return next;
          });
          if (fillColor) addRecentColor(fillColor);
        }
        return;
      }

      // Pencil or Eraser: single pixel
      const pixelColor = effectiveTool === 'eraser' ? null : color;
      if (currentFrame[y][x] === pixelColor) return;

      setFrames((f) => {
        const next = [...f];
        const newFrame = cloneFrame(next[activeFrame]);
        newFrame[y][x] = pixelColor;
        next[activeFrame] = newFrame;
        return next;
      });
      if (pixelColor) addRecentColor(pixelColor);
    },
    [tool, color, activeFrame, frames, pushUndo, selectColor, addRecentColor],
  );

  // Bresenham line interpolation for smooth drag painting
  const paintLine = useCallback(
    (x0: number, y0: number, x1: number, y1: number, isRightClick: boolean) => {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = x0;
      let cy = y0;

      const effectiveTool = isRightClick ? 'eraser' : tool;
      if (effectiveTool === 'fill' || effectiveTool === 'picker') return;

      const pixelColor = effectiveTool === 'eraser' ? null : color;
      const points: { x: number; y: number }[] = [];

      while (true) {
        points.push({ x: cx, y: cy });
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
      }

      setFrames((f) => {
        const next = [...f];
        const newFrame = cloneFrame(next[activeFrame]);
        let changed = false;
        for (const p of points) {
          if (newFrame[p.y][p.x] !== pixelColor) {
            newFrame[p.y][p.x] = pixelColor;
            changed = true;
          }
        }
        if (changed) {
          next[activeFrame] = newFrame;
          return next;
        }
        return f;
      });
    },
    [tool, color, activeFrame],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = getGridPos(e);
      if (!pos) return;

      const isRight = e.button === 2;
      // Save snapshot for undo before first paint stroke
      pushUndo(activeFrame, frames[activeFrame]);
      isPaintingRef.current = true;
      lastPaintPosRef.current = pos;
      applyTool(pos.x, pos.y, isRight);
    },
    [getGridPos, applyTool, pushUndo, activeFrame, frames],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPaintingRef.current) return;
      const pos = getGridPos(e);
      if (!pos) return;

      const isRight = e.buttons === 2;
      const last = lastPaintPosRef.current;

      if (last && (last.x !== pos.x || last.y !== pos.y)) {
        paintLine(last.x, last.y, pos.x, pos.y, isRight);
      }
      lastPaintPosRef.current = pos;
    },
    [getGridPos, paintLine],
  );

  const handleCanvasMouseUp = useCallback(() => {
    isPaintingRef.current = false;
    lastPaintPosRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ─── Frame operations ───
  const copyFrame = useCallback(() => {
    setClipboard({ data: cloneFrame(frames[activeFrame]) });
  }, [frames, activeFrame]);

  const pasteFrame = useCallback(() => {
    if (!clipboard) return;
    pushUndo(activeFrame, frames[activeFrame]);
    setFrames((f) => {
      const next = [...f];
      next[activeFrame] = cloneFrame(clipboard.data);
      return next;
    });
  }, [clipboard, activeFrame, frames, pushUndo]);

  const handleComplete = useCallback(() => {
    const spritesheet = exportSpritesheet(frames);
    onComplete?.(spritesheet, frames.map(cloneFrame));
  }, [frames, onComplete]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') {
        e.preventDefault();
        performUndo();
        return;
      }
      if (ctrl && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
      }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        copyFrame();
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        pasteFrame();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b': setTool('pencil'); break;
        case 'e': setTool('eraser'); break;
        case 'f': setTool('fill'); break;
        case 'i': setTool('picker'); break;
        case 'g': setShowGrid((v) => !v); break;
        case '1': setActiveFrame(0); break;
        case '2': setActiveFrame(1); break;
        case '3': setActiveFrame(2); break;
        case '4': setActiveFrame(3); break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performUndo, performRedo, copyFrame, pasteFrame]);

  // Sync undo/redo state when frame changes
  useEffect(() => {
    syncUndoRedoState();
  }, [activeFrame, syncUndoRedoState]);

  // ─── Main canvas rendering ───
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_DISPLAY, CANVAS_DISPLAY);
    renderFrame(ctx, frames[activeFrame], 0, 0, PIXEL_SCALE, showGrid, true);
  }, [frames, activeFrame, showGrid]);

  // ─── Preview animation ───
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPreviewFrame((p) => (p + 1) % FRAME_COUNT);
    }, ANIMATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const previewScale = PREVIEW_SIZE / GRID_SIZE; // 2
    const displayIdx = isPlaying ? previewFrame : activeFrame;
    renderFrame(ctx, frames[displayIdx], 0, 0, previewScale, false, true);
  }, [frames, previewFrame, activeFrame, isPlaying]);

  // ─── Frame thumbnails ───
  useEffect(() => {
    frames.forEach((frame, i) => {
      const canvas = frameCanvasRefs.current[i];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const thumbScale = 48 / GRID_SIZE; // 1.5
      ctx.clearRect(0, 0, 48, 48);
      renderFrame(ctx, frame, 0, 0, thumbScale, false, true);
    });
  }, [frames]);

  // ─── Stop painting on global mouse up ───
  useEffect(() => {
    const stop = () => {
      isPaintingRef.current = false;
      lastPaintPosRef.current = null;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // ═══════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: COLORS.bg,
      color: COLORS.text,
      height: '100%',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      fontSize: 12,
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: COLORS.toolbar,
        borderBottom: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          도트 에디터
        </span>
        <button
          onClick={handleComplete}
          style={{
            padding: '5px 16px',
            background: COLORS.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.accent; }}
        >
          완료
        </button>
      </div>

      {/* ── Main area ── */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* ── Toolbar (left) ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '8px 6px',
          background: COLORS.toolbar,
          borderRight: `1px solid ${COLORS.border}`,
          flexShrink: 0,
          alignItems: 'center',
        }}>
          {TOOL_DEFS.map((t) => (
            <ToolButton
              key={t.id}
              icon={t.icon}
              label={t.label}
              shortcut={t.shortcut}
              active={tool === t.id}
              onClick={() => setTool(t.id)}
            />
          ))}

          <div style={{ height: 1, width: 24, background: COLORS.border, margin: '4px 0' }} />

          {/* Undo */}
          <ToolButton
            icon="↩️"
            label="되돌리기"
            shortcut="Ctrl+Z"
            active={false}
            disabled={!canUndo}
            onClick={performUndo}
          />
          {/* Redo */}
          <ToolButton
            icon="↪️"
            label="다시하기"
            shortcut="Ctrl+Y"
            active={false}
            disabled={!canRedo}
            onClick={performRedo}
          />

          <div style={{ height: 1, width: 24, background: COLORS.border, margin: '4px 0' }} />

          {/* Grid toggle */}
          <ToolButton
            icon="🔲"
            label="그리드"
            shortcut="G"
            active={showGrid}
            onClick={() => setShowGrid((v) => !v)}
          />
        </div>

        {/* ── Canvas area (center) ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.canvasBg,
          minWidth: 0,
          overflow: 'auto',
          padding: 16,
        }}>
          <canvas
            ref={mainCanvasRef}
            width={CANVAS_DISPLAY}
            height={CANVAS_DISPLAY}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onContextMenu={handleContextMenu}
            style={{
              width: CANVAS_DISPLAY,
              height: CANVAS_DISPLAY,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 2,
              cursor: tool === 'picker'
                ? 'crosshair'
                : tool === 'fill'
                  ? 'cell'
                  : 'default',
              imageRendering: 'pixelated',
              flexShrink: 0,
            }}
          />
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width: 160,
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.panel,
          borderLeft: `1px solid ${COLORS.border}`,
          flexShrink: 0,
          overflow: 'auto',
        }}>
          {/* Preview */}
          <div style={{
            padding: '10px 10px 6px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>
              미리보기
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}>
              <canvas
                ref={previewCanvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                style={{
                  width: PREVIEW_SIZE,
                  height: PREVIEW_SIZE,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 2,
                  imageRendering: 'pixelated',
                }}
              />
              <button
                onClick={() => setIsPlaying((p) => !p)}
                style={{
                  padding: '3px 10px',
                  background: isPlaying ? '#dc2626' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isPlaying ? '⏸ 정지' : '▶ 재생'}
              </button>
            </div>
          </div>

          {/* Current color */}
          <div style={{
            padding: '8px 10px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>
              선택 색상
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28,
                height: 28,
                background: color,
                border: `2px solid ${COLORS.borderLight}`,
                borderRadius: 4,
                flexShrink: 0,
              }} />
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => {
                  setCustomColorInput(e.target.value);
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    setColor(e.target.value);
                    addRecentColor(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(customColorInput)) {
                    selectColor(customColorInput);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '3px 6px',
                  background: '#111827',
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 3,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
            {/* Native color picker */}
            <input
              type="color"
              value={color}
              onChange={(e) => selectColor(e.target.value)}
              style={{
                width: '100%',
                height: 20,
                marginTop: 4,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </div>

          {/* Palette */}
          <div style={{
            padding: '8px 10px',
            borderBottom: `1px solid ${COLORS.border}`,
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>
              팔레트
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 3,
            }}>
              {DEFAULT_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => selectColor(c)}
                  title={c}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: c,
                    border: color === c
                      ? `2px solid ${COLORS.accent}`
                      : `1px solid ${COLORS.border}`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>

            {/* Recent colors */}
            {recentColors.length > 0 && (
              <>
                <div style={{
                  fontSize: 10,
                  color: COLORS.textDim,
                  marginTop: 8,
                  marginBottom: 4,
                  fontWeight: 600,
                }}>
                  최근 사용
                </div>
                <div style={{
                  display: 'flex',
                  gap: 3,
                  flexWrap: 'wrap',
                }}>
                  {recentColors.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      onClick={() => selectColor(c)}
                      title={c}
                      style={{
                        width: 20,
                        height: 20,
                        background: c,
                        border: color === c
                          ? `2px solid ${COLORS.accent}`
                          : `1px solid ${COLORS.border}`,
                        borderRadius: 2,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Frame bar (bottom) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: COLORS.toolbar,
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600, marginRight: 4 }}>
          프레임:
        </span>
        {frames.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveFrame(i)}
            style={{
              width: 48,
              height: 48,
              padding: 0,
              background: 'transparent',
              border: activeFrame === i
                ? `2px solid ${COLORS.accent}`
                : `1px solid ${COLORS.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            title={`프레임 ${i + 1} (${i + 1})`}
          >
            <canvas
              ref={(el) => { frameCanvasRefs.current[i] = el; }}
              width={48}
              height={48}
              style={{
                width: 48,
                height: 48,
                imageRendering: 'pixelated',
                display: 'block',
              }}
            />
            <span style={{
              position: 'absolute',
              bottom: 1,
              right: 3,
              fontSize: 9,
              fontWeight: 700,
              color: activeFrame === i ? COLORS.accent : COLORS.textDim,
              textShadow: '0 0 3px rgba(0,0,0,0.8)',
            }}>
              {i + 1}
            </span>
          </button>
        ))}

        <div style={{ height: 24, width: 1, background: COLORS.border, margin: '0 4px' }} />

        {/* Copy */}
        <button
          onClick={copyFrame}
          title="프레임 복사 (Ctrl+C)"
          style={{
            padding: '4px 10px',
            background: 'transparent',
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.btnHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span>📋</span> 복사
        </button>

        {/* Paste */}
        <button
          onClick={pasteFrame}
          disabled={!clipboard}
          title="프레임 붙여넣기 (Ctrl+V)"
          style={{
            padding: '4px 10px',
            background: 'transparent',
            color: clipboard ? COLORS.text : COLORS.textDim,
            border: `1px solid ${clipboard ? COLORS.border : COLORS.border}`,
            borderRadius: 3,
            fontSize: 11,
            cursor: clipboard ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: clipboard ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            if (clipboard) e.currentTarget.style.background = COLORS.btnHover;
          }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span>📄</span> 붙여넣기
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Shortcut hint */}
        <span style={{ fontSize: 9, color: COLORS.textDim }}>
          B:연필 E:지우개 F:채우기 G:그리드 1-4:프레임
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ToolButton sub-component
// ═══════════════════════════════════════════════

interface ToolButtonProps {
  icon: string;
  label: string;
  shortcut: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const ToolButton = memo(({ icon, label, shortcut, active, disabled, onClick }: ToolButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={`${label} (${shortcut})`}
    style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
      border: active ? `1px solid ${COLORS.accent}` : '1px solid transparent',
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 15,
      opacity: disabled ? 0.35 : 1,
      padding: 0,
      transition: 'background 0.1s, border-color 0.1s',
    }}
    onMouseEnter={(e) => {
      if (!active && !disabled) {
        e.currentTarget.style.background = COLORS.btnHover;
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
      }
    }}
  >
    {icon}
  </button>
));

ToolButton.displayName = 'ToolButton';

export default PixelEditor;
