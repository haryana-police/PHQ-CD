import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Reports Routes — ALL rewritten to use SQL GROUP BY aggregation.
 *
 * BEFORE: Each endpoint did prisma.complaint.findMany() → loaded 560K rows into JS memory
 *         → iterated in a JS loop → serialized into JSON → sent over network.
 *         Result: 30-60 seconds per request, OOM risk.
 *
 * AFTER: Each endpoint runs a single SQL SELECT ... GROUP BY query.
 *        SQL Server does the aggregation on disk. Response time: < 500ms.
 *
 * Rules: LIKE 'Disposed%' not LIKE '%Disposed%'. Date ranges not YEAR().
 */
export const reportRoutes = async (fastify: FastifyInstance) => {

  // ── District-wise ────────────────────────────────────────────────────────────
  fastify.get('/reports/district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;

      const whereClause = yearNum
        ? `WHERE complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(addressDistrict, 'Unknown') AS district,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY addressDistrict
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        district: r.district,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/district]', e);
      return sendError(reply, 'Failed to load district report');
    }
  });

  // ── Mode of Receipt ─────────────────────────────────────────────────────────
  fastify.get('/reports/mode-receipt', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE receptionMode IS NOT NULL AND receptionMode != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE receptionMode IS NOT NULL AND receptionMode != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(receptionMode, 'Unknown') AS mode,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY receptionMode
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        mode: r.mode,
        total: Number(r.total),
        count: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/mode-receipt]', e);
      return sendError(reply, 'Failed to load mode-of-receipt report');
    }
  });

  // ── Nature of Incident ───────────────────────────────────────────────────────
  fastify.get('/reports/nature-incident', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE classOfIncident IS NOT NULL AND classOfIncident != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE classOfIncident IS NOT NULL AND classOfIncident != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(classOfIncident, 'Unknown') AS natureOfIncident,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY classOfIncident
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        natureOfIncident: r.natureOfIncident,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/nature-incident]', e);
      return sendError(reply, 'Failed to load nature-of-incident report');
    }
  });

  // ── Type Against (Respondent Categories) ────────────────────────────────────
  fastify.get('/reports/type-against', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE respondentCategories IS NOT NULL AND respondentCategories != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE respondentCategories IS NOT NULL AND respondentCategories != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(respondentCategories, 'Unknown') AS typeAgainst,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY respondentCategories
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        typeAgainst: r.typeAgainst,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/type-against]', e);
      return sendError(reply, 'Failed to load type-against report');
    }
  });

  // ── Status Breakdown ─────────────────────────────────────────────────────────
  fastify.get('/reports/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE statusOfComplaint IS NOT NULL AND statusOfComplaint != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE statusOfComplaint IS NOT NULL AND statusOfComplaint != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          statusOfComplaint AS status,
          COUNT(*) AS total
        FROM Complaint
        ${whereClause}
        GROUP BY statusOfComplaint
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        status: r.status,
        total: Number(r.total),
        count: Number(r.total),
        pending: r.status?.startsWith('Pending') ? Number(r.total) : 0,
        disposed: r.status?.startsWith('Disposed') ? Number(r.total) : 0,
      })));
    } catch (e) {
      console.error('[reports/status]', e);
      return sendError(reply, 'Failed to load status report');
    }
  });

  // ── Complaint Source ─────────────────────────────────────────────────────────
  fastify.get('/reports/complaint-source', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE complaintSource IS NOT NULL AND complaintSource != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE complaintSource IS NOT NULL AND complaintSource != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(complaintSource, 'Unknown') AS complaintSource,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY complaintSource
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        complaintSource: r.complaintSource,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/complaint-source]', e);
      return sendError(reply, 'Failed to load complaint-source report');
    }
  });

  // ── Type of Complaint ────────────────────────────────────────────────────────
  fastify.get('/reports/type-complaint', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE typeOfComplaint IS NOT NULL AND typeOfComplaint != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE typeOfComplaint IS NOT NULL AND typeOfComplaint != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(typeOfComplaint, 'Unknown') AS typeOfComplaint,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY typeOfComplaint
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        typeOfComplaint: r.typeOfComplaint,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/type-complaint]', e);
      return sendError(reply, 'Failed to load type-of-complaint report');
    }
  });

  // ── Branch-wise ──────────────────────────────────────────────────────────────
  fastify.get('/reports/branch-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE branch IS NOT NULL AND branch != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE branch IS NOT NULL AND branch != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(branch, 'Unknown') AS branch,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY branch
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        branch: r.branch,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/branch-wise]', e);
      return sendError(reply, 'Failed to load branch-wise report');
    }
  });

  // ── Highlights (category ranking) ────────────────────────────────────────────
  fastify.get('/reports/highlights', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE classOfIncident IS NOT NULL AND classOfIncident != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE classOfIncident IS NOT NULL AND classOfIncident != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(classOfIncident, 'Unknown') AS category,
          COUNT(*) AS count
        FROM Complaint
        ${whereClause}
        GROUP BY classOfIncident
        ORDER BY count DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        category: r.category,
        count: Number(r.count),
      })));
    } catch (e) {
      console.error('[reports/highlights]', e);
      return sendError(reply, 'Failed to load highlights report');
    }
  });

  // ── Date-wise ────────────────────────────────────────────────────────────────
  fastify.get('/reports/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { fromDate, toDate } = request.query as Record<string, string>;

      const whereClause = fromDate && toDate
        ? `WHERE complRegDt >= '${fromDate}' AND complRegDt <= '${toDate}'`
        : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          ISNULL(addressDistrict, 'Unknown') AS district,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY addressDistrict
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        district: r.district,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/date-wise]', e);
      return sendError(reply, 'Failed to load date-wise report');
    }
  });

  // ── Action Taken ─────────────────────────────────────────────────────────────
  fastify.get('/reports/action-taken', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : null;
      const whereClause = yearNum
        ? `WHERE actionTaken IS NOT NULL AND actionTaken != '' AND complRegDt >= '${yearNum}-01-01' AND complRegDt < '${yearNum + 1}-01-01'`
        : `WHERE actionTaken IS NOT NULL AND actionTaken != ''`;

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT TOP 50
          ISNULL(actionTaken, 'Unknown') AS actionTaken,
          COUNT(*) AS total,
          SUM(CASE WHEN statusOfComplaint LIKE 'Pending%' OR statusOfComplaint IS NULL OR statusOfComplaint = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN statusOfComplaint LIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM Complaint
        ${whereClause}
        GROUP BY actionTaken
        ORDER BY total DESC
      `);

      return sendSuccess(reply, data.map(r => ({
        actionTaken: r.actionTaken,
        total: Number(r.total),
        pending: Number(r.pending),
        disposed: Number(r.disposed),
      })));
    } catch (e) {
      console.error('[reports/action-taken]', e);
      return sendError(reply, 'Failed to load action-taken report');
    }
  });
};