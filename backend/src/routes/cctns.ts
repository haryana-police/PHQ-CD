import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

import { getCached, setCached, getRequestCacheKey } from '../utils/cache.js';

export const cctnsRoutes = async (fastify: FastifyInstance) => {
  // ── Fast filter options
  fastify.get('/cctns/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const CACHE_KEY = 'cctns:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    const [categoryRows, districtRows] = await Promise.all([
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "compCategory" AS val FROM "CCTNSComplaint"
        WHERE "compCategory" IS NOT NULL AND "compCategory" <> ''
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT d."name" AS val
        FROM "CCTNSComplaint" c
        JOIN "District" d ON d."id" = c."districtId"
        WHERE d."name" IS NOT NULL
        ORDER BY val`,
    ]);

    const result = {
      categories: categoryRows.map(r => r.val),
      districts: districtRows.map(r => r.val),
    };
    setCached(CACHE_KEY, result);
    return sendSuccess(reply, result);
  });

  fastify.get('/cctns', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        page = '1', limit = '100', search = '',
        fromDate, toDate, district, category,
      } = request.query as Record<string, string>;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (search.trim()) {
        where.OR = [
          { victimName: { contains: search, mode: 'insensitive' } },
          { accusedName: { contains: search, mode: 'insensitive' } },
          { firNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (fromDate || toDate) {
        where.firDate = {};
        if (fromDate) where.firDate.gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          where.firDate.lte = end;
        }
      }

      if (category) {
        const cats = category.split(',').map(c => c.trim()).filter(Boolean);
        where.compCategory = cats.length === 1 ? cats[0] : { in: cats };
      }

      if (district) {
        const districts = district.split(',').map(d => d.trim()).filter(Boolean);
        where.district = { name: districts.length === 1 ? districts[0] : { in: districts } };
      }

      const [records, total] = await prisma.$transaction([
        prisma.cCTNSComplaint.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { firDate: 'desc' },
          include: { district: { select: { name: true } } },
        }),
        prisma.cCTNSComplaint.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: records,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
      });
    } catch (error) {
      console.error('[cctns list] error:', error);
      return sendSuccess(reply, { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
    }
  });

  fastify.get('/cctns/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const record = await prisma.cCTNSComplaint.findUnique({ where: { id: parseInt(id) } });
    if (!record) return sendNotFound(reply, 'Record not found');
    return sendSuccess(reply, record);
  });

  fastify.post('/cctns', { preHandler: [authenticate] }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const record = await prisma.cCTNSComplaint.create({ data });
    return sendSuccess(reply, record, 'Record created');
  });

  fastify.put('/cctns/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const record = await prisma.cCTNSComplaint.update({ where: { id: parseInt(id) }, data });
    return sendSuccess(reply, record, 'Record updated');
  });

  fastify.delete('/cctns/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.cCTNSComplaint.delete({ where: { id: parseInt(id) } });
    return sendSuccess(reply, null, 'Record deleted');
  });

  fastify.get('/cctns/district', { preHandler: [authenticate] }, async (request, reply) => {
    const records = await prisma.cCTNSComplaint.findMany();
    const districtMap = new Map();
    for (const record of records) {
      const name = record.compCategory || 'Unknown';
      districtMap.set(name, (districtMap.get(name) || 0) + 1);
    }
    const data = Array.from(districtMap.entries()).map(([district, count]) => ({ district, count }));
    return sendSuccess(reply, data);
  });
};