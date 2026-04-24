import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const totalReceived = await prisma.complaint.count();
    
    const totalDisposed = await prisma.complaint.count({
      where: {
        statusOfComplaint: { not: '', contains: 'Disposed' },
      },
    });
    
    const totalPending = await prisma.complaint.count({
      where: {
        OR: [
          { statusOfComplaint: null },
          { statusOfComplaint: { equals: '' } },
        ],
      },
    });

    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const pending15 = await prisma.complaint.count({
      where: {
        complRegDt: { lte: fifteenDaysAgo },
        OR: [
          { statusOfComplaint: null },
          { statusOfComplaint: { equals: '' } },
        ],
      },
    });

    const pendingOver1 = await prisma.complaint.count({
      where: {
        complRegDt: { lte: oneMonthAgo, gt: fifteenDaysAgo },
        OR: [
          { statusOfComplaint: null },
          { statusOfComplaint: { equals: '' } },
        ],
      },
    });

    const pendingOver2 = await prisma.complaint.count({
      where: {
        complRegDt: { lte: twoMonthsAgo },
        OR: [
          { statusOfComplaint: null },
          { statusOfComplaint: { equals: '' } },
        ],
      },
    });

    return sendSuccess(reply, {
      totalReceived,
      totalDisposed,
      totalPending,
      pendingOverFifteenDays: pending15,
      pendingOverOneMonth: pendingOver1,
      pendingOverTwoMonths: pendingOver2,
    });
  });

  fastify.get('/dashboard/district-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany();

    const districtMap = new Map();

    for (const comp of complaints) {
      const districtName = comp.addressDistrict || 'Unknown';
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
      totalComplaints: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/dashboard/duration-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { year } = request.query as Record<string, string>;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(yearNum + '-01-01');
    const endDate = new Date(yearNum + '-12-31');

    const complaints = await prisma.complaint.findMany({
      where: { complRegDt: { gte: startDate, lte: endDate } },
    });

    const monthMap = new Map();

    for (const comp of complaints) {
      const month = comp.complRegDt 
        ? comp.complRegDt.toLocaleString('default', { month: 'short' })
        : 'Unknown';
      
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');
      const isDisposed = status.includes('disposed');

      const existing = monthMap.get(month) || { total: 0, pending: 0, disposed: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      if (isDisposed) existing.disposed++;
      monthMap.set(month, existing);
    }

    const data = Array.from(monthMap.entries()).map(([month, stats]) => ({
      month,
      year: yearNum,
      totalComplaints: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/dashboard/date-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { fromDate, toDate } = request.query as Record<string, string>;

    if (!fromDate || !toDate) {
      return sendError(reply, 'fromDate and toDate are required');
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    });

    const districtMap = new Map();

    for (const comp of complaints) {
      const districtName = comp.addressDistrict || 'Unknown';
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
      totalComplaints: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/dashboard/month-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      orderBy: { complRegDt: 'asc' },
    });

    const monthMap = new Map();

    for (const comp of complaints) {
      if (!comp.complRegDt) continue;
      
      const monthKey = comp.complRegDt.getFullYear() + '-' + String(comp.complRegDt.getMonth() + 1).padStart(2, '0');
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isPending = status === '' || status.includes('pending');

      const existing = monthMap.get(monthKey) || { total: 0, pending: 0 };
      existing.total++;
      if (isPending) existing.pending++;
      monthMap.set(monthKey, existing);
    }

    const data = Array.from(monthMap.entries()).map(([month, stats]) => ({
      month,
      year: parseInt(month.split('-')[0]),
      monthNum: parseInt(month.split('-')[1]),
      total: stats.total,
      pending: stats.pending,
    }));

    return sendSuccess(reply, data);
  });
};