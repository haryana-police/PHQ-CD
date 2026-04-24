import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const reportRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/reports/district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      include: { district: true }
    });

    const districtMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const districtName = comp.district?.name || (comp as any).addressDistrict || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = districtMap.get(districtName) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      districtMap.set(districtName, existing);
    }

    const data = Array.from(districtMap.entries()).map(([district, stats]) => ({
      district,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/reports/mode-receipt', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { receptionMode: { not: '' } },
    });

    const modeMap = new Map<string, number>();
    for (const comp of complaints) {
      const mode = comp.receptionMode || 'Unknown';
      modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
    }

    const data = Array.from(modeMap.entries()).map(([mode, count]) => ({ mode, count }));
    return sendSuccess(reply, data);
  });

  fastify.get('/reports/nature-incident', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { classOfIncident: { not: '' } },
    });

    const natureMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const nature = comp.classOfIncident || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = natureMap.get(nature) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      natureMap.set(nature, existing);
    }

    const data = Array.from(natureMap.entries()).map(([natureOfIncident, stats]) => ({
      natureOfIncident,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/reports/type-against', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { respondentCategories: { not: '' } },
    });

    const typeMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const category = comp.respondentCategories || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = typeMap.get(category) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      typeMap.set(category, existing);
    }

    const data = Array.from(typeMap.entries()).map(([typeAgainst, stats]) => ({
      typeAgainst,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/reports/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { statusOfComplaint: { not: '' } },
    });

    const statusMap = new Map<string, number>();
    for (const comp of complaints) {
      const status = comp.statusOfComplaint || 'Unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    }

    const data = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
    return sendSuccess(reply, data);
  });

  fastify.get('/reports/branch-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { branch: { not: '' } },
    });

    const branchMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const branch = comp.branch || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = branchMap.get(branch) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      branchMap.set(branch, existing);
    }

    const data = Array.from(branchMap.entries()).map(([branch, stats]) => ({
      branch,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/reports/highlights', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { classOfIncident: { not: '' } },
    });

    const categoryMap = new Map<string, number>();
    for (const comp of complaints) {
      const category = comp.classOfIncident || 'Unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    const sortedCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const data = sortedCategories.map(([category, count]) => ({ category, count }));
    return sendSuccess(reply, data);
  });

  fastify.get('/reports/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { fromDate, toDate } = request.query as { fromDate?: string; toDate?: string };

    const where: any = {};
    if (fromDate && toDate) {
      where.complRegDt = {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      };
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: { district: true },
    });

    const districtMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const districtName = comp.district?.name || (comp as any).addressDistrict || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = districtMap.get(districtName) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      districtMap.set(districtName, existing);
    }

    const data = Array.from(districtMap.entries()).map(([district, stats]) => ({
      district,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/reports/action-taken', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { actionTaken: { not: '' } },
    });

    const actionMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const action = comp.actionTaken || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = actionMap.get(action) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      actionMap.set(action, existing);
    }

    const data = Array.from(actionMap.entries()).map(([actionTaken, stats]) => ({
      actionTaken,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });
};