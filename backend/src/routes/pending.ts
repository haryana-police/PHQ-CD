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

const PENDING_WHERE = [
  { statusOfComplaint: null },
  { statusOfComplaint: { equals: '' } },
  { statusOfComplaint: { startsWith: 'Pending' } },
];

const MAX_ROWS = 1000;

function buildFilterWhere(query: Record<string, string>) {
  const { district, source, complaintType, fromDate, toDate } = query;
  const extra: any = {};
  if (district) {
    const d = district.split(',').map(x => x.trim()).filter(Boolean);
    extra.addressDistrict = d.length === 1 ? d[0] : { in: d };
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
  // ── Fast filter options with raw SQL + cache
  fastify.get('/pending/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const CACHE_KEY = 'pending:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    const [districtRows, sourceRows, typeRows] = await Promise.all([
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "addressDistrict" AS val FROM "Complaint"
        WHERE "addressDistrict" IS NOT NULL AND "addressDistrict" <> ''
          AND ("statusOfComplaint" IS NULL OR "statusOfComplaint" = '' OR "statusOfComplaint" LIKE 'Pending%')
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "complaintSource" AS val FROM "Complaint"
        WHERE "complaintSource" IS NOT NULL AND "complaintSource" <> ''
          AND ("statusOfComplaint" IS NULL OR "statusOfComplaint" = '' OR "statusOfComplaint" LIKE 'Pending%')
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT DISTINCT "typeOfComplaint" AS val FROM "Complaint"
        WHERE "typeOfComplaint" IS NOT NULL AND "typeOfComplaint" <> ''
          AND ("statusOfComplaint" IS NULL OR "statusOfComplaint" = '' OR "statusOfComplaint" LIKE 'Pending%')
        ORDER BY val`,
    ]);

    const result = {
      districts: districtRows.map(r => r.val),
      sources: sourceRows.map(r => r.val),
      types: typeRows.map(r => r.val),
    };
    setCached(CACHE_KEY, result);
    return sendSuccess(reply, result);
  });

  fastify.get('/pending/all', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = buildFilterWhere(request.query as Record<string, string>);
    const complaints = await prisma.complaint.findMany({
      where: { OR: PENDING_WHERE, ...extra },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/15-30-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = buildFilterWhere(request.query as Record<string, string>);
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 864e5);
    const to   = new Date(now.getTime() - 15 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/30-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = buildFilterWhere(request.query as Record<string, string>);
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 864e5);
    const to   = new Date(now.getTime() - 30 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/over-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const extra = buildFilterWhere(request.query as Record<string, string>);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { lte: sixtyDaysAgo }, OR: PENDING_WHERE, ...extra },
      orderBy: { complRegDt: 'asc' }, take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/15-30-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 864e5);
    const to   = new Date(now.getTime() - 15 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/30-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 864e5);
    const to   = new Date(now.getTime() - 30 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, complRegDt: { gt: from, lte: to }, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/over-60-days', { preHandler: [authenticate] }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const sixtyDaysAgo = new Date(Date.now() - 60 * 864e5);
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, complRegDt: { lte: sixtyDaysAgo }, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branches', { preHandler: [authenticate] }, async (_request, reply) => {
    const HARYANA_DISTRICTS = [
      'AMBALA','BHIWANI','CHARKHI DADRI','FARIDABAD','FATEHABAD',
      'GURUGRAM','HISAR','JHAJJAR','JIND','KAITHAL','KARNAL',
      'KURUKSHETRA','MAHENDERGARH','NUH','PALWAL','PANCHKULA',
      'PANIPAT','REWARI','ROHTAK','SIRSA','SONIPAT','YAMUNANAGAR',
    ];
    const rows = await prisma.$queryRaw<{ val: string }[]>`
      SELECT DISTINCT "addressDistrict" AS val FROM "Complaint"
      WHERE "addressDistrict" = ANY(${HARYANA_DISTRICTS}::text[])
        AND ("statusOfComplaint" IS NULL OR "statusOfComplaint" = '' OR "statusOfComplaint" LIKE 'Pending%')
      ORDER BY val`;
    return sendSuccess(reply, rows.map(r => r.val));
  });
};