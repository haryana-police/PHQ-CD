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
import { getCctnsToken, fetchCctnsComplaints, clearCctnsToken, parseCctnsDate } from '../services/cctns.js';

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
  return {
    complRegNum: str(row.COMPL_REG_NUM),
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

  // Status check — confirms token API and complaint API env vars are configured
  fastify.get('/cctns/status', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    try {
      const secretKey = process.env.CCTNS_SECRET_KEY || 'UserHryDashboard';
      const tokenApi = process.env.CCTNS_TOKEN_API || 'http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken';
      const complaintApi = process.env.CCTNS_COMPLAINT_API || 'http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData';

      return sendSuccess(reply, {
        configured: true,
        secretKey: secretKey.substring(0, 4) + '****',
        tokenApi,
        complaintApi,
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

      const rows = await fetchCctnsComplaints(timeFrom, timeTo) as CctnsRow[];

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const complRegNum = str(row.COMPL_REG_NUM);

        if (!complRegNum) {
          skipped++;
          continue;
        }

        try {
          const mapped = mapRowToComplaint(row);

          // Mirror InsertComplaintData stored procedure:
          // IF EXISTS → UPDATE only status/disposal/IO fields
          // ELSE → INSERT full record
          const existing = await prisma.complaint.findUnique({
            where: { complRegNum },
            select: { id: true },
          });

          if (existing) {
            await prisma.complaint.update({
              where: { id: existing.id },
              data: {
                statusOfComplaint: mapped.statusOfComplaint,
                disposalDate: mapped.disposalDate,
                ioDetails: mapped.ioDetails,
              },
            });
            updated++;
          } else {
            await prisma.complaint.create({ data: mapped });
            created++;
          }
        } catch (e) {
          console.error('[CCTNS] Error upserting row:', row.COMPL_REG_NUM, e instanceof Error ? e.message : e);
          skipped++;
        }
      }

      return sendSuccess(reply, {
        message: 'CCTNS sync completed',
        fetched: rows.length,
        created,
        updated,
        skipped,
      });

    } catch (error) {
      console.error('[CCTNS] Sync error:', error);
      return sendError(reply, `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

};