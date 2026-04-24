import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const referenceRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/districts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const districts = await prisma.district.findMany({ orderBy: { name: 'asc' } });
    return sendSuccess(reply, districts);
  });

  fastify.get('/branches', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const offices = await prisma.office.findMany({ orderBy: { name: 'asc' } });
    return sendSuccess(reply, offices);
  });

  fastify.get('/reference/nature-crime', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { classOfIncident: { not: '' } },
      select: { classOfIncident: true },
      distinct: ['classOfIncident'],
    });
    return sendSuccess(reply, complaints.map(c => c.classOfIncident).filter(Boolean));
  });

  fastify.get('/reference/reception-mode', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { receptionMode: { not: '' } },
      select: { receptionMode: true },
      distinct: ['receptionMode'],
    });
    return sendSuccess(reply, complaints.map(c => c.receptionMode).filter(Boolean));
  });

  fastify.get('/reference/complaint-type', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { typeOfComplaint: { not: '' } },
      select: { typeOfComplaint: true },
      distinct: ['typeOfComplaint'],
    });
    return sendSuccess(reply, complaints.map(c => c.typeOfComplaint).filter(Boolean));
  });

  fastify.get('/reference/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { statusOfComplaint: { not: '' } },
      select: { statusOfComplaint: true },
      distinct: ['statusOfComplaint'],
    });
    return sendSuccess(reply, complaints.map(c => c.statusOfComplaint).filter(Boolean));
  });

  fastify.get('/reference/respondent-categories', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { respondentCategories: { not: '' } },
      select: { respondentCategories: true },
      distinct: ['respondentCategories'],
    });
    return sendSuccess(reply, complaints.map(c => c.respondentCategories).filter(Boolean));
  });

  fastify.post('/districts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { name, code } = request.body as Record<string, string>;
    const district = await prisma.district.create({ data: { name, code } });
    return sendSuccess(reply, district, 'District created');
  });

  fastify.post('/branches', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const body = request.body as Record<string, any>;
    const name = String(body.name || '');
    const code = body.code ? String(body.code) : null;
    const districtId = body.districtId ? Number(body.districtId) : undefined;
    
    const office = await prisma.office.create({
      data: { name, code, districtId },
    });
    return sendSuccess(reply, office, 'Office created');
  });
};