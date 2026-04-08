import type { FastifyInstance } from 'fastify';
import { adminPlugin } from '../admin/plugin';
import { authRoutes } from './auth-routes';
import { characterRoutes } from './character-routes';
import { facilityRoutes } from './facility-routes';
import { jobRoutes } from './job-routes';
import { socialRoutes } from './social-routes';
import { tradingRoutes } from './trading-routes';
import { customizationRoutes } from './customization-routes';

export function setupRoutes(fastify: FastifyInstance): void {
  // Health check
  fastify.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  // Auth API (register, login, approve/reject)
  fastify.register(authRoutes);

  // Admin CRUD API
  fastify.register(adminPlugin);

  // Character & Gacha API
  fastify.register(characterRoutes);

  // Facility & Grid API
  fastify.register(facilityRoutes);

  // Job & Minigame API
  fastify.register(jobRoutes);

  // Social & Economy API
  fastify.register(socialRoutes);

  // Trading & Investment API
  fastify.register(tradingRoutes);

  // Customization, Guide, Patchnote, Config API
  fastify.register(customizationRoutes);
}
