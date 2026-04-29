import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const complaintRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        page = '1', limit = '100', search = '',
        fromDate, toDate,
        district, source, complaintType, status,
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

      // Multi-value district filter (comma-separated)
      if (district) {
        const districts = district.split(',').map(d => d.trim()).filter(Boolean);
        if (districts.length === 1) {
          where.addressDistrict = { contains: districts[0] };
        } else if (districts.length > 1) {
          where.addressDistrict = { in: districts };
        }
      }

      // Multi-value source filter
      if (source) {
        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        if (sources.length === 1) {
          where.complaintSource = sources[0];
        } else if (sources.length > 1) {
          where.complaintSource = { in: sources };
        }
      }

      // Multi-value complaint type filter
      if (complaintType) {
        const types = complaintType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length === 1) {
          where.typeOfComplaint = types[0];
        } else if (types.length > 1) {
          where.typeOfComplaint = { in: types };
        }
      }

      // Status filter
      if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
          where.statusOfComplaint = { contains: statuses[0] };
        } else if (statuses.length > 1) {
          where.OR = statuses.map(s => ({ statusOfComplaint: { contains: s } }));
        }
      }

      const [complaints, total] = await prisma.$transaction([
        prisma.complaint.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { id: 'desc' },
        }),
        prisma.complaint.count({ where }),
      ]);

      return sendSuccess(reply, {
        data: complaints,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('[complaints list] error:', error);
      return sendError(reply, 'Failed to fetch complaints');
    }
  });

  // Distinct filter options endpoint — used to dynamically populate dropdowns
  fastify.get('/complaints/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    try {
      const [districtRows, sourceRows, typeRows, statusRows] = await prisma.$transaction([
        prisma.complaint.findMany({
          select: { addressDistrict: true },
          distinct: ['addressDistrict'],
          where: { addressDistrict: { not: null } },
          orderBy: { addressDistrict: 'asc' },
        }),
        prisma.complaint.findMany({
          select: { complaintSource: true },
          distinct: ['complaintSource'],
          where: { complaintSource: { not: null } },
          orderBy: { complaintSource: 'asc' },
        }),
        prisma.complaint.findMany({
          select: { typeOfComplaint: true },
          distinct: ['typeOfComplaint'],
          where: { typeOfComplaint: { not: null } },
          orderBy: { typeOfComplaint: 'asc' },
        }),
        prisma.complaint.findMany({
          select: { statusOfComplaint: true },
          distinct: ['statusOfComplaint'],
          where: { statusOfComplaint: { not: null } },
          orderBy: { statusOfComplaint: 'asc' },
        }),
      ]);

      return sendSuccess(reply, {
        districts: districtRows.map(r => r.addressDistrict).filter(Boolean),
        sources: sourceRows.map(r => r.complaintSource).filter(Boolean),
        types: typeRows.map(r => r.typeOfComplaint).filter(Boolean),
        statuses: statusRows.map(r => r.statusOfComplaint).filter(Boolean),
      });
    } catch (error) {
      console.error('[complaints filter-options] error:', error);
      return sendError(reply, 'Failed to fetch filter options');
    }
  });

  fastify.get('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) return sendNotFound(reply, 'Complaint not found');
    return sendSuccess(reply, complaint);
  });

  fastify.post('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const result = await prisma.complaint.create({ data });
    return sendSuccess(reply, { id: result.id }, 'Complaint created successfully');
  });

  fastify.put('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const existing = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!existing) return sendNotFound(reply, 'Complaint not found');
    await prisma.complaint.update({ where: { id: complaintId }, data });
    return sendSuccess(reply, null, 'Complaint updated successfully');
  });

  fastify.delete('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) return sendError(reply, 'Invalid complaint ID', 400);
    const existing = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!existing) return sendNotFound(reply, 'Complaint not found');
    await prisma.complaint.delete({ where: { id: complaintId } });
    return sendSuccess(reply, null, 'Complaint deleted successfully');
  });
};