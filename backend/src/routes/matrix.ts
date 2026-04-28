import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Official 22 Haryana districts — filters out non-Haryana / forwarded complaints.
 */
const HARYANA_DISTRICTS = [
  'AMBALA', 'BHIWANI', 'CHARKHI DADRI', 'FARIDABAD', 'FATEHABAD',
  'GURUGRAM', 'HISAR', 'JHAJJAR', 'JIND', 'KAITHAL', 'KARNAL',
  'KURUKSHETRA', 'MAHENDERGARH', 'NUH', 'PALWAL', 'PANCHKULA',
  'PANIPAT', 'REWARI', 'ROHTAK', 'SIRSA', 'SONIPAT', 'YAMUNANAGAR',
  // common aliases
  'YAMUNA NAGAR', 'MEWAT', 'GURGAON',
];
const HARYANA_IN  = HARYANA_DISTRICTS.map(d => `'${d}'`).join(', ');
const HARYANA_FILTER = `UPPER(LTRIM(RTRIM(COALESCE("addressDistrict",'')))) IN (${HARYANA_IN})`;

export const matrixRoutes = async (fastify: FastifyInstance) => {

  /**
   * GET /api/matrix/pendency?year=YYYY
   *
   * Returns district-wise pendency matrix with age buckets:
   *   ≤7 days | 8-15 days | 16-30 days | >30 days | Total Pending
   *
   * Only complaints whose status is Pending (or null / empty) are counted.
   */
  fastify.get('/matrix/pendency', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const now = new Date().toISOString();

      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN')))) AS district,

          -- ≤7 days pending (0-7)
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 <= 7
            THEN 1 ELSE 0 END) AS within7,

          -- 8-15 days pending
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 > 7
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 <= 15
            THEN 1 ELSE 0 END) AS within15,

          -- 16-30 days pending
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 > 15
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 <= 30
            THEN 1 ELSE 0 END) AS within30,

          -- >30 days pending
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            AND EXTRACT(EPOCH FROM (NOW() - "complRegDt")) / 86400 > 30
            THEN 1 ELSE 0 END) AS over30,

          -- Total pending (all ages)
          SUM(CASE WHEN
            ("statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '')
            THEN 1 ELSE 0 END) AS totalPending,

          -- Total received in that year
          COUNT(*) AS totalReceived

        FROM "Complaint"
        WHERE "complRegDt" >= '${yearStart}' AND "complRegDt" < '${yearEnd}'
          AND ${HARYANA_FILTER}
        GROUP BY UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN'))))
        ORDER BY totalPending DESC
      `);

      // Compute grand totals row
      const totals = rows.reduce(
        (acc: any, r: any) => {
          acc.within7    += Number(r.within7    || 0);
          acc.within15   += Number(r.within15   || 0);
          acc.within30   += Number(r.within30   || 0);
          acc.over30     += Number(r.over30     || 0);
          acc.totalPending += Number(r.totalpending || 0);
          acc.totalReceived += Number(r.totalreceived || 0);
          return acc;
        },
        { within7: 0, within15: 0, within30: 0, over30: 0, totalPending: 0, totalReceived: 0 }
      );

      return sendSuccess(reply, {
        year: yearNum,
        rows: rows.map((r: any) => ({
          district:      r.district,
          within7:       Number(r.within7    || 0),
          within15:      Number(r.within15   || 0),
          within30:      Number(r.within30   || 0),
          over30:        Number(r.over30     || 0),
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

  /**
   * GET /api/matrix/disposal?year=YYYY
   *
   * Returns district-wise disposal matrix with speed buckets:
   *   ≤7 days | 8-15 days | 16-30 days | >30 days | Total Disposed | Avg Disposal Days
   *
   * Disposal time = disposalDate - complRegDt (only where disposalDate IS NOT NULL).
   * Fallback: when disposalDate is null, we cannot compute duration — those are excluded
   * from the speed buckets but still counted in "totalDisposed" via status check.
   */
  fastify.get('/matrix/disposal', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const yearStart = `${yearNum}-01-01T00:00:00.000Z`;
      const yearEnd   = `${yearNum + 1}-01-01T00:00:00.000Z`;

      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN')))) AS district,

          -- Total disposed (by status, regardless of disposalDate presence)
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS totalDisposed,

          -- Total received
          COUNT(*) AS totalReceived,

          -- Speed buckets: only where disposalDate IS NOT NULL so we can compute duration
          SUM(CASE WHEN
            "statusOfComplaint" ILIKE 'Disposed%'
            AND "disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 <= 7
            THEN 1 ELSE 0 END) AS within7,

          SUM(CASE WHEN
            "statusOfComplaint" ILIKE 'Disposed%'
            AND "disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 > 7
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 <= 15
            THEN 1 ELSE 0 END) AS within15,

          SUM(CASE WHEN
            "statusOfComplaint" ILIKE 'Disposed%'
            AND "disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 > 15
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 <= 30
            THEN 1 ELSE 0 END) AS within30,

          SUM(CASE WHEN
            "statusOfComplaint" ILIKE 'Disposed%'
            AND "disposalDate" IS NOT NULL
            AND EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400 > 30
            THEN 1 ELSE 0 END) AS over30,

          -- Average disposal time in days (only for disposed with disposalDate)
          ROUND(
            AVG(CASE WHEN
              "statusOfComplaint" ILIKE 'Disposed%'
              AND "disposalDate" IS NOT NULL
              AND "complRegDt" IS NOT NULL
              THEN EXTRACT(EPOCH FROM ("disposalDate" - "complRegDt")) / 86400
              ELSE NULL END
            )::numeric, 1
          ) AS avgDisposalDays

        FROM "Complaint"
        WHERE "complRegDt" >= '${yearStart}' AND "complRegDt" < '${yearEnd}'
          AND ${HARYANA_FILTER}
        GROUP BY UPPER(LTRIM(RTRIM(COALESCE("addressDistrict", 'UNKNOWN'))))
        ORDER BY totalDisposed DESC
      `);

      // Compute grand totals
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

      // Weighted average disposal days across all districts
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
          district:      r.district,
          within7:       Number(r.within7       || 0),
          within15:      Number(r.within15      || 0),
          within30:      Number(r.within30      || 0),
          over30:        Number(r.over30        || 0),
          totalDisposed: Number(r.totaldisposed || 0),
          totalReceived: Number(r.totalreceived || 0),
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
