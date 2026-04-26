import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { getCctnsToken, fetchCctnsComplaints, fetchCctnsEnquiries, clearCctnsToken } from '../services/cctns.js';

// Fields from CCTNS Complaint Data API (IP-whitelisted, encrypted)
interface CctnsComplaintRow {
  ComplRegNum?: string;
  ComplRegDt?: string;
  ComplMainCat?: string;
  ComplCategory?: string;
  PSRNmuber?: string;
  FIRNumber?: string;
  FIRDate?: string;
  ActSection?: string;
  AccusedName?: string;
  AccusedAge?: string;
  AccusedAddress?: string;
  VictimName?: string;
  IncidentDate?: string;
  [key: string]: unknown;
}

// Fields from CCTNS Enquiry Data API (live, plain JSON - confirmed 2026-04-25)
interface CctnsEnquiryRow {
  COMPL_REG_NUM?: string;
  office_incharge?: string;
  Investigation_start_date?: string;
  ENQ_REMARKS?: string;
  COMPLAINT_ACTION_TAKEN?: string;
  [key: string]: unknown;
}

export const cctnsSyncRoutes = async (fastify: FastifyInstance) => {

  // ─── Status ──────────────────────────────────────────────────────────
  fastify.get('/cctns/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const secretKey = process.env.CCTNS_SECRET_KEY;
      const decryptKey = process.env.CCTNS_DECRYPT_KEY;
      const complaintApi = process.env.CCTNS_COMPLAINT_API;
      const enquiryApi = process.env.CCTNS_ENQUIRY_API;

      const configured = !!(secretKey && secretKey !== 'your_secret_key_here' &&
                        decryptKey && decryptKey !== 'your_decrypt_key_here' &&
                        complaintApi && enquiryApi);

      return sendSuccess(reply, {
        configured,
        hasSecretKey: !!secretKey && secretKey !== 'your_secret_key_here',
        hasDecryptKey: !!decryptKey && decryptKey !== 'your_decrypt_key_here',
        hasApis: !!complaintApi && !!enquiryApi,
      });
    } catch (error) {
      return sendError(reply, 'Failed to get CCTNS status');
    }
  });

  // ─── Refresh Token ────────────────────────────────────────────────────
  fastify.post('/cctns/token', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      clearCctnsToken();
      const token = await getCctnsToken();
      return sendSuccess(reply, { token: token.substring(0, 20) + '...' }, 'Token obtained');
    } catch (error) {
      return sendError(reply, `Failed to get token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // ─── Live Enquiry Fetch (no DB save, direct proxy to Enquiry API) ─────
  fastify.get('/cctns/enquiries-live', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { timeFrom, timeTo } = request.query as Record<string, string>;

      if (!timeFrom || !timeTo) {
        return sendError(reply, 'timeFrom and timeTo query params are required (format: MM/DD/YYYY)');
      }

      const enquiries = await fetchCctnsEnquiries(timeFrom, timeTo);

      // Normalize field names for frontend consistency
      const normalized = (enquiries as CctnsEnquiryRow[]).map(row => ({
        complRegNum:           row.COMPL_REG_NUM || null,
        officeIncharge:        row.office_incharge?.trim() || null,
        investigationStartDate:row.Investigation_start_date || null,
        enquiryRemarks:        row.ENQ_REMARKS || null,
        actionTaken:           row.COMPLAINT_ACTION_TAKEN || null,
        // keep raw fields too for reference
        _raw: row,
      }));

      return sendSuccess(reply, {
        total: normalized.length,
        timeFrom,
        timeTo,
        records: normalized,
      });
    } catch (error) {
      console.error('CCTNS enquiries-live error:', error);
      return sendError(reply, `Failed to fetch enquiries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // ─── Sync Complaints (IP-whitelisted endpoint) ────────────────────────
  fastify.post('/cctns/sync', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { timeFrom, timeTo } = request.body as Record<string, string>;

      if (!timeFrom || !timeTo) {
        return sendError(reply, 'timeFrom and timeTo are required');
      }

      const complaints = await fetchCctnsComplaints(timeFrom, timeTo);

      let created = 0;
      let updated = 0;

      for (const row of complaints as CctnsComplaintRow[]) {
        const data: Record<string, unknown> = {
          complRegNum:   row.ComplRegNum || null,
          compCategory:  row.ComplCategory || row.ComplMainCat || null,
          psrNumber:     row.PSRNmuber || null,
          firNumber:     row.FIRNumber || null,
          firDate:       row.FIRDate ? new Date(row.FIRDate) : null,
          ActSection:    row.ActSection || null,
          accusedName:   row.AccusedName || null,
          accusedAge:    row.AccusedAge ? parseInt(String(row.AccusedAge)) : null,
          accusedAddress:row.AccusedAddress || null,
          victimName:    row.VictimName || null,
          incidentDate:  row.IncidentDate ? new Date(row.IncidentDate) : null,
        };

        try {
          const existing = await prisma.cCTNSComplaint.findUnique({
            where: { complRegNum: String(data.complRegNum || '') },
          });

          if (existing) {
            await prisma.cCTNSComplaint.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            await prisma.cCTNSComplaint.create({ data });
            created++;
          }
        } catch (e) {
          console.error('Error saving complaint:', e);
        }
      }

      return sendSuccess(reply, {
        message: 'Sync completed',
        fetched: complaints.length,
        created,
        updated,
      });
    } catch (error) {
      console.error('CCTNS sync error:', error);
      return sendError(reply, `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // ─── Sync Enquiries → Save to DB ─────────────────────────────────────
  fastify.post('/cctns/sync-enquiries', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { timeFrom, timeTo } = request.body as Record<string, string>;

      if (!timeFrom || !timeTo) {
        return sendError(reply, 'timeFrom and timeTo are required');
      }

      const enquiries = await fetchCctnsEnquiries(timeFrom, timeTo);

      let created = 0;
      let updated = 0;

      for (const row of enquiries as CctnsEnquiryRow[]) {
        // Enquiry API fields: COMPL_REG_NUM, office_incharge, Investigation_start_date,
        //                     ENQ_REMARKS, COMPLAINT_ACTION_TAKEN
        const complRegNum = row.COMPL_REG_NUM || null;
        if (!complRegNum) continue;

        const data: Record<string, unknown> = {
          complRegNum,
          compCategory:  row.COMPLAINT_ACTION_TAKEN || null,  // best fit in existing schema
          ActSection:    row.ENQ_REMARKS || null,             // remarks stored here
          accusedName:   row.office_incharge?.trim() || null, // incharge officer
          incidentDate:  row.Investigation_start_date
            ? new Date(row.Investigation_start_date)
            : null,
        };

        try {
          const existing = await prisma.cCTNSComplaint.findUnique({
            where: { complRegNum: String(complRegNum) },
          });

          if (existing) {
            await prisma.cCTNSComplaint.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            await prisma.cCTNSComplaint.create({ data });
            created++;
          }
        } catch (e) {
          console.error('Error saving enquiry:', e);
        }
      }

      return sendSuccess(reply, {
        message: 'Enquiry sync completed',
        fetched: enquiries.length,
        created,
        updated,
      });
    } catch (error) {
      console.error('CCTNS enquiry sync error:', error);
      return sendError(reply, `Enquiry sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // ─── Bulk Historical Sync (one calendar month at a time) ─────────────
  // POST /api/cctns/sync-month
  // Body: { "year": 2025, "month": 10 }  (month is 1-indexed)
  // Fetches complaints + enquiries for that whole month and upserts into DB.
  // Call this 6 times (month by month) to backfill last 6 months.
  fastify.post('/cctns/sync-month', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { year, month } = request.body as { year: number; month: number };

      if (!year || !month || month < 1 || month > 12) {
        return sendError(reply, 'year (YYYY) and month (1-12) are required');
      }

      const firstDay = new Date(year, month - 1, 1);
      const lastDay  = new Date(year, month, 0); // last day of the month

      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;

      const timeFrom = fmt(firstDay);
      const timeTo   = fmt(lastDay);

      let compCreated = 0, compUpdated = 0, compFetched = 0;
      let enqCreated  = 0, enqUpdated  = 0, enqFetched  = 0;
      const errors: string[] = [];

      // ── Complaints ──
      try {
        const complaints = await fetchCctnsComplaints(timeFrom, timeTo);
        compFetched = complaints.length;

        for (const row of complaints as CctnsComplaintRow[]) {
          if (!row.ComplRegNum) continue;
          const data: Record<string, unknown> = {
            complRegNum:    row.ComplRegNum,
            compCategory:   row.ComplCategory || row.ComplMainCat || null,
            psrNumber:      row.PSRNmuber || null,
            firNumber:      row.FIRNumber || null,
            firDate:        row.FIRDate ? new Date(row.FIRDate) : null,
            ActSection:     row.ActSection || null,
            accusedName:    row.AccusedName || null,
            accusedAge:     row.AccusedAge ? parseInt(String(row.AccusedAge)) : null,
            accusedAddress: row.AccusedAddress || null,
            victimName:     row.VictimName || null,
            incidentDate:   row.IncidentDate ? new Date(row.IncidentDate) : null,
          };
          try {
            await prisma.cCTNSComplaint.upsert({
              where:  { complRegNum: row.ComplRegNum },
              update: data,
              create: data,
            });
            // can't easily count create vs update with upsert — count as created
            compCreated++;
          } catch (e: any) {
            errors.push(`Complaint ${row.ComplRegNum}: ${e.message}`);
          }
        }
      } catch (e: any) {
        errors.push(`Complaints fetch failed: ${e.message}`);
      }

      // ── Enquiries ──
      try {
        const enquiries = await fetchCctnsEnquiries(timeFrom, timeTo);
        enqFetched = enquiries.length;

        for (const row of enquiries as CctnsEnquiryRow[]) {
          const complRegNum = row.COMPL_REG_NUM;
          if (!complRegNum) continue;
          const data: Record<string, unknown> = {
            complRegNum,
            compCategory:  row.COMPLAINT_ACTION_TAKEN || null,
            ActSection:    row.ENQ_REMARKS || null,
            accusedName:   row.office_incharge?.trim() || null,
            incidentDate:  row.Investigation_start_date ? new Date(row.Investigation_start_date) : null,
          };
          try {
            await prisma.cCTNSComplaint.upsert({
              where:  { complRegNum },
              update: data,
              create: data,
            });
            enqCreated++;
          } catch (e: any) {
            errors.push(`Enquiry ${complRegNum}: ${e.message}`);
          }
        }
      } catch (e: any) {
        errors.push(`Enquiries fetch failed: ${e.message}`);
      }

      return sendSuccess(reply, {
        period: `${timeFrom} – ${timeTo}`,
        complaints: { fetched: compFetched, upserted: compCreated },
        enquiries:  { fetched: enqFetched,  upserted: enqCreated  },
        errors: errors.slice(0, 20), // cap to first 20 errors
      });
    } catch (error) {
      console.error('Bulk month sync error:', error);
      return sendError(reply, `Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
};