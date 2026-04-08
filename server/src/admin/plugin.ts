import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../db/schema';
import { schedulePatchNoteBundling } from '../services/patchnote/patchnote-service';

/** Map of table names to Drizzle table objects for admin CRUD */
const TABLE_MAP: Record<string, any> = {
  character_templates: schema.characterTemplates,
  characters: schema.characters,
  skills: schema.skills,
  gacha_banners: schema.gachaBanners,
  item_templates: schema.itemTemplates,
  facility_templates: schema.facilityTemplates,
  tradable_assets: schema.tradableAssets,
  title_definitions: schema.titleDefinitions,
  achievement_definitions: schema.achievementDefinitions,
  event_history: schema.eventHistory,
  game_config: schema.gameConfig,
  users: schema.users,
  patch_notes: schema.patchNotes,
};

export async function adminPlugin(fastify: FastifyInstance) {
  // List all available admin tables
  fastify.get('/api/admin/tables', async () => {
    return { tables: Object.keys(TABLE_MAP) };
  });

  // GET rows for a table
  fastify.get<{ Params: { table: string } }>('/api/admin/:table', async (request, reply) => {
    const { table } = request.params;
    const drizzleTable = TABLE_MAP[table];
    if (!drizzleTable) {
      return reply.code(404).send({ error: `Table "${table}" not found` });
    }
    const db = (fastify as any).db;
    const rows = await db.select().from(drizzleTable);
    return { table, rows, count: rows.length };
  });

  // POST create a new row
  fastify.post<{ Params: { table: string }; Body: Record<string, unknown> }>(
    '/api/admin/:table',
    async (request, reply) => {
      const { table } = request.params;
      const drizzleTable = TABLE_MAP[table];
      if (!drizzleTable) {
        return reply.code(404).send({ error: `Table "${table}" not found` });
      }
      const db = (fastify as any).db;
      const body = request.body as Record<string, unknown>;
      const id = (body.id as string) || randomUUID();
      const row = { ...body, id };

      await db.insert(drizzleTable).values(row);

      // Log change for auto patch notes
      await logChange(db, 'system', table, 'create', id, row);

      return reply.code(201).send({ success: true, id });
    },
  );

  // PUT update a row
  fastify.put<{ Params: { table: string; id: string }; Body: Record<string, unknown> }>(
    '/api/admin/:table/:id',
    async (request, reply) => {
      const { table, id } = request.params;
      const drizzleTable = TABLE_MAP[table];
      if (!drizzleTable) {
        return reply.code(404).send({ error: `Table "${table}" not found` });
      }
      const db = (fastify as any).db;
      const body = request.body as Record<string, unknown>;

      // Get primary key column name
      const pkCol = getPrimaryKeyColumn(drizzleTable);
      await db.update(drizzleTable).set(body).where(eq(pkCol, id));

      // Log change
      await logChange(db, 'system', table, 'update', id, body);

      return { success: true, id };
    },
  );

  // DELETE a row
  fastify.delete<{ Params: { table: string; id: string } }>(
    '/api/admin/:table/:id',
    async (request, reply) => {
      const { table, id } = request.params;
      const drizzleTable = TABLE_MAP[table];
      if (!drizzleTable) {
        return reply.code(404).send({ error: `Table "${table}" not found` });
      }
      const db = (fastify as any).db;
      const pkCol = getPrimaryKeyColumn(drizzleTable);
      await db.delete(drizzleTable).where(eq(pkCol, id));

      // Log change
      await logChange(db, 'system', table, 'delete', id, {});

      return { success: true, id };
    },
  );

  // GET change logs (for patch notes)
  fastify.get('/api/admin/changelog', async () => {
    const db = (fastify as any).db;
    const logs = await db
      .select()
      .from(schema.adminChangeLogs)
      .orderBy(schema.adminChangeLogs.createdAt);
    return { logs };
  });
}

/** Helper: get first column of a table as primary key */
function getPrimaryKeyColumn(table: any) {
  const columns = Object.values(table) as any[];
  // First column is typically the primary key
  return columns[0];
}

/** Log admin changes for auto patch notes */
async function logChange(
  db: any,
  adminId: string,
  tableName: string,
  action: 'create' | 'update' | 'delete',
  recordId: string,
  diff: Record<string, unknown>,
) {
  await db.insert(schema.adminChangeLogs).values({
    id: randomUUID(),
    adminId,
    tableName,
    action,
    recordId,
    diffJson: diff,
    createdAt: new Date(),
  });

  // Schedule patch note bundling (resets 5min timer)
  schedulePatchNoteBundling(db);
}
