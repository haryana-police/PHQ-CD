import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const womenSafetyRoutes = async (fastify: FastifyInstance) => {
  // Filter options for dynamic dropdowns
  fastify.get('/women-safety/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const [districtRows, sourceRows, incidentRows, statusRows] = await prisma.$transaction([
      prisma.womenSafety.findMany({
        select: { addressDistrict: true },
        distinct: ['addressDistrict'],
        where: { addressDistrict: { not: null } },
        orderBy: { addressDistrict: 'asc' },
      }),
      prisma.womenSafety.findMany({
        select: { complaintSource: true },
        distinct: ['complaintSource'],
        where: { complaintSource: { not: null } },
        orderBy: { complaintSource: 'asc' },
      }),
      prisma.womenSafety.findMany({
        select: { incidentType: true },
        distinct: ['incidentType'],
        where: { incidentType: { not: null } },
        orderBy: { incidentType: 'asc' },
      }),
      prisma.womenSafety.findMany({
        select: { statusOfComplaint: true },
        distinct: ['statusOfComplaint'],
        where: { statusOfComplaint: { not: null } },
        orderBy: { statusOfComplaint: 'asc' },
      }),
    ]);
    return sendSuccess(reply, {
      districts: districtRows.map(r => r.addressDistrict).filter(Boolean),
      sources: sourceRows.map(r => r.complaintSource).filter(Boolean),
      incidentTypes: incidentRows.map(r => r.incidentType).filter(Boolean),
      statuses: statusRows.map(r => r.statusOfComplaint).filter(Boolean),
    });
  });

  fastify.get('/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        page = '1', limit = '100', search = '',
        fromDate, toDate, district, source, incidentType, status,
      } = request.query as Record<string, string>;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (search.trim()) {
        where.OR = [
          { firstName: { contains: search } },
          { mobile: { contains: search } },
          { complRegNum: { contains: search } },
        ];
      }

      if (fromDate || toDate) {
        where.complRegDt = {};
        if (fromDate) where.complRegDt.gte = new Date(fromDate);
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          where.complRegDt.lte = end;
        }
      }

      if (district) {
        const districts = district.split(',').map(d => d.trim()).filter(Boolean);
        if (districts.length === 1) where.addressDistrict = { contains: districts[0] };
        else if (districts.length > 1) where.addressDistrict = { in: districts };
      }

      if (source) {
        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        if (sources.length === 1) where.complaintSource = sources[0];
        else if (sources.length > 1) where.complaintSource = { in: sources };
      }

      if (incidentType) {
        const types = incidentType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length === 1) where.incidentType = types[0];
        else if (types.length > 1) where.incidentType = { in: types };
      }

      if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) where.statusOfComplaint = { contains: statuses[0] };
        else where.statusOfComplaint = { in: statuses };
      }

      const [records, total] = await prisma.$transaction([
        prisma.womenSafety.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { complRegDt: 'desc' },
        }),
        prisma.womenSafety.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('[women-safety list] error:', error);
      return sendSuccess(reply, { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
    }
  });

  fastify.get('/women-safety/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const record = await prisma.womenSafety.findUnique({ where: { id: parseInt(id) } });
    if (!record) return sendNotFound(reply, 'Record not found');
    return sendSuccess(reply, record);
  });

  fastify.post('/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const record = await prisma.womenSafety.create({ data });
    return sendSuccess(reply, record, 'Record created');
  });

  fastify.put('/women-safety/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const record = await prisma.womenSafety.update({ where: { id: parseInt(id) }, data });
    return sendSuccess(reply, record, 'Record updated');
  });

  fastify.delete('/women-safety/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.womenSafety.delete({ where: { id: parseInt(id) } });
    return sendSuccess(reply, null, 'Record deleted');
  });
};