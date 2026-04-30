import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

/**
 * All district-scoped report queries JOIN "District_Master" via c."resolvedDistrictId"
 * WHERE dm."isPoliceDistrict" = true  — no hardcoded district lists anywhere.
 *
 * Sources come from "tb_received_from", types from "tb_nature_complaints" — seeded from
 * actual Complaint data and updated by the /gov/sync-reference endpoint.
 */

/** Build year-range WHERE clause — index-safe */
function yearWhere(yearNum: number | null): string {
  if (!yearNum) return '';
  return `c."complRegDt" >= '${yearNum}-01-01' AND c."complRegDt" < '${yearNum + 1}-01-01'`;
}

import { getCached, setCached, getRequestCacheKey } from '../utils/cache.js';

export const reportRoutes = async (fastify: FastifyInstance) => {

  /**
   * GET /api/reports/filter-options
   * Returns district list (from District_Master), sources (from tb_received_from),
   * types (from tb_nature_complaints) — all DB-driven, no hardcoded lists.
   */
  fastify.get('/reports/filter-options', { preHandler: [authenticate] }, async (_req, reply) => {
    const CACHE_KEY = 'reports:filter-options';
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return sendSuccess(reply, cached);

    const [districtRows, sourceRows, typeRows, yearRows] = await Promise.all([
      prisma.$queryRaw<{ val: string }[]>`
        SELECT "DistrictName" AS val FROM "District_Master"
        WHERE "isPoliceDistrict" = true ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT "recieved_from" AS val FROM "tb_received_from"
        WHERE "recieved_from" IS NOT NULL AND "recieved_from" <> ''
        ORDER BY val`,
      prisma.$queryRaw<{ val: string }[]>`
        SELECT "nature_complaints" AS val FROM "tb_nature_complaints"
        WHERE "nature_complaints" IS NOT NULL AND "nature_complaints" <> ''
        ORDER BY val`,
      prisma.$queryRaw<{ val: number }[]>`
        SELECT DISTINCT EXTRACT(YEAR FROM c."complRegDt")::int AS val
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."complRegDt" IS NOT NULL
        ORDER BY val DESC`,
    ]);

    const result = {
      districts: districtRows.map(r => r.val),
      sources:   sourceRows.map(r => r.val),
      types:     typeRows.map(r => r.val),
      years:     yearRows.map(r => r.val),
    };
    setCached(CACHE_KEY, result);
    return sendSuccess(reply, result);
  });

  // ── District-wise (uses resolvedDistrictId JOIN — no hardcoded list)
  fastify.get('/reports/district', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:district', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district, source, complaintType } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);

      const extra: string[] = [];
      if (district) {
        const names = district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`dm."DistrictName" IN (${names})`);
      }
      if (source) {
        const srcs = source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`c."complaintSource" IN (${srcs})`);
      }
      if (complaintType) {
        const types = complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`c."typeOfComplaint" IN (${types})`);
      }

      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const [data, prevData] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(`
          SELECT dm."DistrictName" AS district,
            COUNT(*) AS total,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true AND ${datePart} ${extraWhere}
          GROUP BY dm."DistrictName" ORDER BY total DESC
        `),
        !fromDate && !toDate ? prisma.$queryRawUnsafe<any[]>(`
          SELECT dm."DistrictName" AS district, COUNT(*) AS total
          FROM "Complaint" c
          JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
          WHERE dm."isPoliceDistrict" = true
            AND c."complRegDt" >= '${yearNum - 1}-01-01' AND c."complRegDt" < '${yearNum}-01-01'
          GROUP BY dm."DistrictName"
        `) : Promise.resolve([]),
      ]);

      const prevMap = new Map(prevData.map((r: any) => [r.district, Number(r.total)]));

      const result = {
        year: yearNum,
        rows: data.map((r: any) => ({
          district:  r.district,
          total:     Number(r.total),
          pending:   Number(r.pending),
          disposed:  Number(r.disposed),
          prevTotal: prevMap.get(r.district) || 0,
          change:    prevMap.get(r.district)
            ? Math.round(((Number(r.total) - prevMap.get(r.district)!) / prevMap.get(r.district)!) * 100)
            : null,
        })),
      };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) {
      console.error('[reports/district]', e);
      return sendError(reply, 'Failed to load district report');
    }
  });

  // ── Date-wise (uses resolvedDistrictId JOIN)
  fastify.get('/reports/date-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:date-wise', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { fromDate, toDate, year, district, source, complaintType } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);

      const extra: string[] = [];
      if (district) {
        const names = district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`dm."DistrictName" IN (${names})`);
      }
      if (source) {
        const srcs = source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`c."complaintSource" IN (${srcs})`);
      }
      if (complaintType) {
        const types = complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',');
        extra.push(`c."typeOfComplaint" IN (${types})`);
      }
      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT dm."DistrictName" AS district,
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND ${datePart} ${extraWhere}
        GROUP BY dm."DistrictName" ORDER BY total DESC
      `);

      const result = {
        year: yearNum,
        rows: data.map((r: any) => ({ district: r.district, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })),
      };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load date-wise report'); }
  });

  // ── Mode of Receipt
  fastify.get('/reports/mode-receipt', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:mode-receipt', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);
      const districtFilter = district
        ? `AND dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`
        : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."receptionMode",'Unknown') AS mode,
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."receptionMode" IS NOT NULL AND c."receptionMode" != ''
          AND ${datePart} ${districtFilter}
        GROUP BY c."receptionMode" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ mode: r.mode, total: Number(r.total), count: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load mode-of-receipt report'); }
  });

  // ── Nature of Incident
  fastify.get('/reports/nature-incident', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:nature-incident', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district, source, complaintType } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);

      const extra: string[] = [];
      if (district) extra.push(`dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (source)   extra.push(`c."complaintSource" IN (${source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (complaintType) extra.push(`c."typeOfComplaint" IN (${complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',')})`);
      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."classOfIncident",'Unknown') AS natureOfIncident,
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."classOfIncident" IS NOT NULL AND c."classOfIncident" != ''
          AND ${datePart} ${extraWhere}
        GROUP BY c."classOfIncident" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ natureOfIncident: r.natureofincident, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load nature-of-incident report'); }
  });



  // ── Type Against
  fastify.get('/reports/type-against', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:type-against', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);
      const districtFilter = district
        ? `AND dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`
        : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."respondentCategories",'Unknown') AS typeAgainst,
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."respondentCategories" IS NOT NULL AND c."respondentCategories" != ''
          AND ${datePart} ${districtFilter}
        GROUP BY c."respondentCategories" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ typeAgainst: r.typeagainst, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load type-against report'); }
  });

  // ── Status
  fastify.get('/reports/status', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:status', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);
      const districtFilter = district
        ? `AND dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`
        : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT c."statusOfComplaint" AS status, COUNT(*) AS total
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."statusOfComplaint" IS NOT NULL AND c."statusOfComplaint" != ''
          AND ${datePart} ${districtFilter}
        GROUP BY c."statusOfComplaint" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ status: r.status, total: Number(r.total), count: Number(r.total), pending: r.status?.startsWith('Pending') ? Number(r.total) : 0, disposed: r.status?.startsWith('Disposed') ? Number(r.total) : 0 })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load status report'); }
  });

  // ── Complaint Source
  fastify.get('/reports/complaint-source', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:complaint-source', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district, complaintType } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);
      const extra: string[] = [];
      if (district) extra.push(`dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (complaintType) extra.push(`c."typeOfComplaint" IN (${complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',')})`);
      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."complaintSource",'Unknown') AS complaintSource,
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."complaintSource" IS NOT NULL AND c."complaintSource" != ''
          AND ${datePart} ${extraWhere}
        GROUP BY c."complaintSource" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ complaintSource: r.complaintsource, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load complaint-source report'); }
  });

  // ── Type of Complaint
  fastify.get('/reports/type-complaint', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:type-complaint', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district, source } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : yearWhere(yearNum);
      const extra: string[] = [];
      if (district) extra.push(`dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (source) extra.push(`c."complaintSource" IN (${source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',')})`);
      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."typeOfComplaint",'Unknown') AS "typeOfComplaint",
          COUNT(*) AS total,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Pending%' OR c."statusOfComplaint" IS NULL OR c."statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN c."statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true AND c."typeOfComplaint" IS NOT NULL AND c."typeOfComplaint" != ''
          AND ${datePart} ${extraWhere}
        GROUP BY c."typeOfComplaint" ORDER BY total DESC
      `);

      const result = { year: yearNum, rows: data.map((r: any) => ({ typeOfComplaint: r.typeofcomplaint, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load type-of-complaint report'); }
  });

  // ── Branch-wise
  fastify.get('/reports/branch-wise', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:branch-wise', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE branch IS NOT NULL AND branch != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE branch IS NOT NULL AND branch != '' AND "complRegDt" >= '${yearNum}-01-01' AND "complRegDt" < '${yearNum + 1}-01-01'`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(branch,'Unknown') AS branch, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY branch ORDER BY total DESC
      `);
      const result = { year: yearNum, rows: data.map((r: any) => ({ branch: r.branch, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load branch-wise report'); }
  });

  // ── Highlights (top categories by classOfIncident)
  fastify.get('/reports/highlights', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:highlights', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate, district, source, complaintType } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      const datePart = fromDate && toDate
        ? `c."complRegDt" >= '${fromDate}' AND c."complRegDt" <= '${toDate}'`
        : `c."complRegDt" >= '${yearNum}-01-01' AND c."complRegDt" < '${yearNum + 1}-01-01'`;

      const extra: string[] = [];
      if (district) extra.push(`dm."DistrictName" IN (${district.split(',').map(d => `'${d.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (source)   extra.push(`c."complaintSource" IN (${source.split(',').map(s => `'${s.trim().replace(/'/g, "''")}'`).join(',')})`);
      if (complaintType) extra.push(`c."typeOfComplaint" IN (${complaintType.split(',').map(t => `'${t.trim().replace(/'/g, "''")}'`).join(',')})`);
      const extraWhere = extra.length ? `AND ${extra.join(' AND ')}` : '';

      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(c."classOfIncident",'Unknown') AS category, COUNT(*) AS count
        FROM "Complaint" c
        JOIN "District_Master" dm ON dm.id = c."resolvedDistrictId"
        WHERE dm."isPoliceDistrict" = true
          AND c."classOfIncident" IS NOT NULL AND c."classOfIncident" != ''
          AND ${datePart} ${extraWhere}
        GROUP BY c."classOfIncident" ORDER BY count DESC
      `);
      const result = { year: yearNum, rows: data.map((r: any) => ({ category: r.category, count: Number(r.count) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load highlights report'); }
  });



  // ── Action Taken
  fastify.get('/reports/action-taken', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const CACHE_KEY = getRequestCacheKey('reports:action-taken', request.query);
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return sendSuccess(reply, cached);

      const { year, fromDate, toDate } = request.query as Record<string, string>;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      const whereClause = fromDate && toDate
        ? `WHERE actionTaken IS NOT NULL AND actionTaken != '' AND "complRegDt" >= '${fromDate}' AND "complRegDt" <= '${toDate}'`
        : `WHERE actionTaken IS NOT NULL AND actionTaken != '' AND "complRegDt" >= '${yearNum}-01-01' AND "complRegDt" < '${yearNum + 1}-01-01'`;
      const data = await prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(actionTaken,'Unknown') AS actionTaken, COUNT(*) AS total,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Pending%' OR "statusOfComplaint" IS NULL OR "statusOfComplaint" = '' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN "statusOfComplaint" ILIKE 'Disposed%' THEN 1 ELSE 0 END) AS disposed
        FROM "Complaint" ${whereClause} GROUP BY actionTaken ORDER BY total DESC LIMIT 30
      `);
      const result = { year: yearNum, rows: data.map((r: any) => ({ actionTaken: r.actiontaken, total: Number(r.total), pending: Number(r.pending), disposed: Number(r.disposed) })) };
      setCached(CACHE_KEY, result);
      return sendSuccess(reply, result);
    } catch (e) { return sendError(reply, 'Failed to load action-taken report'); }
  });
};