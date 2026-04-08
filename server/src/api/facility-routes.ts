import type { FastifyInstance } from 'fastify';

export async function facilityRoutes(fastify: FastifyInstance) {
  // ─── Grid ───

  // Get user grid state
  fastify.get<{ Params: { userId: string } }>(
    '/api/grid/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const { getUserGrid, initUserGrid } = await import(
        '../services/facility/grid-service'
      );
      await initUserGrid(db, request.params.userId);
      return getUserGrid(db, request.params.userId);
    },
  );

  // Expand grid
  fastify.post<{ Params: { userId: string }; Body: { width: number; height: number } }>(
    '/api/grid/:userId/expand',
    async (request) => {
      const db = (fastify as any).db;
      const { expandGrid } = await import('../services/facility/grid-service');
      return expandGrid(db, request.params.userId, request.body.width, request.body.height);
    },
  );

  // Add path tile (보도)
  fastify.post<{ Params: { userId: string }; Body: { x: number; y: number } }>(
    '/api/grid/:userId/path',
    async (request) => {
      const db = (fastify as any).db;
      const { addPathTile } = await import('../services/facility/grid-service');
      return addPathTile(db, request.params.userId, request.body.x, request.body.y);
    },
  );

  // Remove path tile
  fastify.delete<{ Params: { userId: string }; Body: { x: number; y: number } }>(
    '/api/grid/:userId/path',
    async (request) => {
      const db = (fastify as any).db;
      const { removePathTile } = await import('../services/facility/grid-service');
      return removePathTile(db, request.params.userId, request.body.x, request.body.y);
    },
  );

  // Find shortest path (BFS)
  fastify.post<{
    Params: { userId: string };
    Body: { startX: number; startY: number; targetX: number; targetY: number };
  }>(
    '/api/grid/:userId/pathfind',
    async (request) => {
      const db = (fastify as any).db;
      const { getUserGrid, findShortestPath } = await import(
        '../services/facility/grid-service'
      );
      const grid = await getUserGrid(db, request.params.userId);
      const { startX, startY, targetX, targetY } = request.body;
      return findShortestPath(grid, startX, startY, targetX, targetY);
    },
  );

  // Add placement zone
  fastify.post<{ Params: { userId: string }; Body: { gridX: number; gridY: number } }>(
    '/api/grid/:userId/zone',
    async (request) => {
      const db = (fastify as any).db;
      const { addPlacementZone } = await import('../services/facility/grid-service');
      return addPlacementZone(
        db,
        request.params.userId,
        request.body.gridX,
        request.body.gridY,
      );
    },
  );

  // Assign character to zone
  fastify.post<{ Params: { zoneId: string }; Body: { characterId: string | null } }>(
    '/api/zone/:zoneId/assign',
    async (request) => {
      const db = (fastify as any).db;
      const { assignCharacterToZone } = await import('../services/facility/grid-service');
      return assignCharacterToZone(db, request.params.zoneId, request.body.characterId);
    },
  );

  // ─── Facilities ───

  // Get user facilities
  fastify.get<{ Params: { userId: string } }>(
    '/api/facilities/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const { getUserFacilities } = await import('../services/facility/facility-service');
      return { facilities: await getUserFacilities(db, request.params.userId) };
    },
  );

  // Build facility
  fastify.post<{
    Params: { userId: string };
    Body: { templateId: string; gridX: number; gridY: number; rotation?: number };
  }>(
    '/api/facilities/:userId/build',
    async (request) => {
      const db = (fastify as any).db;
      const { buildFacility } = await import('../services/facility/facility-service');
      return buildFacility(
        db,
        request.params.userId,
        request.body.templateId,
        request.body.gridX,
        request.body.gridY,
        request.body.rotation ?? 0,
      );
    },
  );

  // Upgrade facility
  fastify.post<{ Params: { id: string } }>(
    '/api/facility/:id/upgrade',
    async (request) => {
      const db = (fastify as any).db;
      const { upgradeFacility } = await import('../services/facility/facility-service');
      return upgradeFacility(db, request.params.id);
    },
  );

  // Demolish facility
  fastify.delete<{ Params: { id: string } }>(
    '/api/facility/:id',
    async (request) => {
      const db = (fastify as any).db;
      const { demolishFacility } = await import('../services/facility/facility-service');
      return demolishFacility(db, request.params.id);
    },
  );

  // Move facility
  fastify.post<{
    Params: { id: string };
    Body: { gridX: number; gridY: number; rotation?: number };
  }>(
    '/api/facility/:id/move',
    async (request) => {
      const db = (fastify as any).db;
      const { moveFacility } = await import('../services/facility/facility-service');
      return moveFacility(
        db,
        request.params.id,
        request.body.gridX,
        request.body.gridY,
        request.body.rotation,
      );
    },
  );

  // Check build completion
  fastify.get<{ Params: { id: string } }>(
    '/api/facility/:id/status',
    async (request) => {
      const db = (fastify as any).db;
      const { checkBuildCompletion } = await import('../services/facility/facility-service');
      return checkBuildCompletion(db, request.params.id);
    },
  );

  // Get facility level by type (system unlock check)
  fastify.get<{ Params: { userId: string; type: string } }>(
    '/api/facilities/:userId/level/:type',
    async (request) => {
      const db = (fastify as any).db;
      const { getFacilityLevelByType } = await import(
        '../services/facility/facility-service'
      );
      const level = await getFacilityLevelByType(
        db,
        request.params.userId,
        request.params.type as any,
      );
      return { type: request.params.type, level };
    },
  );

  // ─── Houses ───

  // Get user houses
  fastify.get<{ Params: { userId: string } }>(
    '/api/houses/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const { getUserHouses } = await import('../services/facility/house-service');
      return { houses: await getUserHouses(db, request.params.userId) };
    },
  );

  // Build house
  fastify.post<{
    Params: { userId: string };
    Body: { gridX: number; gridY: number };
  }>(
    '/api/houses/:userId/build',
    async (request) => {
      const db = (fastify as any).db;
      const { buildHouse } = await import('../services/facility/house-service');
      return buildHouse(db, request.params.userId, request.body.gridX, request.body.gridY);
    },
  );

  // Upgrade house
  fastify.post<{ Params: { id: string } }>(
    '/api/house/:id/upgrade',
    async (request) => {
      const db = (fastify as any).db;
      const { upgradeHouse } = await import('../services/facility/house-service');
      return upgradeHouse(db, request.params.id);
    },
  );

  // Assign character to house
  fastify.post<{ Params: { id: string }; Body: { characterId: string | null } }>(
    '/api/house/:id/assign',
    async (request) => {
      const db = (fastify as any).db;
      const { assignCharacterToHouse } = await import('../services/facility/house-service');
      return assignCharacterToHouse(db, request.params.id, request.body.characterId);
    },
  );

  // Get house buff for character
  fastify.get<{ Params: { characterId: string } }>(
    '/api/house/buff/:characterId',
    async (request) => {
      const db = (fastify as any).db;
      const { getHouseBuffForCharacter } = await import('../services/facility/house-service');
      const buff = await getHouseBuffForCharacter(db, request.params.characterId);
      return { buff };
    },
  );

  // ─── Hospital ───

  // Get hospital info
  fastify.get<{ Params: { userId: string } }>(
    '/api/hospital/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const { getFacilityLevelByType } = await import(
        '../services/facility/facility-service'
      );
      const { getHospitalInfo } = await import('../services/facility/hospital-service');
      const level = await getFacilityLevelByType(db, request.params.userId, 'hospital');
      return { level, ...getHospitalInfo(level) };
    },
  );
}
