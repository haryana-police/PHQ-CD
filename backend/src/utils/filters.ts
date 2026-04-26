import { FastifyRequest } from 'fastify';

export interface DashboardFilters {
  source?: string;
  district_id?: number;
  from_date?: Date;
  to_date?: Date;
  complaint_type?: string;
}

export const buildPrismaWhereClause = (query: any) => {
  const where: any = {};

  if (query.district_id) {
    where.districtId = parseInt(query.district_id as string, 10);
  }

  const districtName = query.district_name || query.districtName;
  if (districtName) {
    const districts = (districtName as string).split(',').map(d => d.trim()).filter(Boolean);
    if (districts.length > 0) {
      where.addressDistrict = { in: districts };
    }
  }

  const complaintType = query.complaint_type || query.complaintType;
  if (complaintType) {
    const types = (complaintType as string).split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      where.typeOfComplaint = { in: types };
    }
  }

  const fromDate = query.from_date || query.fromDate;
  const toDate = query.to_date || query.toDate;
  if (fromDate || toDate) {
    where.complRegDt = {};
    if (fromDate) {
      where.complRegDt.gte = new Date(fromDate as string);
    }
    if (toDate) {
      where.complRegDt.lte = new Date(toDate as string);
    }
  }

  return where;
};
