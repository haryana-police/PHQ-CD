import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';

const PENDING_WHERE = [
  { statusOfComplaint: null },
  { statusOfComplaint: { equals: '' } },
  { statusOfComplaint: { startsWith: 'Pending' } },
];

const MAX_ROWS = 1000;

// Build filter where clause from query params
function buildFilterWhere(query: Record<string, string>) {
  const { district, source, complaintType, fromDate, toDate } = query;
  const extra: any = {};

  if (district) {
    const districts = district.split(',').map(d => d.trim()).filter(Boolean);
    if (districts.length === 1) extra.addressDistrict = { contains: districts[0] };
    else if (districts.length > 1) extra.addressDistrict = { in: districts };
  }

  if (source) {
    const sources = source.split(',').map(s => s.trim()).filter(Boolean);
    if (sources.length === 1) extra.complaintSource = sources[0];
    else if (sources.length > 1) extra.complaintSource = { in: sources };
  }

  if (complaintType) {
    const types = complaintType.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length === 1) extra.typeOfComplaint = types[0];
    else if (types.length > 1) extra.typeOfComplaint = { in: types };
  }

  if (fromDate || toDate) {
    extra.complRegDt = {};
    if (fromDate) extra.complRegDt.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      extra.complRegDt.lte = end;
    }
  }

  return extra;
}

export const pendingRoutes = async (fastify: FastifyInstance) => {

  // Filter options for pending complaints (distinct values)
  fastify.get('/pending/filter-options', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const [districtRows, sourceRows, typeRows] = await prisma.$transaction([
      prisma.complaint.findMany({
        select: { addressDistrict: true },
        distinct: ['addressDistrict'],
        where: { addressDistrict: { not: null }, OR: PENDING_WHERE },
        orderBy: { addressDistrict: 'asc' },
      }),
      prisma.complaint.findMany({
        select: { complaintSource: true },
        distinct: ['complaintSource'],
        where: { complaintSource: { not: null }, OR: PENDING_WHERE },
        orderBy: { complaintSource: 'asc' },
      }),
      prisma.complaint.findMany({
        select: { typeOfComplaint: true },
        distinct: ['typeOfComplaint'],
        where: { typeOfComplaint: { not: null }, OR: PENDING_WHERE },
        orderBy: { typeOfComplaint: 'asc' },
      }),
    ]);
    return sendSuccess(reply, {
      districts: districtRows.map(r => r.addressDistrict).filter(Boolean),
      sources: sourceRows.map(r => r.complaintSource).filter(Boolean),
      types: typeRows.map(r => r.typeOfComplaint).filter(Boolean),
    });
  });

  fastify.get('/pending/all', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const extra = buildFilterWhere(query);
    const complaints = await prisma.complaint.findMany({
      where: { OR: PENDING_WHERE, ...extra },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/15-30-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const extra = buildFilterWhere(query);
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: fifteenDaysAgo, gt: thirtyDaysAgo },
        OR: PENDING_WHERE,
        ...extra,
      },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/30-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const extra = buildFilterWhere(query);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: thirtyDaysAgo, gt: sixtyDaysAgo },
        OR: PENDING_WHERE,
        ...extra,
      },
      orderBy: { complRegDt: 'asc' },
      take: MAX_ROWS,
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/over-60-days', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const extra = buildFilterWhere(query);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const complaints = await prisma.complaint.findMany({
      where: {
        complRegDt: { lte: sixtyDaysAgo },
        OR: PENDING_WHERE,
        ...extra,
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
    const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, complRegDt: { lte: fifteenDaysAgo, gt: thirtyDaysAgo }, OR: PENDING_WHERE },
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
    const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const complaints = await prisma.complaint.findMany({
      where: { addressDistrict: branch, complRegDt: { lte: thirtyDaysAgo, gt: sixtyDaysAgo }, OR: PENDING_WHERE },
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
      where: { addressDistrict: branch, complRegDt: { lte: sixtyDaysAgo }, OR: PENDING_WHERE },
      orderBy: { complRegDt: 'asc' },
    });
    return sendSuccess(reply, complaints);
  });

  fastify.get('/pending/branches', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    const HARYANA_DISTRICTS = [
      'AMBALA', 'BHIWANI', 'CHARKHI DADRI', 'FARIDABAD', 'FATEHABAD',
      'GURUGRAM', 'HISAR', 'JHAJJAR', 'JIND', 'KAITHAL', 'KARNAL',
      'KURUKSHETRA', 'MAHENDERGARH', 'NUH', 'PALWAL', 'PANCHKULA',
      'PANIPAT', 'REWARI', 'ROHTAK', 'SIRSA', 'SONIPAT', 'YAMUNANAGAR',
    ];
    const rows = await prisma.complaint.findMany({
      where: { addressDistrict: { in: HARYANA_DISTRICTS }, OR: PENDING_WHERE },
      select: { addressDistrict: true },
      distinct: ['addressDistrict'],
      orderBy: { addressDistrict: 'asc' },
    });
    const inDb = new Set(rows.map(r => r.addressDistrict));
    const branches = HARYANA_DISTRICTS.filter(d => inDb.has(d));
    return sendSuccess(reply, branches);
  });
};