import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import * as XLSX from 'xlsx';

export const importExportRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/import/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = request.body as any[];
      if (!Array.isArray(data) || data.length === 0) {
        return sendError(reply, 'Invalid data format');
      }

      let imported = 0;
      for (const row of data) {
        try {
          await prisma.complaint.create({
            data: {
              complRegNum: row.COMPL_REG_NUM,
              complDesc: row.COMPL_DESC,
              complSrno: row.COMPL_SRNO,
              complRegDt: row.COMPL_REG_DT ? new Date(row.COMPL_REG_DT) : undefined,
              firstName: row.FIRST_NAME,
              lastName: row.LAST_NAME,
              mobile: row.MOBILE,
              gender: row.GENDER,
              age: row.AGE,
              addressLine1: row.ADDRESS_LINE_1,
              addressLine2: row.ADDRESS_LINE_2,
              addressLine3: row.ADDRESS_LINE_3,
              village: row.VILLAGE,
              tehsil: row.TEHSIL,
              addressDistrict: row.Address_DISTRICT,
              addressPs: row.Address_PS,
              receptionMode: row.RECEPTION_MODE,
              incidentType: row.INCIDENT_TYPE,
              incidentPlc: row.INCIDENT_PLC,
              incidentFromDt: row.INCIDENT_FROM_DT ? new Date(row.INCIDENT_FROM_DT) : undefined,
              incidentToDt: row.INCIDENT_TO_DT ? new Date(row.INCIDENT_TO_DT) : undefined,
              classOfIncident: row.CLASS_OF_INCIDENT,
              respondentCategories: row.RESPONDENT_CATEGORIES,
              complaintSource: row.COMPLAINT_SOURCE,
              typeOfComplaint: row.TYPE_OF_COMPLAINT,
              complainantType: row.COMPLAINANT_TYPE,
              complaintPurpose: row.COMPLAINT_PURPOSE,
              statusOfComplaint: row.STATUS_OF_COMPLAINT,
              disposalDate: row.DISPOSAL_DATE ? new Date(row.DISPOSAL_DATE) : undefined,
              ioDetails: row.IO_DETAILS,
              branch: row.BRANCH,
            },
          });
          imported++;
        } catch (e) {
          console.error('Insert error:', e);
        }
      }

      return sendSuccess(reply, { imported, total: data.length });
    } catch (err: any) {
      return sendError(reply, err.message);
    }
  });

  fastify.get('/export/complaints', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const complaints = await prisma.complaint.findMany({ orderBy: { complRegDt: 'desc' } });

    const worksheet = XLSX.utils.json_to_sheet(complaints);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Complaints');
    
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=complaints.xlsx');
    
    return reply.send(Buffer.from(excelBuffer));
  });

  fastify.post('/import/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = request.body as any[];
    if (!Array.isArray(data) || data.length === 0) {
      return sendError(reply, 'Invalid data');
    }

    let imported = 0;
    for (const row of data) {
      try {
        await prisma.womenSafety.create({ data: row });
        imported++;
      } catch (e) {}
    }

    return sendSuccess(reply, { imported });
  });

  fastify.get('/export/women-safety', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const records = await prisma.womenSafety.findMany({ orderBy: { complRegDt: 'desc' } });

    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WomenSafety');
    
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=women_safety.xlsx');
    
    return reply.send(Buffer.from(excelBuffer));
  });
};