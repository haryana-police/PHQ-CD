import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const womenSafetyRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { page = '1', limit = '100', search = '' } = request.query as Record<string, string>;
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where = search.trim() ? {
        OR: [
          { firstName: { contains: search } },
          { mobile: { contains: search } },
          { complRegNum: { contains: search } },
        ],
      } : {};

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
    const record = await prisma.womenSafety.update({
      where: { id: parseInt(id) },
      data,
    });
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