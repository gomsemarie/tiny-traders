/**
 * Facility Shape Presets
 * Defines all predefined shapes that can be used for facility templates.
 * Shapes are represented as arrays of [row, col] coordinates relative to origin (0, 0).
 */

export interface FacilityShape {
  id: string;
  name: string;
  cells: Array<[number, number]>;
  category: 'basic' | 'large' | 'special';
}

export const FACILITY_SHAPES: FacilityShape[] = [
  // Basic shapes
  {
    id: 'point',
    name: '점 (1×1)',
    cells: [[0, 0]],
    category: 'basic',
  },
  {
    id: 'bar_horizontal',
    name: '가로막대 (2×1)',
    cells: [[0, 0], [0, 1]],
    category: 'basic',
  },
  {
    id: 'bar_vertical',
    name: '세로막대 (1×2)',
    cells: [[0, 0], [1, 0]],
    category: 'basic',
  },
  {
    id: 'bar_long_horizontal',
    name: '긴 가로 (3×1)',
    cells: [[0, 0], [0, 1], [0, 2]],
    category: 'basic',
  },
  {
    id: 'bar_long_vertical',
    name: '긴 세로 (1×3)',
    cells: [[0, 0], [1, 0], [2, 0]],
    category: 'basic',
  },
  {
    id: 'square',
    name: '사각 (2×2)',
    cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
    category: 'basic',
  },

  // Special shapes
  {
    id: 'l_shape',
    name: 'L자',
    cells: [[0, 0], [1, 0], [1, 1]],
    category: 'special',
  },
  {
    id: 'l_shape_reverse',
    name: '역L자',
    cells: [[0, 0], [0, 1], [1, 0]],
    category: 'special',
  },
  {
    id: 't_shape',
    name: 'T자',
    cells: [[0, 0], [0, 1], [0, 2], [1, 1]],
    category: 'special',
  },
  {
    id: 'z_shape',
    name: 'Z자',
    cells: [[0, 0], [0, 1], [1, 1], [1, 2]],
    category: 'special',
  },
  {
    id: 's_shape',
    name: 'S자',
    cells: [[0, 1], [0, 2], [1, 0], [1, 1]],
    category: 'special',
  },
  {
    id: 'cross',
    name: '십자',
    cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
    category: 'special',
  },

  // Large shapes
  {
    id: 'l_large',
    name: '큰 L',
    cells: [[0, 0], [1, 0], [2, 0], [2, 1]],
    category: 'large',
  },
  {
    id: 'ㄱ_shape',
    name: 'ㄱ자',
    cells: [[0, 0], [0, 1], [1, 1]],
    category: 'special',
  },
];

/**
 * Find a shape by its cells (for matching current selection)
 */
export function findShapeByCell(cells: Array<[number, number]>): FacilityShape | undefined {
  if (!cells || cells.length === 0) return undefined;

  return FACILITY_SHAPES.find((shape) => {
    if (shape.cells.length !== cells.length) return false;
    const sortedShape = [...shape.cells].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const sortedCells = [...cells].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    return sortedShape.every((cell, i) => cell[0] === sortedCells[i][0] && cell[1] === sortedCells[i][1]);
  });
}

/**
 * Group shapes by category
 */
export function groupShapesByCategory(): Record<string, FacilityShape[]> {
  const grouped: Record<string, FacilityShape[]> = {};
  for (const shape of FACILITY_SHAPES) {
    if (!grouped[shape.category]) {
      grouped[shape.category] = [];
    }
    grouped[shape.category].push(shape);
  }
  return grouped;
}

/**
 * Get category label in Korean
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    basic: '기본',
    special: '특수',
    large: '큰 시설',
  };
  return labels[category] || category;
}
