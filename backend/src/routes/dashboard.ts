import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Dashboard Routes — Performance-optimised for 500K+ rows.
 *
 * KEY RULES that make queries index-friendly on SQL Server:
 *  1. NEVER use LIKE '%word%' (leading wildcard = full scan).
 *     All statuses start with 'Disposed-' or 'Pending-', so use LIKE 'Disposed%'.
 *  2. NEVER wrap a column in YEAR(col) or MONTH(col) in WHERE — it breaks the index.
 *     Use range: complRegDt >= '2024-01-01' AND complRegDt < '2025-01-01' instead.
 *  3. All heavy aggregation done in DB (GROUP BY), never in JS.
 */
export const dashboardRoutes = async (fastify: FastifyInstance) => {

  /**
   * Summary — mirrors Display_totalcomplaintsdata_pending SP.
   * Single SQL pass with SUM(CASE WHEN...) instead of 6 separate COUNT() calls.
   * Uses index-friendly LIKE 'Disposed%' (no leading wildcard).
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

      const [counts] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) AS totalReceived,

          -- Use LIKE 'Disposed%' NOT LIKE '%Disposed%' — index-safe prefix scan
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS totalDisposed,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS totalPending,

          -- Pending 15-30 days: registered between 15 and 30 days ago
          SUM(CASE WHEN
            (statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '')
            AND complRegDt >= '${f30}' AND complRegDt < '${f15}'
            THEN 1 ELSE 0 END) AS pending15,

          -- Pending 1-2 months: registered between 30 and 60 days ago
          SUM(CASE WHEN
            (statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '')
            AND complRegDt >= '${f60}' AND complRegDt < '${f30}'
            THEN 1 ELSE 0 END) AS pendingOver1,

          -- Pending over 2 months: registered more than 60 days ago
          SUM(CASE WHEN
            (statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '')
            AND complRegDt < '${f60}'
            THEN 1 ELSE 0 END) AS pendingOver2

        FROM Complaint
      `);

      return sendSuccess(reply, {
        totalReceived:        Number(counts.totalReceived  || 0),
        totalDisposed:        Number(counts.totalDisposed  || 0),
        totalPending:         Number(counts.totalPending   || 0),
        pendingOverFifteenDays: Number(counts.pending15    || 0),
        pendingOverOneMonth:  Number(counts.pendingOver1   || 0),
        pendingOverTwoMonths: Number(counts.pendingOver2   || 0),
      });
    } catch (error) {
      console.error('[dashboard/summary] error:', error);
      return sendError(reply, 'Failed to load dashboard summary');
    }
  });

  /**
   * District-wise — mirrors GetNormalizedDistrictComplaints SP.
   * Normalizes addressDistrict (UPPER + TRIM) to collapse casing/spacing variants.
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

      const data = await prisma.$queryRawUnsafe<Array<{
        district: string;
        TotalComplaints: number;
        Pending: number;
        Disposed: number;
      }>>(
        `SELECT TOP 22
          UPPER(LTRIM(RTRIM(ISNULL(addressDistrict, 'UNKNOWN')))) AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM Complaint
        WHERE complRegDt >= '${yearStart}' AND complRegDt < '${yearEnd}'
        GROUP BY UPPER(LTRIM(RTRIM(ISNULL(addressDistrict, 'UNKNOWN'))))
        ORDER BY TotalComplaints DESC`
      );

      return sendSuccess(reply, data.map(d => ({
        district: d.district,
        year: yearNum,
        totalComplaints: Number(d.TotalComplaints),
        pending: Number(d.Pending),
        disposed: Number(d.Disposed),
      })));
    } catch (error) {
      console.error('[dashboard/district-wise] error:', error);
      return sendError(reply, 'Failed to load district-wise data');
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
          ISNULL(addressDistrict, 'Unknown') AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM Complaint
        WHERE complRegDt >= '${yearStart}' AND complRegDt < '${yearEnd}'
        GROUP BY addressDistrict
        ORDER BY TotalComplaints DESC`
      );

      return sendSuccess(reply, data.map(d => ({
        district: d.district,
        year: yearNum,
        totalComplaints: Number(d.TotalComplaints),
        pending: Number(d.Pending),
        disposed: Number(d.Disposed),
      })));
    } catch (error) {
      console.error('[dashboard/duration-wise] error:', error);
      return sendError(reply, 'Failed to load duration-wise data');
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
          ISNULL(addressDistrict, 'Unknown') AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM Complaint
        WHERE complRegDt >= '${fromDate}' AND complRegDt <= '${toDate}'
        GROUP BY addressDistrict
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
   * Uses date range + DATEPART (index-safe) instead of YEAR(col).
   */
  fastify.get('/dashboard/month-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const data = await prisma.$queryRawUnsafe<Array<{
        monthNum: number;
        monthName: string;
        total: number;
        pending: number;
        disposed: number;
      }>>(
        `SELECT
          DATEPART(MONTH, complRegDt) AS monthNum,
          DATENAME(MONTH, complRegDt) AS monthName,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        WHERE complRegDt >= '${yearStart}' AND complRegDt < '${yearEnd}'
        GROUP BY DATEPART(MONTH, complRegDt), DATENAME(MONTH, complRegDt)
        ORDER BY monthNum ASC`
      );

      return sendSuccess(reply, data.map(d => ({
        month:    d.monthName,
        monthNum: Number(d.monthNum),
        year:     yearNum,
        total:    Number(d.total),
        pending:  Number(d.pending),
        disposed: Number(d.disposed),
      })));
    } catch (error) {
      console.error('[dashboard/month-wise] error:', error);
      return sendError(reply, 'Failed to load month-wise data');
    }
  });
};