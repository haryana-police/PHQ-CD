import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const complaintRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { page = '1', limit = '10', search = '' } = request.query as Record<string, string>;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { complRegNum: { contains: search, mode: 'insensitive' } },
        { complDesc: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    const [complaints, total] = await Promise.all([
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
  });

  fastify.get('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return sendError(reply, 'Invalid complaint ID', 400);
    }
    
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      return sendNotFound(reply, 'Complaint not found');
    }

    return sendSuccess(reply, complaint);
  });

  fastify.post('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    
    const result = await prisma.complaint.create({
      data,
    });

    return sendSuccess(reply, { id: result.id }, 'Complaint created successfully');
  });

  fastify.put('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;

    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return sendError(reply, 'Invalid complaint ID', 400);
    }

    const existing = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!existing) {
      return sendNotFound(reply, 'Complaint not found');
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data,
    });

    return sendSuccess(reply, null, 'Complaint updated successfully');
  });

  fastify.delete('/complaints/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;

    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return sendError(reply, 'Invalid complaint ID', 400);
    }

    const existing = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!existing) {
      return sendNotFound(reply, 'Complaint not found');
    }

    await prisma.complaint.delete({
      where: { id: complaintId },
    });

    return sendSuccess(reply, null, 'Complaint deleted successfully');
  });
};