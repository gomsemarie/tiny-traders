import { useState, useCallback, useMemo } from 'react';
import {
  useGrid,
  useFacilityDefinitions,
  usePlaceFacility,
  useRemoveFacility,
  usePlaceWalkway,
  useRemoveWalkway,
  useExpandGrid,
  type FacilityDefinition,
  type GridState,
} from '../../api/facilities';

const CELL_SIZE = 32;
const GRID_LINE_COLOR = '#ccc';
const GRID_LINE_WIDTH = 1;

// Facility type colors
const FACILITY_COLORS: Record<string, string> = {
  character_zone: '#ffd700',
  house: '#ff69b4',
  kitchen: '#ff4444',
  parking: '#4444ff',
  office: '#4499ff',
  warehouse: '#8844ff',
  work_boost: '#44ff44',
  craft_boost: '#ff9944',
  train_boost: '#ffff44',
  rest: '#aaffaa',
  bank: '#ffaaaa',
  hospital: '#ffcccc',
  walkway: '#cccccc',
};

interface FacilityGridWindowProps {
  userId: string;
}

export default function FacilityGridWindow({ userId }: FacilityGridWindowProps) {
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [isPlacingWalkway, setIsPlacingWalkway] = useState(false);

  const { data: gridData } = useGrid(userId);
  const { data: defsData } = useFacilityDefinitions();
  const placeFacility = usePlaceFacility();
  const removeFacility = useRemoveFacility();
  const placeWalkway = usePlaceWalkway();
  const removeWalkway = useRemoveWalkway();
  const expandGrid = useExpandGrid();

  const grid: GridState = useMemo(
    () => gridData || { width: 8, height: 8, cells: [], pathTiles: [] },
    [gridData],
  );

  const definitions: FacilityDefinition[] = useMemo(
    () => defsData?.definitions || [],
    [defsData],
  );

  const selectedDef = useMemo(
    () => definitions.find((d) => d.id === selectedDefId),
    [definitions, selectedDefId],
  );

  // Get cell content from grid
  const getCellContent = useCallback(
    (x: number, y: number) => {
      if (!grid.cells || !grid.cells[y] || !grid.cells[y][x]) return null;
      return grid.cells[y][x];
    },
    [grid.cells],
  );

  // Get facility at position
  const getFacilityAt = useCallback(
    (x: number, y: number) => {
      const cell = getCellContent(x, y);
      if (cell?.type === 'facility' && cell.entityId && grid.cells) {
        // In a real app, we'd fetch facility details
        // For now, we just need the cell to know something is there
        return cell.entityId;
      }
      return null;
    },
    [getCellContent, grid.cells],
  );

  // Check if placement is valid
  const isValidPlacement = useCallback(
    (x: number, y: number, shape: Array<[number, number]>) => {
      for (const [dx, dy] of shape) {
        const nx = x + dx;
        const ny = y + dy;

        // Out of bounds
        if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) {
          return false;
        }

        const cell = getCellContent(nx, ny);
        // Empty or path is OK, others are not
        if (cell && cell.type !== 'empty' && cell.type !== 'path') {
          return false;
        }
      }
      return true;
    },
    [grid, getCellContent],
  );

  // Handle grid cell click
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (isPlacingWalkway) {
        // Place walkway
        const cell = getCellContent(x, y);
        if (cell?.type === 'empty') {
          placeWalkway.mutate({ userId, x, y });
        }
        return;
      }

      if (!selectedDef) {
        // Try to remove facility or walkway
        const cell = getCellContent(x, y);
        if (cell?.type === 'facility' && cell.entityId) {
          removeFacility.mutate({ userId, facilityId: cell.entityId });
        } else if (cell?.type === 'path') {
          removeWalkway.mutate({ userId, x, y });
        }
        return;
      }

      // Try to place facility
      if (isValidPlacement(x, y, selectedDef.shapeJson)) {
        placeFacility.mutate({
          userId,
          definitionId: selectedDef.id,
          gridX: x,
          gridY: y,
          rotation: 0,
        });
      }
    },
    [
      userId,
      selectedDef,
      isPlacingWalkway,
      getCellContent,
      placeFacility,
      removeFacility,
      placeWalkway,
      removeWalkway,
      isValidPlacement,
    ],
  );

  // Handle cell mouse enter for preview
  const handleCellHover = useCallback(
    (x: number, y: number) => {
      if (selectedDef && !isPlacingWalkway) {
        setPreviewPos({ x, y });
      } else {
        setPreviewPos(null);
      }
    },
    [selectedDef, isPlacingWalkway],
  );

  // Render a cell
  const renderCell = (x: number, y: number) => {
    const cell = getCellContent(x, y);
    const isWalkway = cell?.type === 'path';
    const isFacility = cell?.type === 'facility';
    const isPlacement = cell?.type === 'placement';

    const bgColor = isWalkway
      ? '#ddd'
      : isFacility
        ? '#aaa'
        : isPlacement
          ? '#ffd'
          : '#fff';

    const style: React.CSSProperties = {
      position: 'absolute',
      left: x * CELL_SIZE,
      top: y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      background: bgColor,
      border: `${GRID_LINE_WIDTH}px solid ${GRID_LINE_COLOR}`,
      cursor: 'pointer',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      color: '#666',
      transition: 'background 0.1s',
    };

    // Highlight if hovering
    if (previewPos?.x === x && previewPos?.y === y && selectedDef) {
      const isValid = isValidPlacement(x, y, selectedDef.shapeJson);
      style.background = isValid ? '#cfc' : '#fcc';
      style.opacity = 0.6;
    }

    return (
      <div
        key={`cell-${x}-${y}`}
        style={style}
        onClick={() => handleCellClick(x, y)}
        onMouseEnter={() => handleCellHover(x, y)}
        onMouseLeave={() => setPreviewPos(null)}
        title={`(${x}, ${y})`}
      >
        {isWalkway ? '·' : isFacility ? '▣' : isPlacement ? 'P' : ''}
      </div>
    );
  };

  // Render facility shape preview
  const renderPreview = () => {
    if (!previewPos || !selectedDef) return null;

    const items = [];
    const isValid = isValidPlacement(previewPos.x, previewPos.y, selectedDef.shapeJson);

    for (const [dx, dy] of selectedDef.shapeJson) {
      const px = previewPos.x + dx;
      const py = previewPos.y + dy;

      if (px >= 0 && px < grid.width && py >= 0 && py < grid.height) {
        items.push(
          <div
            key={`preview-${px}-${py}`}
            style={{
              position: 'absolute',
              left: px * CELL_SIZE,
              top: py * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              background: isValid ? 'rgba(100, 200, 100, 0.4)' : 'rgba(255, 100, 100, 0.4)',
              border: `${GRID_LINE_WIDTH}px solid ${isValid ? '#0a0' : '#a00'}`,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        );
      }
    }

    return items;
  };

  const gridWidth = grid.width * CELL_SIZE;
  const gridHeight = grid.height * CELL_SIZE;

  return (
    <div style={{ padding: 12, height: '100%', overflow: 'auto', background: '#f5f5f5' }}>
      {/* Info Bar */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <div style={{ marginBottom: 6, color: '#333' }}>
          Grid: {grid.width}×{grid.height} | Expand cost: {500 * ((grid.width - 8 + 1) ** 2)}G
        </div>
        <button
          onClick={() => expandGrid.mutate({ userId, width: grid.width + 2, height: grid.height + 2 })}
          disabled={grid.width >= 20 || grid.height >= 20}
          style={{
            padding: '4px 8px',
            marginRight: 8,
            background: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Expand Grid
        </button>
        <button
          onClick={() => setIsPlacingWalkway(!isPlacingWalkway)}
          style={{
            padding: '4px 8px',
            background: isPlacingWalkway ? '#ff6b6b' : '#666',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          {isPlacingWalkway ? 'Stop Walkway' : 'Place Walkway'}
        </button>
      </div>

      {/* Facility Palette */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 4,
          fontSize: 11,
          maxHeight: 150,
          overflow: 'auto',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#333' }}>Facilities:</div>
        {definitions.map((def) => (
          <div
            key={def.id}
            onClick={() => setSelectedDefId(selectedDefId === def.id ? null : def.id)}
            style={{
              padding: '4px 6px',
              marginBottom: 4,
              background: selectedDefId === def.id ? '#4a9eff' : '#f0f0f0',
              color: selectedDefId === def.id ? '#fff' : '#333',
              cursor: 'pointer',
              borderRadius: 2,
              fontSize: 11,
              userSelect: 'none',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ fontWeight: 500 }}>{def.name}</span>
            <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 6 }}>
              {def.baseCost}G • {def.shapeJson.length}cells
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          position: 'relative',
          width: gridWidth,
          height: gridHeight,
          background: '#fafafa',
          border: '2px solid #999',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* Render cells */}
        {Array.from({ length: grid.height }, (_, y) =>
          Array.from({ length: grid.width }, (_, x) => renderCell(x, y)),
        )}

        {/* Render preview */}
        {renderPreview()}
      </div>

      {/* Status */}
      {placeFacility.isPending && <p style={{ marginTop: 12, color: '#666', fontSize: 12 }}>Placing...</p>}
      {placeFacility.isError && (
        <p style={{ marginTop: 12, color: '#a00', fontSize: 12 }}>
          Error: {(placeFacility.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
