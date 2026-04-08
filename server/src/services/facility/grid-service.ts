/**
 * 메인 그리드 시스템
 * - 8×8 초기 크기, 확장 가능
 * - 시설/배치구역/보도 배치
 * - BFS 최단경로 탐색
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { userGrids, placementZones, facilities, houses, facilityTemplates, walkways } from '../../db/schema';

// ─── Grid Types ───

export type CellType = 'empty' | 'facility' | 'house' | 'placement' | 'path';

export interface GridCell {
  type: CellType;
  entityId?: string;  // facility/house/zone id
}

export interface GridState {
  width: number;
  height: number;
  cells: GridCell[][];
  pathTiles: [number, number][];
}

export interface PathResult {
  found: boolean;
  path: [number, number][];
  distance: number;
}

// ─── Grid Initialization ───

/**
 * 유저 그리드 초기화 (없으면 생성)
 */
export async function initUserGrid(
  db: any,
  userId: string,
  gridWidth: number = 8,
  gridHeight: number = 8,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (existing) return;

  await db.insert(userGrids).values({
    userId,
    gridWidth,
    gridHeight,
  });
}

/**
 * 유저 그리드 정보 조회
 */
export async function getUserGrid(db: any, userId: string): Promise<GridState> {
  const [grid] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (!grid) {
    return { width: 8, height: 8, cells: createEmptyGrid(8, 8), pathTiles: [] };
  }

  // 보도 타일 조회
  const pathTilesData = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId));
  const pathTiles: Array<[number, number]> = pathTilesData.map((w: any) => [w.x, w.y] as [number, number]);

  const cells = await buildGridCells(db, userId, grid.gridWidth, grid.gridHeight, pathTiles);
  return {
    width: grid.gridWidth,
    height: grid.gridHeight,
    cells,
    pathTiles,
  } as GridState;
}

/**
 * 그리드 확장
 */
export async function expandGrid(
  db: any,
  userId: string,
  newWidth: number,
  newHeight: number,
): Promise<{ success: boolean; error?: string }> {
  const [grid] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (!grid) return { success: false, error: 'Grid not found' };

  if (newWidth < grid.gridWidth || newHeight < grid.gridHeight) {
    return { success: false, error: 'Cannot shrink grid' };
  }

  if (newWidth > 20 || newHeight > 20) {
    return { success: false, error: 'Max grid size is 20×20' };
  }

  await db
    .update(userGrids)
    .set({ gridWidth: newWidth, gridHeight: newHeight })
    .where(eq(userGrids.userId, userId));

  return { success: true };
}

// ─── Path Tiles (보도) ───

/**
 * 보도 타일 추가
 */
export async function addPathTile(
  db: any,
  userId: string,
  x: number,
  y: number,
): Promise<{ success: boolean; error?: string }> {
  const [grid] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (!grid) return { success: false, error: 'Grid not found' };
  if (x < 0 || x >= grid.gridWidth || y < 0 || y >= grid.gridHeight) {
    return { success: false, error: 'Out of bounds' };
  }

  // Check if walkway already exists at this location
  const [existing] = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId))
    .where(eq(walkways.x, x))
    .where(eq(walkways.y, y))
    .limit(1);

  if (existing) {
    return { success: false, error: 'Path already exists' };
  }

  // Get path tiles to check occupation
  const pathTilesData = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId));
  const pathTiles: Array<[number, number]> = pathTilesData.map((w: any) => [w.x, w.y] as [number, number]);

  // Check if cell is occupied
  const occupied = await isCellOccupied(db, userId, x, y, grid.gridWidth, grid.gridHeight, pathTiles);
  if (occupied) {
    return { success: false, error: 'Cell is occupied' };
  }

  // Insert new walkway
  await db.insert(walkways).values({
    id: randomUUID(),
    userId,
    x,
    y,
  });

  return { success: true };
}

/**
 * 보도 타일 제거
 */
export async function removePathTile(
  db: any,
  userId: string,
  x: number,
  y: number,
): Promise<{ success: boolean }> {
  const [walkway] = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId))
    .where(eq(walkways.x, x))
    .where(eq(walkways.y, y))
    .limit(1);

  if (!walkway) return { success: false };

  await db.delete(walkways).where(eq(walkways.id, walkway.id));

  return { success: true };
}

// ─── BFS Pathfinding ───

/**
 * BFS 최단경로 탐색
 * 보도 타일 + 시설/배치구역을 통과 가능 노드로 처리
 */
export function findShortestPath(
  gridState: GridState,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): PathResult {
  const { width, height, cells } = gridState;

  if (startX === targetX && startY === targetY) {
    return { found: true, path: [[startX, startY]], distance: 0 };
  }

  // BFS
  const visited: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false),
  );

  const parent: ([number, number] | null)[][] = Array.from({ length: height }, () =>
    Array(width).fill(null),
  );

  const queue: [number, number][] = [[startX, startY]];
  visited[startY][startX] = true;

  const dirs: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
  ];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (visited[ny][nx]) continue;

      // 목표 도달
      if (nx === targetX && ny === targetY) {
        // 경로 역추적
        const path: [number, number][] = [[nx, ny]];
        let cur: [number, number] = [cx, cy];
        while (cur[0] !== startX || cur[1] !== startY) {
          path.unshift(cur);
          cur = parent[cur[1]][cur[0]]!;
        }
        path.unshift([startX, startY]);
        return { found: true, path, distance: path.length - 1 };
      }

      // 보도 또는 배치구역만 통과 가능
      const cell = cells[ny][nx];
      if (cell.type === 'path' || cell.type === 'placement') {
        visited[ny][nx] = true;
        parent[ny][nx] = [cx, cy];
        queue.push([nx, ny]);
      }
    }
  }

  return { found: false, path: [], distance: -1 };
}

// ─── Placement Validation ───

/**
 * 테트리스형 시설 배치 유효성 검증
 * shape: [[dx, dy], ...] 형태의 오프셋 배열
 */
export async function canPlaceFacility(
  db: any,
  userId: string,
  gridX: number,
  gridY: number,
  shape: Array<[number, number]>,
  rotation: number = 0,
): Promise<{ valid: boolean; error?: string }> {
  const [grid] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (!grid) return { valid: false, error: 'Grid not found' };

  const rotated = rotateShape(shape, rotation);

  // Get path tiles
  const pathTilesData = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId));
  const pathTiles: Array<[number, number]> = pathTilesData.map((w: any) => [w.x, w.y] as [number, number]);

  for (const [dx, dy] of rotated) {
    const x = gridX + dx;
    const y = gridY + dy;

    if (x < 0 || x >= grid.gridWidth || y < 0 || y >= grid.gridHeight) {
      return { valid: false, error: `Cell (${x},${y}) is out of bounds` };
    }

    const occupied = await isCellOccupied(db, userId, x, y, grid.gridWidth, grid.gridHeight, pathTiles);
    if (occupied) {
      return { valid: false, error: `Cell (${x},${y}) is occupied` };
    }
  }

  return { valid: true };
}

/**
 * 시설 모양 회전 (0, 90, 180, 270도)
 */
export function rotateShape(shape: Array<[number, number]>, rotation: number): Array<[number, number]> {
  const steps = Math.round((rotation % 360) / 90);
  let result: Array<[number, number]> = shape.map(([x, y]) => [x, y] as [number, number]);

  for (let i = 0; i < steps; i++) {
    result = result.map(([x, y]) => [-y, x] as [number, number]); // 90도 시계방향
  }

  return result;
}

// ─── Internal Helpers ───

function createEmptyGrid(width: number, height: number): GridCell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'empty' as CellType })),
  );
}

async function buildGridCells(
  db: any,
  userId: string,
  width: number,
  height: number,
  pathTiles: Array<[number, number]>,
): Promise<GridCell[][]> {
  const cells = createEmptyGrid(width, height);

  // 보도
  for (const [x, y] of pathTiles) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      cells[y][x] = { type: 'path' };
    }
  }

  // 시설
  const userFacilities = await db
    .select()
    .from(facilities)
    .where(eq(facilities.ownerId, userId));

  for (const f of userFacilities) {
    // 단순하게 1칸으로 표시 (실제로는 shape 기반 다중 칸)
    // 시설의 shape 정보는 facility_templates에서 가져와야 하지만,
    // 여기서는 기본 좌표만 마킹 (상세 렌더링은 클라이언트)
    if (f.gridX >= 0 && f.gridX < width && f.gridY >= 0 && f.gridY < height) {
      cells[f.gridY][f.gridX] = { type: 'facility', entityId: f.id };
    }
  }

  // 집
  const userHouses = await db
    .select()
    .from(houses)
    .where(eq(houses.ownerId, userId));

  for (const h of userHouses) {
    if (h.gridX >= 0 && h.gridX < width && h.gridY >= 0 && h.gridY < height) {
      cells[h.gridY][h.gridX] = { type: 'house', entityId: h.id };
    }
  }

  // 배치구역
  const zones = await db
    .select()
    .from(placementZones)
    .where(eq(placementZones.ownerId, userId));

  for (const z of zones) {
    if (z.gridX >= 0 && z.gridX < width && z.gridY >= 0 && z.gridY < height) {
      cells[z.gridY][z.gridX] = { type: 'placement', entityId: z.id };
    }
  }

  return cells;
}

async function isCellOccupied(
  db: any,
  userId: string,
  x: number,
  y: number,
  _width: number,
  _height: number,
  pathTiles: Array<[number, number]>,
): Promise<boolean> {
  // 보도 체크
  if (pathTiles.some(([px, py]) => px === x && py === y)) return true;

  // 시설 체크
  const facs = await db
    .select()
    .from(facilities)
    .where(eq(facilities.ownerId, userId));
  if (facs.some((f: any) => f.gridX === x && f.gridY === y)) return true;

  // 집 체크
  const hs = await db
    .select()
    .from(houses)
    .where(eq(houses.ownerId, userId));
  if (hs.some((h: any) => h.gridX === x && h.gridY === y)) return true;

  // 배치구역 체크
  const zones = await db
    .select()
    .from(placementZones)
    .where(eq(placementZones.ownerId, userId));
  if (zones.some((z: any) => z.gridX === x && z.gridY === y)) return true;

  return false;
}

// ─── Placement Zone Management ───

/**
 * 배치구역 추가 (최대 9개)
 */
export async function addPlacementZone(
  db: any,
  userId: string,
  gridX: number,
  gridY: number,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const existingZones = await db
    .select()
    .from(placementZones)
    .where(eq(placementZones.ownerId, userId));

  if (existingZones.length >= 9) {
    return { success: false, error: 'Max 9 placement zones' };
  }

  const [grid] = await db
    .select()
    .from(userGrids)
    .where(eq(userGrids.userId, userId))
    .limit(1);

  if (!grid) return { success: false, error: 'Grid not found' };

  if (gridX < 0 || gridX >= grid.gridWidth || gridY < 0 || gridY >= grid.gridHeight) {
    return { success: false, error: 'Out of bounds' };
  }

  // Get path tiles
  const pathTilesData = await db
    .select()
    .from(walkways)
    .where(eq(walkways.userId, userId));
  const pathTiles: Array<[number, number]> = pathTilesData.map((w: any) => [w.x, w.y] as [number, number]);

  const occupied = await isCellOccupied(db, userId, gridX, gridY, grid.gridWidth, grid.gridHeight, pathTiles);
  if (occupied) {
    return { success: false, error: 'Cell is occupied' };
  }

  const id = randomUUID();
  await db.insert(placementZones).values({
    id,
    ownerId: userId,
    gridX,
    gridY,
    characterId: null,
  });

  return { success: true, id };
}

/**
 * 배치구역에 캐릭터 배정
 */
export async function assignCharacterToZone(
  db: any,
  zoneId: string,
  characterId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const [zone] = await db
    .select()
    .from(placementZones)
    .where(eq(placementZones.id, zoneId))
    .limit(1);

  if (!zone) return { success: false, error: 'Zone not found' };

  await db
    .update(placementZones)
    .set({ characterId })
    .where(eq(placementZones.id, zoneId));

  return { success: true };
}
