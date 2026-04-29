import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * 22 canonical Haryana police districts — names match EXACTLY as stored in addressDistrict.
 * "addressDistrict" = the police district HANDLING the complaint (not complainant's home).
 * HANSI = tehsil of HISAR; DABWALI = tehsil of SIRSA — excluded as sub-district.
 * UPPER() applied in filter to collapse any casing variants in data.
 */
const HARYANA_DISTRICTS = [
  'AMBALA','BHIWANI','CHARKHI DADRI','FARIDABAD','FATEHABAD',
  'GURUGRAM','HISAR','JHAJJAR','JIND','KAITHAL','KARNAL',
  'KURUKSHETRA','MAHENDERGARH','NUH','PALWAL','PANCHKULA',
  'PANIPAT','REWARI','ROHTAK','SIRSA','SONIPAT','YAMUNA NAGAR',
];
const HARYANA_IN = HARYANA_DISTRICTS.map(d => `'${d}'`).join(', ');
// UPPER() on both sides ensures casing variants collapse correctly
const HARYANA_FILTER = `UPPER(LTRIM(RTRIM(COALESCE("addressDistrict",'')))) IN (${HARYANA_IN})`;

export const dashboardRoutes = async (fastify: FastifyInstance) => {

  /**
   * Summary — mirrors Display_totalcomplaintsdata_pending SP.
   * Single SQL pass with SUM(CASE WHEN...) instead of 6 separate COUNT() calls.
   * Uses index-friendly ILIKE 'Disposed%' (no leading wildcard).
   */
  fastify.get('/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const now = new Date();
      const f15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const f30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const f60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();

      const { year } = request.query as any;
      const yearFilter = year ? `AND EXTRACT(YEAR FROM "complRegDt") = ${Number(year)}` : '';

      const [counts] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) AS totalReceived,

          -- Use ILIKE 'Disposed%' NOT ILIKE '%Disposed%' — index-safe prefix scan
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS totalDisposed,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS totalPending,

          -- Pending 15-30 days: registered between 15 and 30 days ago
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND "complRegDt" >= '${f30}' AND "complRegDt" < '${f15}'
            THEN 1 ELSE 0 END) AS pending15,

          -- Pending 1-2 months: registered between 30 and 60 days ago
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND "complRegDt" >= '${f60}' AND "complRegDt" < '${f30}'
            THEN 1 ELSE 0 END) AS pendingOver1,

          -- Pending over 2 months: registered more than 60 days ago
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND "complRegDt" < '${f60}'
            THEN 1 ELSE 0 END) AS pendingOver2

        FROM "Complaint"
        WHERE ${HARYANA_FILTER} ${yearFilter}
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
   * District-wise — mirrors GetNormalizedDistrictComplaints SP.
   * Normalizes "addressDistrict" (UPPER + TRIM) to collapse casing/spacing variants.
   * Limits to TOP 22 (22 official Haryana districts) to keep charts clean.
   */
  fastify.get('/dashboard/district-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const prevYearStart = `${yearNum - 1}-01-01T00:00:00.000Z`;
      const prevYearEnd   = `${yearNum}-01-01T00:00:00.000Z`;

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{
          district: string;
          TotalComplaints: number;
          Pending: number;
          Disposed: number;
        }>>(
          `SELECT
            UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN')))) AS district,
            COUNT(*) AS TotalComplaints,
            SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
            SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
          FROM "Complaint"
          WHERE "complRegDt" >= '${yearStart}' AND "complRegDt" < '${yearEnd}'
            AND ${HARYANA_FILTER}
          GROUP BY UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN'))))
          ORDER BY TotalComplaints DESC LIMIT 22`
        ),
        prisma.$queryRawUnsafe<Array<{
          district: string;
          TotalComplaints: number;
        }>>(
          `SELECT UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN')))) AS district, COUNT(*) AS TotalComplaints
          FROM "Complaint"
          WHERE "complRegDt" >= '${prevYearStart}' AND "complRegDt" < '${prevYearEnd}'
            AND ${HARYANA_FILTER}
          GROUP BY UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN'))))`
        )
      ]);

      const prevMap = new Map(prevData.map((d: any) => [d.district, Number(d.totalcomplaints)]));

      return sendSuccess(reply, data.map((d: any) => ({
        district: d.district,
        year: yearNum,
        totalComplaints: Number(d.totalcomplaints),
        pending: Number(d.pending),
        disposed: Number(d.disposed),
        prevYearTotal: prevMap.get(d.district) || 0,
      })));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/district-wise] error:', msg);
      return sendError(reply, `Failed to load district-wise data: ${msg}`);
    }
  });

  /**
   * Duration-wise — mirrors Get_DurationWiseComplaints(@Year) SP.
   */
  fastify.get('/dashboard/duration-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const data = await prisma.$queryRawUnsafe<Array<{
        district: string;
        TotalComplaints: number;
        Pending: number;
        Disposed: number;
      }>>(
        `SELECT
          COALESCE("addressDistrict", 'Unknown') AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM "Complaint"
        WHERE "complRegDt" >= '${yearStart}' AND "complRegDt" < '${yearEnd}'
        GROUP BY "addressDistrict"
        ORDER BY TotalComplaints DESC`
      );

      return sendSuccess(reply, data.map((d: any) => ({
        district: d.district,
        year: yearNum,
        totalComplaints: Number(d.totalcomplaints),
        pending: Number(d.pending),
        disposed: Number(d.disposed),
      })));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/duration-wise] error:', msg);
      return sendError(reply, `Failed to load duration-wise data: ${msg}`);
    }
  });

  /**
   * Date-wise — mirrors Get_DatewiseChart_Complaints(@FromDate, @ToDate) SP.
   */
  fastify.get('/dashboard/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { fromDate, toDate } = request.query as Record<string, string>;

      if (!fromDate || !toDate) {
        return sendError(reply, 'fromDate and toDate are required');
      }

      const data = await prisma.$queryRawUnsafe<Array<{
        district: string;
        TotalComplaints: number;
        Pending: number;
        Disposed: number;
      }>>(
        `SELECT
          COALESCE("addressDistrict", 'Unknown') AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM "Complaint"
        WHERE "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'
        GROUP BY "addressDistrict"
        ORDER BY TotalComplaints DESC`
      );

      return sendSuccess(reply, data.map(d => ({
        district: d.district,
        totalComplaints: Number(d.TotalComplaints),
        pending: Number(d.Pending),
        disposed: Number(d.Disposed),
      })));
    } catch (error) {
      console.error('[dashboard/date-wise] error:', error);
      return sendError(reply, 'Failed to load date-wise data');
    }
  });

  /**
   * Month-wise trend — mirrors Display_totalcomplaints_monthwise_pending SP.
   * Uses date range + DATEPART (index-safe) instead of EXTRACT(YEAR FROM "col").
   */
  fastify.get('/dashboard/month-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const prevYearStart = `${yearNum - 1}-01-01T00:00:00.000Z`;
      const prevYearEnd   = `${yearNum}-01-01T00:00:00.000Z`;

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{
          monthNum: number;
          monthName: string;
          total: number;
          pending: number;
          disposed: number;
        }>>(
          `SELECT
            EXTRACT(MONTH FROM "complRegDt") AS monthNum,
            TO_CHAR("complRegDt", 'Month') AS monthName,
            COUNT(*) AS total,
            SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
          FROM "Complaint"
          WHERE "complRegDt" >= '${yearStart}' AND "complRegDt" < '${yearEnd}'
            AND ${HARYANA_FILTER}
          GROUP BY EXTRACT(MONTH FROM "complRegDt"), TO_CHAR("complRegDt", 'Month')
          ORDER BY monthNum ASC`
        ),
        prisma.$queryRawUnsafe<Array<{
          monthNum: number;
          total: number;
        }>>(
          `SELECT EXTRACT(MONTH FROM "complRegDt") AS monthNum, COUNT(*) AS total
          FROM "Complaint"
          WHERE "complRegDt" >= '${prevYearStart}' AND "complRegDt" < '${prevYearEnd}'
            AND ${HARYANA_FILTER}
          GROUP BY EXTRACT(MONTH FROM "complRegDt")`
        )
      ]);

      // PostgreSQL returns lowercase aliases — use lowercase keys
      const currMap = new Map(data.map((d: any) => [Number(d.monthnum), d]));
      const prevMap = new Map(prevData.map((d: any) => [Number(d.monthnum), Number(d.total)]));

      const ALL_MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const fullYearData = ALL_MONTHS.map((monthName, idx) => {
        const mNum = idx + 1;
        const curr = currMap.get(mNum);
        return {
          month: monthName,
          monthNum: mNum,
          year: yearNum,
          total: curr ? Number(curr.total) : 0,
          pending: curr ? Number(curr.pending) : 0,
          disposed: curr ? Number(curr.disposed) : 0,
          prevTotal: prevMap.get(mNum) || 0,
        };
      });

      return sendSuccess(reply, fullYearData);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[dashboard/month-wise] error:', msg);
      return sendError(reply, `Failed to load month-wise data: ${msg}`);
    }
  });
};