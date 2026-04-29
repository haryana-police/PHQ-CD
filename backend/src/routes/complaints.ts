import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

// ── In-memory cache: { key -> { data, expiresAt } }
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export const complaintRoutes = async (fastify: FastifyInstance) => {
  // ── Distinct filter options (fast raw SQL SELECT DISTINCT + cached)
  fastify.get('/complaints/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const CACHE_KEY = 'complaints:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    try {
      // Single raw query to get all distinct values at once — much faster than 4 separate findMany+distinct
      const [districtRows, sourceRows, typeRows, statusRows] = await Promise.all([
        prisma.$queryRaw<{ val: string }[]>`
          SELECT DISTINCT "addressDistrict" AS val
          FROM "Complaint"
          WHERE "addressDistrict" IS NOT NULL AND "addressDistrict" <> ''
          ORDER BY val`,
        prisma.$queryRaw<{ val: string }[]>`
          SELECT DISTINCT "complaintSource" AS val
          FROM "Complaint"
          WHERE "complaintSource" IS NOT NULL AND "complaintSource" <> ''
          ORDER BY val`,
        prisma.$queryRaw<{ val: string }[]>`
          SELECT DISTINCT "typeOfComplaint" AS val
          FROM "Complaint"
          WHERE "typeOfComplaint" IS NOT NULL AND "typeOfComplaint" <> ''
          ORDER BY val`,
        prisma.$queryRaw<{ val: string }[]>`
          SELECT DISTINCT "statusOfComplaint" AS val
          FROM "Complaint"
          WHERE "statusOfComplaint" IS NOT NULL AND "statusOfComplaint" <> ''
          ORDER BY val`,
      ]);

      const result = {
        districts: districtRows.map(r => r.val),
        sources: sourceRows.map(r => r.val),
        types: typeRows.map(r => r.val),
        statuses: statusRows.map(r => r.val),
      };

      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      console.error('[complaints filter-options] error:', error);
      return sendError(reply, 'Failed to fetch filter options');
    }
  });

  fastify.get('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        page = '1', limit = '100', search = '',
        fromDate, toDate,
        district, source, complaintType, status,
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

      if (district) {
        const districts = district.split(',').map(d => d.trim()).filter(Boolean);
        if (districts.length === 1) where.addressDistrict = districts[0];
        else where.addressDistrict = { in: districts };
      }

      if (source) {
        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        if (sources.length === 1) where.complaintSource = sources[0];
        else where.complaintSource = { in: sources };
      }

      if (complaintType) {
        const types = complaintType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length === 1) where.typeOfComplaint = types[0];
        else where.typeOfComplaint = { in: types };
      }

      if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) where.statusOfComplaint = { contains: statuses[0] };
        else where.OR = statuses.map(s => ({ statusOfComplaint: { contains: s } }));
      }

      const [complaints, total] = await prisma.$transaction([
        prisma.complaint.findMany({ where, skip, take: limitNum, orderBy: { id: 'desc' } }),
        prisma.complaint.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: complaints,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
      });
    } catch (error) {
      console.error('[complaints list] error:', error);
      return sendError(reply, 'Failed to fetch complaints');
    }
  });

  fastify.get('/complaints/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) return sendNotFound(reply, 'Complaint not found');
    return sendSuccess(reply, complaint);
  });

  fastify.post('/complaints', { preHandler: [authenticate] }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const result = await prisma.complaint.create({ data });
    return sendSuccess(reply, { id: result.id }, 'Complaint created successfully');
  });

  fastify.put('/complaints/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const existing = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!existing) return sendNotFound(reply, 'Complaint not found');
    await prisma.complaint.update({ where: { id: complaintId }, data });
    return sendSuccess(reply, null, 'Complaint updated successfully');
  });

  fastify.delete('/complaints/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const existing = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!existing) return sendNotFound(reply, 'Complaint not found');
    await prisma.complaint.delete({ where: { id: complaintId } });
    return sendSuccess(reply, null, 'Complaint deleted successfully');
  });
};