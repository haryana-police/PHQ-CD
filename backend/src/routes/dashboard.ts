import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { getCached, setCached, getRequestCacheKey } from '../utils/cache.js';

/**
 * All district-scoped queries JOIN "District_Master" via c."resolvedDistrictId"
 * and filter WHERE dm."isPoliceDistrict" = true.
 * No hardcoded district lists — the DB is the single source of truth.
 *
 * All endpoints accept these optional query params:
 *   year, fromDate, toDate, district (comma-separated names), source (comma-sep), complaintType (comma-sep)
 */

/** Build extra WHERE clauses from request filters — returns safe SQL fragments */
function buildExtraWhere(q: Record<string, string>): string {
  const parts: string[] = [];

  if (q.fromDate && q.toDate) {
    parts.push(`c."complRegDt" >= '${q.fromDate}' AND c."complRegDt" <= '${q.toDate}'`);
  } else if (q.year) {
    const y = parseInt(q.year);
    parts.push(`c."complRegDt" >= '${y}-01-01' AND c."complRegDt" < '${y + 1}-01-01'`);
  }

  if (q.district) {
    const names = q.district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',');
    parts.push(`dm."DistrictName" IN (${names})`);
  }

  if (q.source) {
    const srcs = q.source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',');
    parts.push(`c."complaintSource" IN (${srcs})`);
  }

  if (q.complaintType) {
    const types = q.complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',');
    parts.push(`c."typeOfComplaint" IN (${types})`);
  }

  return parts.length ? `AND ${parts.join(' AND ')}` : '';
}

// Longer TTL for filter-options (15 min — static reference data)
const FILTER_CACHE_TTL = 15 * 60 * 1000;
const _filterCache = { data: null as unknown, exp: 0 };

export const dashboardRoutes = async (fastify: FastifyInstance) => {

  /**
   * GET /api/dashboard/filter-options
   * DB-driven: districts from District_Master, sources from tb_received_from,
   * types from tb_nature_complaints. Used by GlobalFilterBar across ALL modules.
   */
  fastify.get('/dashboard/filter-options', { preHandler: [authenticate] }, async (_req, reply) => {
    try {
      if (_filterCache.data && _filterCache.exp > Date.now()) return sendSuccess(reply, _filterCache.data);

      const [districtRows, sourceRows, typeRows, yearRows] = await Promise.all([
        prisma.$queryRaw<{ val: string }[]>`
          SELECT "DistrictName" AS val FROM "District_Master"
          WHERE "isPoliceDistrict" = true ORDER BY val`,
        prisma.$queryRaw<{ val: string }[]>`
          SELECT "recieved_from" AS val FROM "tb_received_from"
          WHERE "recieved_from" IS NOT NULL AND "recieved_from" <> '' ORDER BY val`,
        prisma.$queryRaw<{ val: string }[]>`
          SELECT "nature_complaints" AS val FROM "tb_nature_complaints"
          WHERE "nature_complaints" IS NOT NULL AND "nature_complaints" <> '' ORDER BY val`,
        prisma.$queryRaw<{ val: number }[]>`
          SELECT DISTINCT EXTRACT(YEAR FROM c."complRegDt")::int AS val
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true AND c."complRegDt" IS NOT NULL
          ORDER BY val DESC`,
      ]);

      const data = {
        districts: districtRows.map(r => r.val),
        sources:   sourceRows.map(r => r.val),
        types:     typeRows.map(r => r.val),
        years:     yearRows.map(r => r.val),
      };
      _filterCache.data = data;
      _filterCache.exp  = Date.now() + FILTER_CACHE_TTL;
      return sendSuccess(reply, data);
    } catch (e) {
      console.error('[dashboard/filter-options]', e);
      return sendError(reply, 'Failed to load filter options');
    }
  });

  /**
   * Summary KPIs — accepts all filter params.
   */
  fastify.get('/dashboard/summary', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const CACHE_KEY = getRequestCacheKey('dashboard:summary', q);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const now = new Date();
      const f15 = new Date(now.getTime() - 15 * 86400000).toISOString();
      const f30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const f60 = new Date(now.getTime() - 60 * 86400000).toISOString();

      const extra = buildExtraWhere(q);

      const [counts] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) AS totalReceived,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS totalDisposed,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS totalPending,
          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND c."complRegDt" >= '${f30}' AND c."complRegDt" < '${f15}'
            THEN 1 ELSE 0 END) AS pending15,
          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND c."complRegDt" >= '${f60}' AND c."complRegDt" < '${f30}'
            THEN 1 ELSE 0 END) AS pendingOver1,
          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND c."complRegDt" < '${f60}'
            THEN 1 ELSE 0 END) AS pendingOver2
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true ${extra}
      `);

      const result = {
        totalReceived:          Number(counts.totalreceived  || 0),
        totalDisposed:          Number(counts.totaldisposed  || 0),
        totalPending:           Number(counts.totalpending   || 0),
        pendingOverFifteenDays: Number(counts.pending15      || 0),
        pendingOverOneMonth:    Number(counts.pendingover1   || 0),
        pendingOverTwoMonths:   Number(counts.pendingover2   || 0),
      };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/summary] error:', msg);
      return sendError(reply, `Failed to load dashboard summary: ${msg}`);
    }
  });

  /**
   * District-wise chart — accepts all filter params.
   */
  fastify.get('/dashboard/district-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const CACHE_KEY = getRequestCacheKey('dashboard:district-wise', q);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const yearNum = q.year ? parseInt(q.year) : new Date().getFullYear();

      // Date part: use fromDate/toDate if present, else year range
      const datePart = q.fromDate && q.toDate
        ? `c."complRegDt" >= '${q.fromDate}' AND c."complRegDt" <= '${q.toDate}'`
        : `c."complRegDt" >= '${yearNum}-01-01' AND c."complRegDt" < '${yearNum + 1}-01-01'`;

      const extras: string[] = [];
      if (q.district) {
        const names = q.district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`dm."DistrictName" IN (${names})`);
      }
      if (q.source) {
        const srcs = q.source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`c."complaintSource" IN (${srcs})`);
      }
      if (q.complaintType) {
        const types = q.complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`c."typeOfComplaint" IN (${types})`);
      }
      const extraWhere = extras.length ? `AND ${extras.join(' AND ')}` : '';

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(`
          SELECT
            dm."DistrictName" AS district,
            COUNT(*) AS TotalComplaints,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true AND ${datePart} ${extraWhere}
          GROUP BY dm."DistrictName" ORDER BY TotalComplaints DESC
        `),
        !q.fromDate ? prisma.$queryRawUnsafe<any[]>(`
          SELECT dm."DistrictName" AS district, COUNT(*) AS TotalComplaints
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${yearNum - 1}-01-01' AND c."complRegDt" < '${yearNum}-01-01'
          GROUP BY dm."DistrictName"
        `) : Promise.resolve([]),
      ]);

      const prevMap = new Map(prevData.map((d: any) => [d.district, Number(d.totalcomplaints)]));

      const result = data.map((d: any) => ({
        district:        d.district,
        year:            yearNum,
        totalComplaints: Number(d.totalcomplaints),
        pending:         Number(d.pending),
        disposed:        Number(d.disposed),
        prevYearTotal:   prevMap.get(d.district) || 0,
      }));
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/district-wise] error:', msg);
      return sendError(reply, `Failed to load district-wise data: ${msg}`);
    }
  });

  /**
   * Month-wise trend — accepts all filter params.
   */
  fastify.get('/dashboard/month-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const CACHE_KEY = getRequestCacheKey('dashboard:month-wise', q);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const yearNum = q.year ? parseInt(q.year) : new Date().getFullYear();

      const datePart = q.fromDate && q.toDate
        ? `c."complRegDt" >= '${q.fromDate}' AND c."complRegDt" <= '${q.toDate}'`
        : `c."complRegDt" >= '${yearNum}-01-01' AND c."complRegDt" < '${yearNum + 1}-01-01'`;

      const extras: string[] = [];
      if (q.district) {
        const names = q.district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`dm."DistrictName" IN (${names})`);
      }
      if (q.source) {
        const srcs = q.source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`c."complaintSource" IN (${srcs})`);
      }
      if (q.complaintType) {
        const types = q.complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',');
        extras.push(`c."typeOfComplaint" IN (${types})`);
      }
      const extraWhere = extras.length ? `AND ${extras.join(' AND ')}` : '';

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(`
          SELECT
            EXTRACT(MONTH FROM c."complRegDt") AS monthNum,
            TO_CHAR(c."complRegDt", 'Month') AS monthName,
            COUNT(*) AS total,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true AND ${datePart} ${extraWhere}
          GROUP BY EXTRACT(MONTH FROM c."complRegDt"), TO_CHAR(c."complRegDt", 'Month')
          ORDER BY monthNum ASC
        `),
        !q.fromDate ? prisma.$queryRawUnsafe<any[]>(`
          SELECT EXTRACT(MONTH FROM c."complRegDt") AS monthNum, COUNT(*) AS total
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${yearNum - 1}-01-01' AND c."complRegDt" < '${yearNum}-01-01'
          GROUP BY EXTRACT(MONTH FROM c."complRegDt")
        `) : Promise.resolve([]),
      ]);

      const currMap = new Map(data.map((d: any) => [Number(d.monthnum), d]));
      const prevMap = new Map(prevData.map((d: any) => [Number(d.monthnum), Number(d.total)]));

      const ALL_MONTHS = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
      ];

      const result = ALL_MONTHS.map((monthName, idx) => {
        const mNum = idx + 1;
        const curr = currMap.get(mNum);
        return {
          month:     monthName,
          monthNum:  mNum,
          year:      yearNum,
          total:     curr ? Number(curr.total)    : 0,
          pending:   curr ? Number(curr.pending)  : 0,
          disposed:  curr ? Number(curr.disposed) : 0,
          prevTotal: prevMap.get(mNum) || 0,
        };
      });
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/month-wise] error:', msg);
      return sendError(reply, `Failed to load month-wise data: ${msg}`);
    }
  });

  /** Date-wise (custom range) */
  fastify.get('/dashboard/date-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const { fromDate, toDate } = q;
      if (!fromDate || !toDate) return sendError(reply, 'fromDate and toDate are required');

      const CACHE_KEY = getRequestCacheKey('dashboard:date-wise', q);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          dm."DistrictName" AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true
          AND c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'
        GROUP BY dm."DistrictName" ORDER BY TotalComplaints DESC
      `);

      const result = data.map((d: any) => ({
        district:        d.district,
        totalComplaints: Number(d.totalcomplaints),
        pending:         Number(d.pending),
        disposed:        Number(d.disposed),
      }));
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      console.error('[dashboard/date-wise] error:', error);
      return sendError(reply, 'Failed to load date-wise data');
    }
  });

  /** Duration-wise (backward compat alias) */
  fastify.get('/dashboard/duration-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const CACHE_KEY = getRequestCacheKey('dashboard:duration-wise', q);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const yearNum = q.year ? parseInt(q.year) : new Date().getFullYear();
      const extra = buildExtraWhere(q);

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          dm."DistrictName" AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true ${extra || `AND c."complRegDt" >= '${yearNum}-01-01' AND c."complRegDt" < '${yearNum + 1}-01-01'`}
        GROUP BY dm."DistrictName" ORDER BY TotalComplaints DESC
      `);

      const result = data.map((d: any) => ({
        district:        d.district,
        year:            yearNum,
        totalComplaints: Number(d.totalcomplaints),
        pending:         Number(d.pending),
        disposed:        Number(d.disposed),
      }));
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/duration-wise] error:', msg);
      return sendError(reply, `Failed to load duration-wise data: ${msg}`);
    }
  });
};