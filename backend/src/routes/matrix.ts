import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Pendency and Disposal Matrix — all queries JOIN District_Master via resolvedDistrictId.
 * Accepts: year, fromDate, toDate, district (comma-separated names)
 */

function buildMatrixWhere(q: Record<string, string>): string {
  const parts: string[] = [];

  if (q.fromDate && q.toDate) {
    parts.push(`c."complRegDt" >= '${q.fromDate}' AND c."complRegDt" <= '${q.toDate}'`);
  } else {
    const y = q.year ? parseInt(q.year) : new Date().getFullYear();
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

  return parts.join(' AND ');
}

export const matrixRoutes = async (fastify: FastifyInstance) => {

  fastify.get('/matrix/pendency', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const yearNum = q.year ? parseInt(q.year) : new Date().getFullYear();
      const where = buildMatrixWhere(q);

      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          dm."DistrictName" AS district,

          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 <= 7
            THEN 1 ELSE 0 END) AS within7,

          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 > 7
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 <= 15
            THEN 1 ELSE 0 END) AS within15,

          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 > 15
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 <= 30
            THEN 1 ELSE 0 END) AS within30,

          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - c."complRegDt")) / 86400 > 30
            THEN 1 ELSE 0 END) AS over30,

          SUM(CASE WHEN
            (c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '')
            THEN 1 ELSE 0 END) AS totalPending,

          COUNT(*) AS totalReceived

        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND ${where}
        GROUP BY dm."DistrictName"
        ORDER BY totalPending DESC
      `);

      const totals = rows.reduce(
        (acc: any, r: any) => {
          acc.within7       += Number(r.within7       || 0);
          acc.within15      += Number(r.within15      || 0);
          acc.within30      += Number(r.within30      || 0);
          acc.over30        += Number(r.over30        || 0);
          acc.totalPending  += Number(r.totalpending  || 0);
          acc.totalReceived += Number(r.totalreceived || 0);
          return acc;
        },
        { within7: 0, within15: 0, within30: 0, over30: 0, totalPending: 0, totalReceived: 0 }
      );

      return sendSuccess(reply, {
        year: yearNum,
        rows: rows.map((r: any) => ({
          district:      r.district,
          within7:       Number(r.within7       || 0),
          within15:      Number(r.within15      || 0),
          within30:      Number(r.within30      || 0),
          over30:        Number(r.over30        || 0),
          totalPending:  Number(r.totalpending  || 0),
          totalReceived: Number(r.totalreceived || 0),
        })),
        totals,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[matrix/pendency] error:', msg);
      return sendError(reply, `Failed to load pendency matrix: ${msg}`);
    }
  });

  fastify.get('/matrix/disposal', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>;
      const yearNum = q.year ? parseInt(q.year) : new Date().getFullYear();
      const where = buildMatrixWhere(q);

      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          dm."DistrictName" AS district,

          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS totalDisposed,
          COUNT(*) AS totalReceived,

          SUM(CASE WHEN
            c."statusOfComplaint" ILIKE 'Disposed%'
            AND c."disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 <= 7
            THEN 1 ELSE 0 END) AS within7,

          SUM(CASE WHEN
            c."statusOfComplaint" ILIKE 'Disposed%'
            AND c."disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 > 7
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 <= 15
            THEN 1 ELSE 0 END) AS within15,

          SUM(CASE WHEN
            c."statusOfComplaint" ILIKE 'Disposed%'
            AND c."disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 > 15
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 <= 30
            THEN 1 ELSE 0 END) AS within30,

          SUM(CASE WHEN
            c."statusOfComplaint" ILIKE 'Disposed%'
            AND c."disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400 > 30
            THEN 1 ELSE 0 END) AS over30,

          ROUND(
            AVG(CASE WHEN
              c."statusOfComplaint" ILIKE 'Disposed%'
              AND c."disposalDate" IS NOT NULL
              AND c."complRegDt" IS NOT NULL
              THEN EXTRACT(EPOCH FROM (c."disposalDate" - c."complRegDt")) / 86400
              ELSE NULL END
            )::numeric, 1
          ) AS avgDisposalDays

        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND ${where}
        GROUP BY dm."DistrictName"
        ORDER BY totalDisposed DESC
      `);

      const totals = rows.reduce(
        (acc: any, r: any) => {
          acc.within7       += Number(r.within7       || 0);
          acc.within15      += Number(r.within15      || 0);
          acc.within30      += Number(r.within30      || 0);
          acc.over30        += Number(r.over30        || 0);
          acc.totalDisposed += Number(r.totaldisposed || 0);
          acc.totalReceived += Number(r.totalreceived || 0);
          return acc;
        },
        { within7: 0, within15: 0, within30: 0, over30: 0, totalDisposed: 0, totalReceived: 0 }
      );

      const { weightedSum, weightedCount } = rows.reduce(
        (acc: any, r: any) => {
          const avg = parseFloat(r.avgdisposaldays);
          const cnt = Number(r.totaldisposed || 0);
          if (!isNaN(avg) && cnt > 0) {
            acc.weightedSum   += avg * cnt;
            acc.weightedCount += cnt;
          }
          return acc;
        },
        { weightedSum: 0, weightedCount: 0 }
      );
      totals.avgDisposalDays = weightedCount > 0
        ? Math.round((weightedSum / weightedCount) * 10) / 10
        : null;

      return sendSuccess(reply, {
        year: yearNum,
        rows: rows.map((r: any) => ({
          district:        r.district,
          within7:         Number(r.within7       || 0),
          within15:        Number(r.within15      || 0),
          within30:        Number(r.within30      || 0),
          over30:          Number(r.over30        || 0),
          totalDisposed:   Number(r.totaldisposed || 0),
          totalReceived:   Number(r.totalreceived || 0),
          avgDisposalDays: r.avgdisposaldays != null ? Number(r.avgdisposaldays) : null,
        })),
        totals,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[matrix/disposal] error:', msg);
      return sendError(reply, `Failed to load disposal matrix: ${msg}`);
    }
  });
};
