import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const complaintRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { page = '1', limit = '10', search = '' } = request.query as Record<string, string>;
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Only apply the expensive OR query if there's an actual search term.
      // Otherwise, Prisma might construct a slow query tree.
      const where = search.trim() ? {
        OR: [
          { firstName: { contains: search } },
          { mobile: { contains: search } },
          { complRegNum: { contains: search } },
        ],
      } : {};

      const [complaints, total] = await prisma.$transaction([
        prisma.complaint.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { id: 'desc' },
        }),
        // For empty search, rely on fast index count
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