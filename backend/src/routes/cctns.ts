import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendNotFound } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const cctnsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/cctns', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const records = await prisma.cCTNSComplaint.findMany({ orderBy: { firDate: 'desc' } });
    return sendSuccess(reply, records);
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

  fastify.get('/cctns/district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const records = await prisma.cCTNSComplaint.findMany();
    const districtMap = new Map();
    for (const record of records) {
      const name = record.compCategory || 'Unknown';
      districtMap.set(name, (districtMap.get(name) || 0) + 1);
    }
    const data = Array.from(districtMap.entries()).map(([district, count]) => ({ district, count }));
    return sendSuccess(reply, data);
  });
};