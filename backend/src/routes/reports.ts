import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Official 22 Haryana districts — used to filter out non-Haryana entries
 * that entered the DB via CCTNS (complaints forwarded from other states).
 */
const HARYANA_DISTRICTS = [
  'AMBALA', 'BHIWANI', 'CHARKHI DADRI', 'FARIDABAD', 'FATEHABAD',
  'GURUGRAM', 'HISAR', 'JHAJJAR', 'JIND', 'KAITHAL', 'KARNAL',
  'KURUKSHETRA', 'MAHENDERGARH', 'NUH', 'PALWAL', 'PANCHKULA',
  'PANIPAT', 'REWARI', 'ROHTAK', 'SIRSA', 'SONIPAT', 'YAMUNANAGAR',
  // common aliases
  'YAMUNA NAGAR', 'MEWAT', 'GURGAON',
];

/** Build a SQL IN clause for Haryana district names (case-insensitive via UPPER) */
const HARYANA_IN = HARYANA_DISTRICTS.map(d => `'${d}'`).join(', ');
const HARYANA_WHERE_DISTRICT = `UPPER(LTRIM(RTRIM(COALESCE("addressDistrict",'')))) IN (${HARYANA_IN})`;

/** Build year-range WHERE clause — index-safe (no YEAR() function) */
function yearWhere(yearNum: number | null): string {
  if (!yearNum) return '';
  return `"complRegDt" >= '${yearNum}-01-01' AND "complRegDt" < '${yearNum + 1}-01-01'`;
}

/** Build WHERE clause combining year + Haryana district filter */
function buildWhere(yearNum: number | null, extraCondition = '', useDistrictFilter = false): string {
  const parts: string[] = [];
  if (yearNum) parts.push(yearWhere(yearNum));
  if (useDistrictFilter) parts.push(HARYANA_WHERE_DISTRICT);
  if (extraCondition) parts.push(extraCondition);
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

export const reportRoutes = async (fastify: FastifyInstance) => {

  // ── District-wise ─────────────────────────────────────────────────────────
  // Only Haryana's 22 districts. Defaults to current year, not all-time.
  fastify.get('/reports/district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      let whereParts: string[] = [HARYANA_WHERE_DISTRICT];
      if (fromDate && toDate) {
        whereParts.push(`"complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`);
      } else {
        whereParts.push(yearWhere(yearNum));
      }

      // Fetch current period
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          UPPER(LTRIM(RTRIM("addressDistrict"))) AS district,
          COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint"
        WHERE ${whereParts.join(' AND ')}
        GROUP BY UPPER(LTRIM(RTRIM("addressDistrict")))
        ORDER BY total DESC
      `);

      // Previous year comparison (always year-based)
      let prevData: any[] = [];
      if (!fromDate && !toDate && yearNum) {
        const prevYear = yearNum - 1;
        prevData = await prisma.$queryRawUnsafe<any[]>(`
          SELECT
            UPPER(LTRIM(RTRIM("addressDistrict"))) AS district,
            COUNT(*) AS total
          FROM "Complaint"
          WHERE ${HARYANA_WHERE_DISTRICT} AND "complRegDt" >= '${prevYear}-01-01' AND "complRegDt" < '${prevYear + 1}-01-01'
          GROUP BY UPPER(LTRIM(RTRIM("addressDistrict")))
        `);
      }

      const prevMap = new Map(prevData.map((r: any) => [r.district, Number(r.total)]));

      return sendSuccess(reply, {
        year: yearNum,
        rows: data.map((r: any) => ({
          district: r.district,
          total: Number(r.total),
          pending: Number(r.pending),
          disposed: Number(r.disposed),
          prevTotal: prevMap.get(r.district) || 0,
          change: prevMap.get(r.district)
            ? Math.round(((Number(r.total) - prevMap.get(r.district)!) / prevMap.get(r.district)!) * 100)
            : null,
        })),
      });
    } catch (e) {
      console.error('[reports/district]', e);
      return sendError(reply, 'Failed to load district report');
    }
  });

  // ── Mode of Receipt ───────────────────────────────────────────────────────
  fastify.get('/reports/mode-receipt', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const whereClause = fromDate && toDate
        ? `WHERE receptionMode IS NOT NULL AND receptionMode != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE receptionMode IS NOT NULL AND receptionMode != '' AND ${yearWhere(yearNum)}`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COALESCE(receptionMode,'Unknown') AS mode,
          COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause}
        GROUP BY receptionMode ORDER BY total DESC
      `);

      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ mode: r.mode, total: Number(r.total), count: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load mode-of-receipt report'); }
  });

  // ── Nature of Incident ────────────────────────────────────────────────────
  fastify.get('/reports/nature-incident', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const whereClause = fromDate && toDate
        ? `WHERE "classOfIncident" IS NOT NULL AND "classOfIncident" != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE "classOfIncident" IS NOT NULL AND "classOfIncident" != '' AND ${yearWhere(yearNum)}`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE("classOfIncident",'Unknown') AS natureOfIncident,
          COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause}
        GROUP BY "classOfIncident" ORDER BY total DESC
      `);

      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ natureOfIncident: r.natureofincident, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load nature-of-incident report'); }
  });

  // ── Type Against ──────────────────────────────────────────────────────────
  fastify.get('/reports/type-against', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE respondentCategories IS NOT NULL AND respondentCategories != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE respondentCategories IS NOT NULL AND respondentCategories != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(respondentCategories,'Unknown') AS typeAgainst, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY respondentCategories ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ typeAgainst: r.typeagainst, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load type-against report'); }
  });

  // ── Status ────────────────────────────────────────────────────────────────
  fastify.get('/reports/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE "statusOfComplaint" IS NOT NULL AND "statusOfComplaint" != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE "statusOfComplaint" IS NOT NULL AND "statusOfComplaint" != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT "statusOfComplaint" AS status, COUNT(*) AS total FROM "Complaint" ${whereClause}
        GROUP BY "statusOfComplaint" ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ status: r.status, total: Number(r.total), count: Number(r.total), pending: r.status?.startsWith('Pending') ? Number(r.total) : 0, disposed: r.status?.startsWith('Disposed') ? Number(r.total) : 0 })) });
    } catch (e) { return sendError(reply, 'Failed to load status report'); }
  });

  // ── Complaint Source ──────────────────────────────────────────────────────
  fastify.get('/reports/complaint-source', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE complaintSource IS NOT NULL AND complaintSource != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE complaintSource IS NOT NULL AND complaintSource != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(complaintSource,'Unknown') AS complaintSource, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY complaintSource ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ complaintSource: r.complaintsource, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load complaint-source report'); }
  });

  // ── Type of Complaint ─────────────────────────────────────────────────────
  fastify.get('/reports/type-complaint', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE "typeOfComplaint" IS NOT NULL AND "typeOfComplaint" != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE "typeOfComplaint" IS NOT NULL AND "typeOfComplaint" != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE("typeOfComplaint",'Unknown') AS "typeOfComplaint", COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY "typeOfComplaint" ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ typeOfComplaint: r.typeofcomplaint, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load type-of-complaint report'); }
  });

  // ── Branch-wise ───────────────────────────────────────────────────────────
  fastify.get('/reports/branch-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE branch IS NOT NULL AND branch != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE branch IS NOT NULL AND branch != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(branch,'Unknown') AS branch, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY branch ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ branch: r.branch, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load branch-wise report'); }
  });

  // ── Highlights ────────────────────────────────────────────────────────────
  fastify.get('/reports/highlights', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE("classOfIncident",'Unknown') AS category, COUNT(*) AS count
        FROM "Complaint" WHERE "classOfIncident" IS NOT NULL AND "classOfIncident" != '' AND ${yearWhere(yearNum)}
        GROUP BY "classOfIncident" ORDER BY count DESC
      `);
      return sendSuccess(reply, data.map((r: any) => ({ category: r.category, count: Number(r.count) })));
    } catch (e) { return sendError(reply, 'Failed to load highlights report'); }
  });

  // ── Date-wise ─────────────────────────────────────────────────────────────
  fastify.get('/reports/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { fromDate, toDate, year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      let whereParts: string[] = [HARYANA_WHERE_DISTRICT];
      if (fromDate && toDate) {
        whereParts.push(`"complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`);
      } else {
        whereParts.push(yearWhere(yearNum));
      }

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT UPPER(LTRIM(RTRIM(COALESCE("addressDistrict",'Unknown')))) AS district, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" WHERE ${whereParts.join(' AND ')}
        GROUP BY UPPER(LTRIM(RTRIM("addressDistrict"))) ORDER BY total DESC
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ district: r.district, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load date-wise report'); }
  });

  // ── Action Taken ──────────────────────────────────────────────────────────
  fastify.get('/reports/action-taken', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE actionTaken IS NOT NULL AND actionTaken != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE actionTaken IS NOT NULL AND actionTaken != '' AND ${yearWhere(yearNum)}`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(actionTaken,'Unknown') AS actionTaken, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY actionTaken ORDER BY total DESC LIMIT 30
      `);
      return sendSuccess(reply, { year: yearNum, rows: data.map((r: any) => ({ actionTaken: r.actiontaken, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) });
    } catch (e) { return sendError(reply, 'Failed to load action-taken report'); }
  });
};