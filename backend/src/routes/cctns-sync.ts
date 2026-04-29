/**
 * CCTNS Sync Routes
 * Mirrors exactly the logic from old project: ComplaintDataFetch.aspx.cs
 *
 * The old project's InsertComplaintData stored procedure logic:
 * - IF complaint already EXISTS: UPDATE Status_of_Complaint, Disposal_Date, IO_Details
 * - ELSE: INSERT full record into Complaints table
 *
 * We replicate this with Prisma upsert into the Complaint model.
 */
import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { getCctnsToken, fetchCctnsComplaints, fetchCctnsEnquiries, clearCctnsToken, parseCctnsDate } from '../services/cctns.js';

// Raw row shape from the CCTNS ComplaintData API — fields match exactly what API returns
interface CctnsRow {
  COMPL_REG_NUM?: string;
  DISTRICT?: string;
  COMPL_DESC?: string;
  COMPL_SRNO?: string;
  COMPL_REG_DT?: string;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  MOBILE?: string;
  GENDER?: string;
  AGE?: string;
  ADDRESS_LINE_1?: string;
  ADDRESS_LINE_2?: string;
  ADDRESS_LINE_3?: string;
  Village?: string;
  TEHSIL?: string;
  Address_DISTRICT?: string;
  Address_PS?: string;
  RECEPTION_MODE?: string;
  INCIDENT_TYPE?: string;
  INCIDENT_PLC?: string;
  INCIDENT_FROM_DT?: string;
  INCIDENT_TO_DT?: string;
  EMAIL?: string;
  SUBMIT_PS_CD?: string;
  SUBMIT_OFFICE_CD?: string;
  TRANSFER_DISTRICT_CD?: string;
  TRANSFER_PS_CD?: string;
  TRANSFER_OFFICE_CD?: string;
  Class_of_Incident?: string;
  Respondent_Categories?: string;
  Complaint_Source?: string;
  Type_of_Complaint?: string;
  COMPLAINANT_TYPE?: string;
  COMPLAINT_PURPOSE?: string;
  Status_of_Complaint?: string;
  Disposal_Date?: string;
  IO_Details?: string;
  [key: string]: unknown;
}

function str(val: unknown): string | null {
  const s = String(val ?? '').trim();
  return s === '' ? null : s;
}

function mapRowToComplaint(row: CctnsRow) {
  const complRegNum = str(row.COMPL_REG_NUM);

  // Derive the police-district ID from the 5-digit prefix of complRegNum.
  // The Haryana Police API encodes District_Master.id as the first 5 digits.
  // e.g. "1322713227..." → prefix 5 = 13227 = GURUGRAM
  let resolvedDistrictId: bigint | null = null;
  if (complRegNum && complRegNum.length >= 5 && /^[0-9]/.test(complRegNum)) {
    try { resolvedDistrictId = BigInt(complRegNum.substring(0, 5)); } catch {}
  }

  return {
    complRegNum,
    resolvedDistrictId,
    complDesc: str(row.COMPL_DESC),
    complSrno: str(row.COMPL_SRNO),
    complRegDt: parseCctnsDate(row.COMPL_REG_DT),
    firstName: str(row.FIRST_NAME),
    lastName: str(row.LAST_NAME),
    mobile: str(row.MOBILE),
    gender: str(row.GENDER),
    age: row.AGE && row.AGE.trim() !== '' ? parseInt(row.AGE) || null : null,
    addressLine1: str(row.ADDRESS_LINE_1),
    addressLine2: str(row.ADDRESS_LINE_2),
    addressLine3: str(row.ADDRESS_LINE_3),
    village: str(row.Village),
    tehsil: str(row.TEHSIL),
    addressDistrict: str(row.Address_DISTRICT),
    addressPs: str(row.Address_PS),
    receptionMode: str(row.RECEPTION_MODE),
    incidentType: str(row.INCIDENT_TYPE),
    incidentPlc: str(row.INCIDENT_PLC),
    incidentFromDt: parseCctnsDate(row.INCIDENT_FROM_DT),
    incidentToDt: parseCctnsDate(row.INCIDENT_TO_DT),
    classOfIncident: str(row.Class_of_Incident),
    respondentCategories: str(row.Respondent_Categories),
    complaintSource: str(row.Complaint_Source),
    typeOfComplaint: str(row.Type_of_Complaint),
    complainantType: str(row.COMPLAINANT_TYPE),
    complaintPurpose: str(row.COMPLAINT_PURPOSE),
    statusOfComplaint: str(row.Status_of_Complaint),
    disposalDate: parseCctnsDate(row.Disposal_Date),
    ioDetails: str(row.IO_Details),
  };
}

export const cctnsSyncRoutes = async (fastify: FastifyInstance) => {

  // Status check — shows configuration for BOTH complaint endpoints
  fastify.get('/cctns/status', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    try {
      const secretKey = process.env.CCTNS_SECRET_KEY || 'UserHryDashboard';
      const tokenApi = process.env.CCTNS_TOKEN_API || 'http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken';
      const complaintApi = process.env.CCTNS_COMPLAINT_API || 'http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData';
      const enquiryApi = process.env.CCTNS_ENQUIRY_API || 'http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData';

      return sendSuccess(reply, {
        configured: true,
        secretKey: secretKey.substring(0, 4) + '****',
        tokenApi,
        endpointA: { name: 'PHQ ComplaintData', url: complaintApi },
        endpointB: { name: 'CM ComplaintEnquiryData', url: enquiryApi },
      });
    } catch (error) {
      return sendError(reply, 'Failed to get CCTNS status');
    }
  });

  // Force-refresh the cached token
  fastify.post('/cctns/token', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    try {
      clearCctnsToken();
      const token = await getCctnsToken();
      return sendSuccess(reply, { token: token.substring(0, 20) + '...' }, 'Token obtained');
    } catch (error) {
      return sendError(reply, `Failed to get token: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  });

  /**
   * Main sync endpoint — mirrors btnFetch_Click in ComplaintDataFetch.aspx.cs
   * Body: { timeFrom: "dd/MM/yyyy", timeTo: "dd/MM/yyyy" }
   *
   * Logic:
   * - Fetches complaints from CCTNS API for the given date range
   * - For each row: upserts into Complaint table
   *   - If exists: update Status_of_Complaint, Disposal_Date, IO_Details
   *   - If not exists: insert full record
   * - Returns counts: fetched, created, updated, skipped
   */
  fastify.post('/cctns/sync', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { timeFrom, timeTo } = request.body as Record<string, string>;

      if (!timeFrom || !timeTo) {
        return sendError(reply, 'timeFrom and timeTo are required (format: dd/MM/yyyy)');
      }

      let totalFetched = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      await fetchCctnsComplaints(timeFrom, timeTo, async (rows) => {
        totalFetched += rows.length;
        const validRows = rows.filter(r => str(r.COMPL_REG_NUM));
        const mappedRows = validRows.map(row => mapRowToComplaint(row));
        
        skipped += rows.length - validRows.length;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
          const chunk = mappedRows.slice(i, i + CHUNK_SIZE);
          const complRegNums = chunk.map(r => r.complRegNum as string);

          const existingRecords = await prisma.complaint.findMany({
            where: { complRegNum: { in: complRegNums } },
            select: { id: true, complRegNum: true },
          });

          const existingMap = new Map(existingRecords.map(r => [r.complRegNum, r.id]));
          
          const toCreate: any[] = [];
          const toUpdate: any[] = [];

          for (const mapped of chunk) {
            if (mapped.complRegNum && existingMap.has(mapped.complRegNum)) {
              toUpdate.push({
                id: existingMap.get(mapped.complRegNum),
                data: {
                  statusOfComplaint: mapped.statusOfComplaint,
                  disposalDate: mapped.disposalDate,
                  ioDetails: mapped.ioDetails,
                }
              });
            } else {
              toCreate.push(mapped);
            }
          }

          if (toCreate.length > 0) {
            try {
              await prisma.complaint.createMany({
                data: toCreate,
                skipDuplicates: true,
              });
              created += toCreate.length;
            } catch (e) {
              console.error('Error in createMany chunk:', e);
              skipped += toCreate.length;
            }
          }

          if (toUpdate.length > 0) {
            try {
              await Promise.all(
                toUpdate.map(u => 
                  prisma.complaint.update({
                    where: { id: u.id },
                    data: u.data
                  })
                )
              );
              updated += toUpdate.length;
            } catch (e) {
              console.error('Error in Promise.all update chunk:', e);
            }
          }
        }
      });

      return sendSuccess(reply, {
        message: 'CCTNS sync completed (Optimized Streaming)',
        fetched: totalFetched,
        created,
        updated,
        skipped,
      });

    } catch (error) {
      console.error('[CCTNS] Sync error:', error);
      return sendError(reply, `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  /**
   * Sync Endpoint B — ComplaintEnquiryData (CM Dashboard enquiry complaints)
   * Same token, same date range format, same upsert logic into Complaint table.
   * Body: { timeFrom: "dd/MM/yyyy", timeTo: "dd/MM/yyyy" }
   */
  fastify.post('/cctns/sync-enquiry', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { timeFrom, timeTo } = request.body as Record<string, string>;

      if (!timeFrom || !timeTo) {
        return sendError(reply, 'timeFrom and timeTo are required (format: dd/MM/yyyy)');
      }

      let totalFetched = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;

      await fetchCctnsEnquiries(timeFrom, timeTo, async (rows) => {
        totalFetched += rows.length;
        const validRows = rows.filter(r => str(r.COMPL_REG_NUM));
        const mappedRows = validRows.map(row => mapRowToComplaint(row));
        
        skipped += rows.length - validRows.length;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
          const chunk = mappedRows.slice(i, i + CHUNK_SIZE);
          const complRegNums = chunk.map(r => r.complRegNum as string);

          const existingRecords = await prisma.complaint.findMany({
            where: { complRegNum: { in: complRegNums } },
            select: { id: true, complRegNum: true },
          });

          const existingMap = new Map(existingRecords.map(r => [r.complRegNum, r.id]));
          
          const toCreate: any[] = [];
          const toUpdate: any[] = [];

          for (const mapped of chunk) {
            if (mapped.complRegNum && existingMap.has(mapped.complRegNum)) {
              toUpdate.push({
                id: existingMap.get(mapped.complRegNum),
                data: {
                  statusOfComplaint: mapped.statusOfComplaint,
                  disposalDate: mapped.disposalDate,
                  ioDetails: mapped.ioDetails,
                }
              });
            } else {
              toCreate.push(mapped);
            }
          }

          if (toCreate.length > 0) {
            try {
              await prisma.complaint.createMany({
                data: toCreate,
                skipDuplicates: true,
              });
              created += toCreate.length;
            } catch (e) {
              console.error('Error in createMany chunk:', e);
              skipped += toCreate.length;
            }
          }

          if (toUpdate.length > 0) {
            try {
              await Promise.all(
                toUpdate.map(u => 
                  prisma.complaint.update({
                    where: { id: u.id },
                    data: u.data
                  })
                )
              );
              updated += toUpdate.length;
            } catch (e) {
              console.error('Error in Promise.all update chunk:', e);
            }
          }
        }
      });

      return sendSuccess(reply, {
        message: 'CCTNS enquiry sync completed (Optimized Streaming)',
        fetched: totalFetched,
        created,
        updated,
        skipped,
      });

    } catch (error) {
      console.error('[CCTNS Enquiry] Sync error:', error);
      return sendError(reply, `Enquiry sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

};