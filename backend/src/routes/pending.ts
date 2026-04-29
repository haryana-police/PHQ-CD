import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
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

const PENDING_STATUS = `(c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' OR c."statusOfComplaint" ILIKE 'Pending%')`;
const PENDING_WHERE_PRISMA = [
  { statusOfComplaint: null },
  { statusOfComplaint: { equals: '' } },
  { statusOfComplaint: { startsWith: 'Pending' } },
];

const MAX_ROWS = 1000;

/**
 * Build a Prisma `where` object from query params.
 * district filter uses resolvedDistrictId → District_Master join (async, needs prisma).
 */
async function buildFilterWhere(query: Record<string, string>) {
  const { district, source, complaintType, fromDate, toDate } = query;
  const extra: any = {};

  if (district) {
    const names = district.split(',').map(x => x.trim()).filter(Boolean);
    const dmRows = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM "District_Master"
      WHERE "DistrictName" = ANY(${names}::text[]) AND "isPoliceDistrict" = true`;
    const ids = dmRows.map(r => r.id);
    if (ids.length === 1) extra.resolvedDistrictId = ids[0];
    else if (ids.length > 1) extra.resolvedDistrictId = { in: ids };
  }

  if (source) {
    const s = source.split(',').map(x => x.trim()).filter(Boolean);
    extra.complaintSource = s.length === 1 ? s[0] : { in: s };
  }
  if (complaintType) {
    const t = complaintType.split(',').map(x => x.trim()).filter(Boolean);
    extra.typeOfComplaint = t.length === 1 ? t[0] : { in: t };
  }
  if (fromDate || toDate) {
    extra.complRegDt = {};
    if (fromDate) extra.complRegDt.gte = new Date(fromDate);
    if (toDate) { const e = new Date(toDate); e.setHours(23,59,59,999); extra.complRegDt.lte = e; }
  }
  return extra;
}

export const pendingRoutes = async (fastify: FastifyInstance) => {

  // ── Filter options — districts from District_Master (DB-driven)
  fastify.get('/pending/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const CACHE_KEY = 'pending:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    const [districtRows, sourceRows, typeRows] = await Promise.all([
      // Districts from District_Master — same source as chart queries
      prisma.$queryRaw<{ val: string }[]>`
        SELECT "DistrictName" AS val FROM "District_Master"
        WHERE "isPoliceDistrict" = true ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT c."complaintSource" AS val FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true
          AND c."complaintSource" IS NOT NULL AND c."complaintSource" <> ''
          AND ${PENDING_STATUS.replace(/c\./g, 'c.')}
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT c."typeOfComplaint" AS val FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true
          AND c."typeOfComplaint" IS NOT NULL AND c."typeOfComplaint" <> ''
          AND ${PENDING_STATUS.replace(/c\./g, 'c.')}
        ORDER BY val`,
    ]);

    const result = {
      districts: districtRows.map(r => r.val),
      sources:   sourceRows.map(r => r.val),
      types:     typeRows.map(r => r.val),
    };
    setCached(CACHE_KEY, result);
    return sendSuccess(reply, result);
  });

  fastify.get('/pending/all', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = await buildFilterWhere(request.query as Record<string, string>);
    const complaints = await prisma.complaint.findMany({
      where: { OR: PENDING_WHERE_PRISMA, ...extra },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/15-30-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = await buildFilterWhere(request.query as Record<string, string>);
    const now  = new Date();
    const from = new Date(now.getTime() - 30 * 864e5);
    const to   = new Date(now.getTime() - 15 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE_PRISMA, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/30-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = await buildFilterWhere(request.query as Record<string, string>);
    const now  = new Date();
    const from = new Date(now.getTime() - 60 * 864e5);
    const to   = new Date(now.getTime() - 30 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE_PRISMA, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/over-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = await buildFilterWhere(request.query as Record<string, string>);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { lte: sixtyDaysAgo }, OR: PENDING_WHERE_PRISMA, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  // ── Branch routes: district name param → resolvedDistrictId lookup
  fastify.get('/pending/branch/:branch', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const dm = await prisma.district_Master.findFirst({ where: { DistrictName: branch } });
    const complaints = await prisma.complaint.findMany({
      where: { resolvedDistrictId: dm?.id ?? BigInt(-1), OR: PENDING_WHERE_PRISMA } as any,
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/15-30-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const dm = await prisma.district_Master.findFirst({ where: { DistrictName: branch } });
    const complaints = await prisma.complaint.findMany({
      where: {
        resolvedDistrictId: dm?.id ?? BigInt(-1),
        complRegDt: { gt: new Date(now.getTime() - 30 * 864e5), lte: new Date(now.getTime() - 15 * 864e5) },
        OR: PENDING_WHERE_PRISMA,
      } as any,
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/30-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const dm = await prisma.district_Master.findFirst({ where: { DistrictName: branch } });
    const complaints = await prisma.complaint.findMany({
      where: {
        resolvedDistrictId: dm?.id ?? BigInt(-1),
        complRegDt: { gt: new Date(now.getTime() - 60 * 864e5), lte: new Date(now.getTime() - 30 * 864e5) },
        OR: PENDING_WHERE_PRISMA,
      } as any,
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/over-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const dm = await prisma.district_Master.findFirst({ where: { DistrictName: branch } });
    const complaints = await prisma.complaint.findMany({
      where: {
        resolvedDistrictId: dm?.id ?? BigInt(-1),
        complRegDt: { lte: new Date(Date.now() - 60 * 864e5) },
        OR: PENDING_WHERE_PRISMA,
      } as any,
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  // ── List of active police district branches (from District_Master — no hardcoded list)
  fastify.get('/pending/branches', { preHandler: [authenticate] }, async (_request, reply) => {
    const rows = await prisma.district_Master.findMany({
      where: { isPoliceDistrict: true } as any,
      orderBy: { DistrictName: 'asc' },
      select: { DistrictName: true },
    });
    return sendSuccess(reply, rows.map(r => r.DistrictName));
  });
};