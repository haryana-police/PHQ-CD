import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { buildPrismaWhereClause } from '../utils/filters.js';

export const dashboardRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);

    const totalReceived = await prisma.complaint.count({ where: baseWhere });
    
    const totalDisposed = await prisma.complaint.count({
      where: {
        ...baseWhere,
        statusOfComplaint: { contains: 'Disposed' },
      },
    });
    
    const PENDING_WHERE = [
      { statusOfComplaint: null },
      { statusOfComplaint: { equals: '' } },
      { statusOfComplaint: { contains: 'Pending' } },
    ];

    const totalPending = await prisma.complaint.count({
      where: {
        ...baseWhere,
        OR: PENDING_WHERE,
      },
    });

    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const oneMonthAgo    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo   = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 15–30 days pending: registered between 15 and 30 days ago
    const pending15 = await prisma.complaint.count({
      where: {
        ...baseWhere,
        complRegDt: { ...baseWhere.complRegDt, lte: fifteenDaysAgo, gt: oneMonthAgo },
        OR: PENDING_WHERE,
      },
    });

    // 1–2 months pending: registered between 30 and 60 days ago
    const pendingOver1 = await prisma.complaint.count({
      where: {
        ...baseWhere,
        complRegDt: { ...baseWhere.complRegDt, lte: oneMonthAgo, gt: twoMonthsAgo },
        OR: PENDING_WHERE,
      },
    });

    // Over 2 months pending: registered more than 60 days ago
    const pendingOver2 = await prisma.complaint.count({
      where: {
        ...baseWhere,
        complRegDt: { ...baseWhere.complRegDt, lte: twoMonthsAgo },
        OR: PENDING_WHERE,
      },
    });

    const disposedComplaints = await prisma.complaint.findMany({
      where: {
        ...baseWhere,
        statusOfComplaint: { contains: 'Disposed' },
        complRegDt: { not: null },
        disposalDate: { not: null }
      },
      select: { complRegDt: true, disposalDate: true }
    });

    let totalDisposalDays = 0;
    disposedComplaints.forEach(c => {
      if (c.complRegDt && c.disposalDate) {
        totalDisposalDays += (c.disposalDate.getTime() - c.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
      }
    });
    const avgDisposalTime = disposedComplaints.length > 0 ? Math.round(totalDisposalDays / disposedComplaints.length) : 0;

    return sendSuccess(reply, {
      totalReceived,
      totalDisposed,
      totalPending,
      pendingOverFifteenDays: pending15,
      pendingOverOneMonth: pendingOver1,
      pendingOverTwoMonths: pendingOver2,
      avgDisposalTime,
    });
  });

  fastify.get('/dashboard/district-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);
    const complaints = await prisma.complaint.findMany({ where: baseWhere });

    const districtMap = new Map();

    for (const comp of complaints) {
      const districtName = comp.addressDistrict || 'Unknown';
      const status = (comp.statusOfComplaint || '').toLowerCase();
      
      if (!districtMap.has(districtName)) {
        districtMap.set(districtName, { total: 0, pending: 0, disposed: 0 });
      }
      
      const stats = districtMap.get(districtName);
      stats.total++;
      
      if (status.includes('disposed')) {
        stats.disposed++;
      } else if (status === '' || status.includes('pending')) {
        stats.pending++;
      }
    }

    const data = Array.from(districtMap.entries()).map(([district, stats]) => ({
      district,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/dashboard/duration-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);
    const complaints = await prisma.complaint.findMany({ where: baseWhere });

    const durationMap = new Map();

    for (const comp of complaints) {
      if (!comp.complRegDt) continue;

      const date = new Date(comp.complRegDt);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      
      if (!durationMap.has(monthYear)) {
        durationMap.set(monthYear, { total: 0, pending: 0, disposed: 0, sortKey: date.getTime() });
      }

      const stats = durationMap.get(monthYear);
      stats.total++;

      const status = (comp.statusOfComplaint || '').toLowerCase();
      if (status.includes('disposed')) stats.disposed++;
      else if (status === '' || status.includes('pending')) stats.pending++;
    }

    const data = Array.from(durationMap.entries())
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([duration, stats]) => ({
        duration,
        total: stats.total,
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

  fastify.get('/dashboard/ageing-matrix', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);
    const complaints = await prisma.complaint.findMany({
      where: {
        ...baseWhere,
        OR: [
          { statusOfComplaint: null },
          { statusOfComplaint: { equals: '' } },
          { statusOfComplaint: { contains: 'Pending' } },
        ],
        complRegDt: { not: null }
      },
      select: { addressDistrict: true, complRegDt: true }
    });

    const now = new Date().getTime();
    const matrixMap = new Map<string, { u7: number; u15: number; u30: number; o30: number }>();

    for (const comp of complaints) {
      const dist = comp.addressDistrict || 'Unknown';
      if (!matrixMap.has(dist)) {
        matrixMap.set(dist, { u7: 0, u15: 0, u30: 0, o30: 0 });
      }
      const stats = matrixMap.get(dist)!;
      const daysPending = (now - comp.complRegDt!.getTime()) / (1000 * 60 * 60 * 24);

      if (daysPending < 7) stats.u7++;
      else if (daysPending < 15) stats.u15++;
      else if (daysPending < 30) stats.u30++;
      else stats.o30++;
    }

    const data = Array.from(matrixMap.entries()).map(([district, stats]) => ({
      district,
      ...stats
    }));

    return sendSuccess(reply, data);
  });

  fastify.get('/dashboard/disposal-matrix', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);
    const complaints = await prisma.complaint.findMany({
      where: {
        ...baseWhere,
        statusOfComplaint: { contains: 'Disposed' },
        complRegDt: { not: null },
        disposalDate: { not: null },
      },
      select: { addressDistrict: true, complRegDt: true, disposalDate: true }
    });

    const matrixMap = new Map<string, { u7: number; u15: number; u30: number; o30: number }>();

    for (const comp of complaints) {
      const dist = comp.addressDistrict || 'Unknown';
      if (!matrixMap.has(dist)) {
        matrixMap.set(dist, { u7: 0, u15: 0, u30: 0, o30: 0 });
      }
      const stats = matrixMap.get(dist)!;
      const disposalDays = (comp.disposalDate!.getTime() - comp.complRegDt!.getTime()) / (1000 * 60 * 60 * 24);

      if (disposalDays < 7) stats.u7++;
      else if (disposalDays < 15) stats.u15++;
      else if (disposalDays < 30) stats.u30++;
      else stats.o30++;
    }

    const data = Array.from(matrixMap.entries()).map(([district, stats]) => ({
      district,
      ...stats
    }));

    return sendSuccess(reply, data);
  });

  fastify.get<{ Params: { district: string } }>('/dashboard/district-analysis/:district', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { district } = request.params;
    const baseWhere = buildPrismaWhereClause(request.query);

    const complaints = await prisma.complaint.findMany({
      where: {
        ...baseWhere,
        addressDistrict: district
      },
      select: { addressPs: true, statusOfComplaint: true, complRegDt: true, disposalDate: true, typeOfComplaint: true }
    });

    const now = new Date().getTime();
    const psMap = new Map<string, { total: number; pending: number; disposed: number; u7: number; u15: number; u30: number; o30: number; du7: number; du15: number; du30: number; do30: number; avgDisposalDays: number; totalDisposalDays: number }>();
    const categoryMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      // PS logic
      const ps = comp.addressPs || 'Unknown PS';
      if (!psMap.has(ps)) {
        psMap.set(ps, { total: 0, pending: 0, disposed: 0, u7: 0, u15: 0, u30: 0, o30: 0, du7: 0, du15: 0, du30: 0, do30: 0, avgDisposalDays: 0, totalDisposalDays: 0 });
      }
      const stats = psMap.get(ps)!;
      stats.total++;
      
      // Category logic
      const cat = comp.typeOfComplaint || 'Uncategorized';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, pending: 0, disposed: 0 });
      }
      const catStats = categoryMap.get(cat)!;
      catStats.total++;
      
      const status = (comp.statusOfComplaint || '').toLowerCase();
      const isDisposed = status.includes('disposed');
      const isPending = status === '' || status.includes('pending');

      if (isDisposed) {
        stats.disposed++;
        catStats.disposed++;
        if (comp.complRegDt && comp.disposalDate) {
          const disposalDays = (comp.disposalDate.getTime() - comp.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
          stats.totalDisposalDays += disposalDays;
          // Disposal time buckets
          if (disposalDays < 7) stats.du7++;
          else if (disposalDays < 15) stats.du15++;
          else if (disposalDays < 30) stats.du30++;
          else stats.do30++;
        }
      } else if (isPending) {
        stats.pending++;
        catStats.pending++;
        if (comp.complRegDt) {
          const daysPending = (now - comp.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysPending < 7) stats.u7++;
          else if (daysPending < 15) stats.u15++;
          else if (daysPending < 30) stats.u30++;
          else stats.o30++;
        }
      }
    }

    const data = Array.from(psMap.entries()).map(([ps, stats]) => ({
      ps,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
      u7: stats.u7,
      u15: stats.u15,
      u30: stats.u30,
      o30: stats.o30,
      du7: stats.du7,
      du15: stats.du15,
      du30: stats.du30,
      do30: stats.do30,
      avgDisposalDays: stats.disposed > 0 ? Math.round(stats.totalDisposalDays / stats.disposed) : 0
    }));

    const categories = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, {
      district,
      policeStations: data,
      categories: categories.sort((a, b) => b.total - a.total)
    });
  });

  fastify.get('/dashboard/category-wise', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const baseWhere = buildPrismaWhereClause(request.query);
    const complaints = await prisma.complaint.findMany({
      where: baseWhere,
      select: { typeOfComplaint: true, statusOfComplaint: true }
    });

    const categoryMap = new Map<string, { total: number; pending: number; disposed: number }>();

    for (const comp of complaints) {
      const cat = comp.typeOfComplaint || 'Uncategorized';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, pending: 0, disposed: 0 });
      }
      
      const stats = categoryMap.get(cat)!;
      stats.total++;
      
      const status = (comp.statusOfComplaint || '').toLowerCase();
      if (status.includes('disposed')) stats.disposed++;
      else if (status === '' || status.includes('pending')) stats.pending++;
    }

    const data = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      pending: stats.pending,
      disposed: stats.disposed,
    }));

    return sendSuccess(reply, data.sort((a, b) => b.total - a.total));
  });
};