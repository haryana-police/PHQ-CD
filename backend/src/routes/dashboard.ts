import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Dashboard Routes
 * Mirrors old project stored procedure logic but using Prisma's SQL aggregation.
 * All heavy aggregations done in the DATABASE (not in JS) to handle 300K+ records fast.
 *
 * Old SP equivalents:
 * - Display_totalcomplaintsdata_pending     → /dashboard/summary
 * - GetNormalizedDistrictComplaints         → /dashboard/district-wise
 * - Get_DurationWiseComplaints (@Year)      → /dashboard/duration-wise?year=2024
 * - Get_DatewiseChart_Complaints (@From,@To)→ /dashboard/date-wise?fromDate=&toDate=
 * - Display_totalcomplaints_monthwise_pending→ /dashboard/month-wise?year=2024
 */
export const dashboardRoutes = async (fastify: FastifyInstance) => {

  /**
   * Summary counts — mirrors Display_totalcomplaintsdata_pending SP
   * All counts done via SQL COUNT on DB, not JS loop
   */
  fastify.get('/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const oneMonthAgo    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const twoMonthsAgo   = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [counts] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          COUNT(*) as totalReceived,
          SUM(CASE WHEN statusOfComplaint LIKE '%Disposed%' THEN 1 ELSE 0 END) as totalDisposed,
          SUM(CASE WHEN statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) as totalPending,
          
          SUM(CASE WHEN 
            (statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '') 
            AND complRegDt <= '${fifteenDaysAgo}' AND complRegDt > '${oneMonthAgo}' 
            THEN 1 ELSE 0 END) as pending15,
            
          SUM(CASE WHEN 
            (statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '') 
            AND complRegDt <= '${oneMonthAgo}' AND complRegDt > '${twoMonthsAgo}' 
            THEN 1 ELSE 0 END) as pendingOver1,
            
          SUM(CASE WHEN 
            (statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '') 
            AND complRegDt <= '${twoMonthsAgo}' 
            THEN 1 ELSE 0 END) as pendingOver2
        FROM Complaint
      `);

      return sendSuccess(reply, {
        totalReceived: Number(counts.totalReceived || 0),
        totalDisposed: Number(counts.totalDisposed || 0),
        totalPending: Number(counts.totalPending || 0),
        pendingOverFifteenDays: Number(counts.pending15 || 0),
        pendingOverOneMonth: Number(counts.pendingOver1 || 0),
        pendingOverTwoMonths: Number(counts.pendingOver2 || 0),
      });
    } catch (error) {
      return sendError(reply, 'Failed to load dashboard summary');
    }
  });

  /**
   * District-wise complaints — mirrors GetNormalizedDistrictComplaints SP
   * Uses raw SQL GROUP BY for performance. Accepts optional year filter.
   * Old project: no date filter on district chart (shows all-time by district)
   */
  fastify.get('/dashboard/district-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;

      // Use raw SQL GROUP BY — this is what the old SP did
      // Much faster than fetching all rows and grouping in JS
      let whereClause = '';
      const params: unknown[] = [];

      if (yearNum) {
        whereClause = `WHERE YEAR(complRegDt) = ${yearNum}`;
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
          SUM(CASE WHEN statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE '%Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM Complaint
        ${whereClause}
        GROUP BY addressDistrict
        ORDER BY TotalComplaints DESC`
      );

      return sendSuccess(reply, data);
    } catch (error) {
      console.error('[dashboard/district-wise] error:', error);
      return sendError(reply, 'Failed to load district-wise data');
    }
  });

  /**
   * Duration-wise complaints by month — mirrors Get_DurationWiseComplaints(@Year) SP
   * Required year param — same as old project dropdown that defaulted to current year
   */
  fastify.get('/dashboard/duration-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const data = await prisma.$queryRawUnsafe<Array<{
        district: string;
        TotalComplaints: number;
        Pending: number;
        Disposed: number;
      }>>(
        `SELECT 
          ISNULL(addressDistrict, 'Unknown') AS district,
          COUNT(*) AS TotalComplaints,
          SUM(CASE WHEN statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE '%Disposed%' THEN 1 ELSE 0 END) AS Disposed
        FROM Complaint
        WHERE YEAR(complRegDt) = ${yearNum}
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
   * Date-wise chart — mirrors Get_DatewiseChart_Complaints(@FromDate, @ToDate) SP
   * Both dates are REQUIRED — same as old project which had date pickers
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
          SUM(CASE WHEN statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN statusOfComplaint LIKE '%Disposed%' THEN 1 ELSE 0 END) AS Disposed
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
   * Month-wise trend — mirrors Display_totalcomplaints_monthwise_pending SP
   * Filtered by year. Returns monthly totals for trend chart.
   */
  fastify.get('/dashboard/month-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const data = await prisma.$queryRawUnsafe<Array<{
        monthNum: number;
        monthName: string;
        total: number;
        pending: number;
        disposed: number;
      }>>(
        `SELECT 
          MONTH(complRegDt) AS monthNum,
          DATENAME(MONTH, complRegDt) AS monthName,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE '%Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE '%Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        WHERE complRegDt IS NOT NULL AND YEAR(complRegDt) = ${yearNum}
        GROUP BY MONTH(complRegDt), DATENAME(MONTH, complRegDt)
        ORDER BY monthNum ASC`
      );

      return sendSuccess(reply, data.map(d => ({
        month: d.monthName,
        monthNum: Number(d.monthNum),
        year: yearNum,
        total: Number(d.total),
        pending: Number(d.pending),
        disposed: Number(d.disposed),
      })));
    } catch (error) {
      console.error('[dashboard/month-wise] error:', error);
      return sendError(reply, 'Failed to load month-wise data');
    }
  });
};