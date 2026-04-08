import { useMemo, useState } from 'react';
import { FACILITY_SHAPES, groupShapesByCategory, getCategoryLabel, findShapeByCell } from './facility-shapes';
import type { FacilityShape } from './facility-shapes';

interface FacilityShapeSelectorProps {
  selectedCells?: Array<[number, number]>;
  onSelect: (cells: Array<[number, number]>) => void;
}

export default function FacilityShapeSelector({ selectedCells, onSelect }: FacilityShapeSelectorProps) {
  const grouped = useMemo(() => groupShapesByCategory(), []);
  const selectedShape = useMemo(() => findShapeByCell(selectedCells || []), [selectedCells]);
  const [activeCategory, setActiveCategory] = useState<string>('basic');

  const categories = Object.keys(grouped).sort((a, b) => {
    const order = { basic: 0, special: 1, large: 2 };
    return (order[a as keyof typeof order] ?? 999) - (order[b as keyof typeof order] ?? 999);
  });

  const handleSelectShape = (shape: FacilityShape) => {
    onSelect(shape.cells);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 500,
              color: activeCategory === category ? '#fff' : '#374151',
              background: activeCategory === category ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          >
            {getCategoryLabel(category)}
          </button>
        ))}
      </div>

      {/* Shapes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {grouped[activeCategory]?.map((shape) => (
          <ShapePreview
            key={shape.id}
            shape={shape}
            isSelected={selectedShape?.id === shape.id}
            onClick={() => handleSelectShape(shape)}
          />
        ))}
      </div>
    </div>
  );
}

interface ShapePreviewProps {
  shape: FacilityShape;
  isSelected: boolean;
  onClick: () => void;
}

function ShapePreview({ shape, isSelected, onClick }: ShapePreviewProps) {
  // Calculate bounds to center the shape in the preview
  const minRow = Math.min(...shape.cells.map((c) => c[0]));
  const maxRow = Math.max(...shape.cells.map((c) => c[0]));
  const minCol = Math.min(...shape.cells.map((c) => c[1]));
  const maxCol = Math.max(...shape.cells.map((c) => c[1]));
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;

  // Calculate normalized cells (relative to 0,0 after removing offset)
  const normalizedCells = shape.cells.map((c) => [c[0] - minRow, c[1] - minCol]);

  // Preview grid size
  const previewSize = 5;
  const cellSize = 12;
  const padding = 4;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: 6,
        background: '#fff',
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 0.15s',
        boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
          (e.currentTarget as HTMLElement).style.background = '#f9fafb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
          (e.currentTarget as HTMLElement).style.background = '#fff';
        }
      }}
    >
      {/* Grid Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${previewSize}, ${cellSize}px)`,
          gap: 1,
          padding,
          background: '#f3f4f6',
          borderRadius: 4,
          justifyContent: 'center',
          alignContent: 'center',
          minHeight: previewSize * cellSize + 2 * padding,
        }}
      >
        {Array.from({ length: previewSize * previewSize }).map((_, idx) => {
          const row = Math.floor(idx / previewSize);
          const col = idx % previewSize;
          const isFilled = normalizedCells.some((c) => c[0] === row && c[1] === col);
          return (
            <div
              key={idx}
              style={{
                width: cellSize,
                height: cellSize,
                background: isFilled ? '#3b82f6' : '#e5e7eb',
                borderRadius: 1,
                border: '1px solid #d1d5db',
              }}
            />
          );
        })}
      </div>

      {/* Name */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#111827', textAlign: 'center' }}>
        {shape.name}
      </div>
    </button>
  );
}
