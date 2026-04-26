import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

// Use startsWith, NOT contains — generates LIKE 'Pending%' (index-safe) instead of LIKE '%Pending%' (full scan)
const PENDING_WHERE = [
  { statusOfComplaint: null },
  { statusOfComplaint: { equals: '' } },
  { statusOfComplaint: { startsWith: 'Pending' } },
];

export const pendingRoutes = async (fastify: FastifyInstance) => {
  // Hard limit for UI performance, prevents fetching tens of thousands of rows at once
  const MAX_ROWS = 500;

  fastify.get('/pending/all', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({
      where: { OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/15-30-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: fifteenDaysAgo, gt: thirtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/30-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: thirtyDaysAgo, gt: sixtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/over-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: sixtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { branch } = request.params as { branch: string };

    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/15-30-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        addressDistrict: branch,
        complRegDt: { lte: fifteenDaysAgo, gt: thirtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/30-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        addressDistrict: branch,
        complRegDt: { lte: thirtyDaysAgo, gt: sixtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branch/:branch/over-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { branch } = request.params as { branch: string };
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        addressDistrict: branch,
        complRegDt: { lte: sixtyDaysAgo },
        OR: PENDING_WHERE,
      },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branches', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Return only the 22 official Haryana districts — filtered from DB
    const HARYANA_DISTRICTS = [
      'AMBALA', 'BHIWANI', 'CHARKHI DADRI', 'FARIDABAD', 'FATEHABAD',
      'GURUGRAM', 'HISAR', 'JHAJJAR', 'JIND', 'KAITHAL', 'KARNAL',
      'KURUKSHETRA', 'MAHENDERGARH', 'NUH', 'PALWAL', 'PANCHKULA',
      'PANIPAT', 'REWARI', 'ROHTAK', 'SIRSA', 'SONIPAT', 'YAMUNANAGAR',
    ];

    // Get distinct districts in the DB that are in the Haryana list
    const rows = await prisma.complaint.findMany({
      where: {
        addressDistrict: { in: HARYANA_DISTRICTS },
        OR: PENDING_WHERE,
      },
      select: { addressDistrict: true },
      distinct: ['addressDistrict'],
      orderBy: { addressDistrict: 'asc' },
    });

    // Return all 22 official districts (regardless of whether they have pending data)
    // so the dropdown is always complete
    const inDb = new Set(rows.map(r => r.addressDistrict));
    const branches = HARYANA_DISTRICTS.filter(d => inDb.has(d));
    return sendSuccess(reply, branches);
  });
};