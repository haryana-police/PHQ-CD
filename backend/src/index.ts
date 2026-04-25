// env reloaded: 2026-04-24
import Fastify from 'fastify';
import cors from '@fastify/cors';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth.js';
import { complaintRoutes } from './routes/complaints.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { reportRoutes } from './routes/reports.js';
import { pendingRoutes } from './routes/pending.js';
import { referenceRoutes } from './routes/reference.js';
import { womenSafetyRoutes } from './routes/women-safety.js';
import { cctnsRoutes } from './routes/cctns.js';
import { cctnsSyncRoutes } from './routes/cctns-sync.js';
import { importExportRoutes } from './routes/import-export.js';
import { governmentRoutes } from './routes/government.js';
const fastify = Fastify({ logger: true });

async function main() {
  await fastify.register(cors, { origin: true });
  await fastify.register(jwt, { secret: 'phq-dashboard-secret-key-2024' });
  await fastify.register(multipart);

  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(complaintRoutes, { prefix: '/api' });
  await fastify.register(dashboardRoutes, { prefix: '/api' });
  await fastify.register(reportRoutes, { prefix: '/api' });
  await fastify.register(pendingRoutes, { prefix: '/api' });
  await fastify.register(referenceRoutes, { prefix: '/api' });
  await fastify.register(womenSafetyRoutes, { prefix: '/api' });
  await fastify.register(cctnsRoutes, { prefix: '/api' });
  await fastify.register(cctnsSyncRoutes, { prefix: '/api' });
  await fastify.register(importExportRoutes, { prefix: '/api' });
  await fastify.register(governmentRoutes, { prefix: '/api' });

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('✅ Server running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();