import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

// ── In-memory cache
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (e && e.expiresAt > Date.now()) return e.data as T;
  cache.delete(key);
  return null;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export const womenSafetyRoutes = async (fastify: FastifyInstance) => {
  // ── Fast filter options with raw SQL + cache
  fastify.get('/women-safety/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const CACHE_KEY = 'women-safety:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    // WomenSafety district is via districtId→District relation, fetch district names via join
    const [districtRows, sourceRows, incidentRows, statusRows] = await Promise.all([
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT d."name" AS val
        FROM "WomenSafety" w
        JOIN "District" d ON d."id" = w."districtId"
        WHERE d."name" IS NOT NULL
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "complaintSource" AS val FROM "WomenSafety"
        WHERE "complaintSource" IS NOT NULL AND "complaintSource" <> ''
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "incidentType" AS val FROM "WomenSafety"
        WHERE "incidentType" IS NOT NULL AND "incidentType" <> ''
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "statusOfComplaint" AS val FROM "WomenSafety"
        WHERE "statusOfComplaint" IS NOT NULL AND "statusOfComplaint" <> ''
        ORDER BY val`,
    ]);

    const result = {
      districts: districtRows.map(r => r.val),
      sources: sourceRows.map(r => r.val),
      incidentTypes: incidentRows.map(r => r.val),
      statuses: statusRows.map(r => r.val),
    };
    setCached(CACHE_KEY, result);
    return sendSuccess(reply, result);
  });

  fastify.get('/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        page = '1', limit = '100', search = '',
        fromDate, toDate, district, source, incidentType, status,
      } = request.query as Record<string, string>;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (search.trim()) {
        where.OR = [
          { firstName: { contains: search } },
          { mobile: { contains: search } },
          { complRegNum: { contains: search } },
        ];
      }

      if (fromDate || toDate) {
        where.complRegDt = {};
        if (fromDate) where.complRegDt.gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          where.complRegDt.lte = end;
        }
      }

      // District filter via relation (join on district name)
      if (district) {
        const districts = district.split(',').map(d => d.trim()).filter(Boolean);
        where.district = { name: districts.length === 1 ? districts[0] : { in: districts } };
      }

      if (source) {
        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        where.complaintSource = sources.length === 1 ? sources[0] : { in: sources };
      }

      if (incidentType) {
        const types = incidentType.split(',').map(t => t.trim()).filter(Boolean);
        where.incidentType = types.length === 1 ? types[0] : { in: types };
      }

      if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        where.statusOfComplaint = statuses.length === 1 ? { contains: statuses[0] } : { in: statuses };
      }

      const [records, total] = await prisma.$transaction([
        prisma.womenSafety.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { complRegDt: 'desc' },
          include: { district: { select: { name: true } } },
        }),
        prisma.womenSafety.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: records,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
      });
    } catch (error) {
      console.error('[women-safety list] error:', error);
      return sendSuccess(reply, { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
    }
  });

  fastify.get('/women-safety/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const record = await prisma.womenSafety.findUnique({ where: { id: parseInt(id) } });
    if (!record) return sendNotFound(reply, 'Record not found');
    return sendSuccess(reply, record);
  });

  fastify.post('/women-safety', { preHandler: [authenticate] }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const record = await prisma.womenSafety.create({ data });
    return sendSuccess(reply, record, 'Record created');
  });

  fastify.put('/women-safety/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const record = await prisma.womenSafety.update({ where: { id: parseInt(id) }, data });
    return sendSuccess(reply, record, 'Record updated');
  });

  fastify.delete('/women-safety/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.womenSafety.delete({ where: { id: parseInt(id) } });
    return sendSuccess(reply, null, 'Record deleted');
  });
};