import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const cctnsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/cctns', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Limit to latest 500 records to prevent hanging
    const records = await prisma.cCTNSComplaint.findMany({ 
      orderBy: { firDate: 'desc' },
      take: 500
    });
    return sendSuccess(reply, records);
  });

  fastify.get('/cctns/district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Use database-level grouping instead of fetching all records
    const counts = await prisma.cCTNSComplaint.groupBy({
      by: ['compCategory'],
      _count: {
        _all: true
      }
    });
    
    const data = counts.map(c => ({ 
      district: c.compCategory || 'Unknown', 
      count: c._count._all 
    }));
    
    return sendSuccess(reply, data);
  });

  fastify.get('/cctns/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const record = await prisma.cCTNSComplaint.findUnique({ where: { id: parseInt(id) } });
    if (!record) return sendNotFound(reply, 'Record not found');
    return sendSuccess(reply, record);
  });

  fastify.post('/cctns', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = request.body as Record<string, any>;
    const record = await prisma.cCTNSComplaint.create({ data });
    return sendSuccess(reply, record, 'Record created');
  });

  fastify.put('/cctns/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const data = request.body as Record<string, any>;
    const record = await prisma.cCTNSComplaint.update({
      where: { id: parseInt(id) },
      data,
    });
    return sendSuccess(reply, record, 'Record updated');
  });

  fastify.delete('/cctns/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.cCTNSComplaint.delete({ where: { id: parseInt(id) } });
    return sendSuccess(reply, null, 'Record deleted');
  });
};