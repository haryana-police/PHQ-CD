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
    where.addressDistrict = districtName;
  }

  const complaintType = query.complaint_type || query.complaintType;
  if (complaintType) {
    where.typeOfComplaint = complaintType;
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
