import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * All district-scoped queries JOIN "District_Master" via c."resolvedDistrictId"
 * and filter WHERE dm."isPoliceDistrict" = true.
 * No hardcoded district lists anywhere — the DB is the single source of truth.
 * resolvedDistrictId is populated from LEFT(complRegNum, 5) which = District_Master.id
 * as assigned by the Haryana Police API.
 */

export const dashboardRoutes = async (fastify: FastifyInstance) => {

  /**
   * Summary KPIs — uses resolvedDistrictId JOIN to scope to valid police districts.
   */
  fastify.get('/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const now = new Date();
      const f15  = new Date(now.getTime() - 15 * 86400000).toISOString();
      const f30  = new Date(now.getTime() - 30 * 86400000).toISOString();
      const f60  = new Date(now.getTime() - 60 * 86400000).toISOString();

      const { year } = request.query as any;
      const yearFilter = year
        ? `AND EXTRACT(YEAR FROM c."complRegDt") = ${Number(year)}`
        : '';

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
        WHERE dm."isPoliceDistrict" = true ${yearFilter}
      `);

      return sendSuccess(reply, {
        totalReceived:          Number(counts.totalreceived  || 0),
        totalDisposed:          Number(counts.totaldisposed  || 0),
        totalPending:           Number(counts.totalpending   || 0),
        pendingOverFifteenDays: Number(counts.pending15      || 0),
        pendingOverOneMonth:    Number(counts.pendingover1   || 0),
        pendingOverTwoMonths:   Number(counts.pendingover2   || 0),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/summary] error:', msg);
      return sendError(reply, `Failed to load dashboard summary: ${msg}`);
    }
  });

  /**
   * District-wise chart — groups by District_Master.DistrictName.
   * Includes HANSI, DABWALI and all police districts from District_Master.
   */
  fastify.get('/dashboard/district-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart    = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd      = `${yearNum + 1}-01-01T00:00:00.000Z`;
      const prevYearStart = `${yearNum - 1}-01-01T00:00:00.000Z`;
      const prevYearEnd  = `${yearNum}-01-01T00:00:00.000Z`;

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(`
          SELECT
            dm."DistrictName" AS district,
            COUNT(*) AS TotalComplaints,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${yearStart}' AND c."complRegDt" < '${yearEnd}'
          GROUP BY dm."DistrictName"
          ORDER BY TotalComplaints DESC
        `),
        prisma.$queryRawUnsafe<any[]>(`
          SELECT dm."DistrictName" AS district, COUNT(*) AS TotalComplaints
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${prevYearStart}' AND c."complRegDt" < '${prevYearEnd}'
          GROUP BY dm."DistrictName"
        `),
      ]);

      const prevMap = new Map(prevData.map((d: any) => [d.district, Number(d.totalcomplaints)]));

      return sendSuccess(reply, data.map((d: any) => ({
        district:        d.district,
        year:            yearNum,
        totalComplaints: Number(d.totalcomplaints),
        pending:         Number(d.pending),
        disposed:        Number(d.disposed),
        prevYearTotal:   prevMap.get(d.district) || 0,
      })));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/district-wise] error:', msg);
      return sendError(reply, `Failed to load district-wise data: ${msg}`);
    }
  });

  /**
   * Month-wise trend.
   */
  fastify.get('/dashboard/month-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart     = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd       = `${yearNum + 1}-01-01T00:00:00.000Z`;
      const prevYearStart = `${yearNum - 1}-01-01T00:00:00.000Z`;
      const prevYearEnd   = `${yearNum}-01-01T00:00:00.000Z`;

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
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${yearStart}' AND c."complRegDt" < '${yearEnd}'
          GROUP BY EXTRACT(MONTH FROM c."complRegDt"), TO_CHAR(c."complRegDt", 'Month')
          ORDER BY monthNum ASC
        `),
        prisma.$queryRawUnsafe<any[]>(`
          SELECT EXTRACT(MONTH FROM c."complRegDt") AS monthNum, COUNT(*) AS total
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${prevYearStart}' AND c."complRegDt" < '${prevYearEnd}'
          GROUP BY EXTRACT(MONTH FROM c."complRegDt")
        `),
      ]);

      const currMap = new Map(data.map((d: any) => [Number(d.monthnum), d]));
      const prevMap = new Map(prevData.map((d: any) => [Number(d.monthnum), Number(d.total)]));

      const ALL_MONTHS = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
      ];

      return sendSuccess(reply, ALL_MONTHS.map((monthName, idx) => {
        const mNum = idx + 1;
        const curr = currMap.get(mNum);
        return {
          month:     monthName,
          monthNum:  mNum,
          year:      yearNum,
          total:     curr ? Number(curr.total)   : 0,
          pending:   curr ? Number(curr.pending) : 0,
          disposed:  curr ? Number(curr.disposed): 0,
          prevTotal: prevMap.get(mNum) || 0,
        };
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/month-wise] error:', msg);
      return sendError(reply, `Failed to load month-wise data: ${msg}`);
    }
  });

  /**
   * Date-wise (custom range) — same JOIN pattern.
   */
  fastify.get('/dashboard/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { fromDate, toDate } = request.query as Record<string, string>;
      if (!fromDate || !toDate) return sendError(reply, 'fromDate and toDate are required');

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
        GROUP BY dm."DistrictName"
        ORDER BY TotalComplaints DESC
      `);

      return sendSuccess(reply, data.map((d: any) => ({
        district:       d.district,
        totalComplaints:Number(d.totalcomplaints),
        pending:        Number(d.pending),
        disposed:       Number(d.disposed),
      })));
    } catch (error) {
      console.error('[dashboard/date-wise] error:', error);
      return sendError(reply, 'Failed to load date-wise data');
    }
  });

  /**
   * Duration-wise (same as district-wise but kept for backward compat).
   */
  fastify.get('/dashboard/duration-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          dm."DistrictName" AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true
          AND c."complRegDt" >= '${yearStart}' AND c."complRegDt" < '${yearEnd}'
        GROUP BY dm."DistrictName"
        ORDER BY TotalComplaints DESC
      `);

      return sendSuccess(reply, data.map((d: any) => ({
        district:       d.district,
        year:           yearNum,
        totalComplaints:Number(d.totalcomplaints),
        pending:        Number(d.pending),
        disposed:       Number(d.disposed),
      })));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/duration-wise] error:', msg);
      return sendError(reply, `Failed to load duration-wise data: ${msg}`);
    }
  });
};