import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { getCctnsToken, fetchCctnsComplaints, fetchCctnsEnquiries, clearCctnsToken } from '../services/cctns.js';

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

export const cctnsSyncRoutes = async (fastify: FastifyInstance) => {
  
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
          complRegNum: row.ComplRegNum || row.ComplRegNum || null,
          compCategory: row.ComplCategory || row.ComplMainCat || null,
          psrNumber: row.PSRNmuber || null,
          firNumber: row.FIRNumber || null,
          firDate: row.FIRDate ? new Date(row.FIRDate) : null,
          ActSection: row.ActSection || null,
          accusedName: row.AccusedName || null,
          accusedAge: row.AccusedAge ? parseInt(String(row.AccusedAge)) : null,
          accusedAddress: row.AccusedAddress || null,
          victimName: row.VictimName || null,
          incidentDate: row.IncidentDate ? new Date(row.IncidentDate) : null,
        };
        
        try {
          const existing = await prisma.cCTNSComplaint.findUnique({
            where: { complRegNum: String(data.complRegNum || '') },
          });
          
          if (existing) {
            await prisma.cCTNSComplaint.update({
              where: { id: existing.id },
              data,
            });
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
      
      for (const row of enquiries as CctnsComplaintRow[]) {
        const data: Record<string, unknown> = {
          complRegNum: row.ComplRegNum || row.ComplRegNum || null,
          compCategory: row.ComplCategory || row.ComplMainCat || null,
          psrNumber: row.PSRNmuber || null,
          firNumber: row.FIRNumber || null,
          firDate: row.FIRDate ? new Date(row.FIRDate) : null,
          ActSection: row.ActSection || null,
          accusedName: row.AccusedName || null,
          accusedAge: row.AccusedAge ? parseInt(String(row.AccusedAge)) : null,
          accusedAddress: row.AccusedAddress || null,
          victimName: row.VictimName || null,
          incidentDate: row.IncidentDate ? new Date(row.IncidentDate) : null,
        };
        
        try {
          const existing = await prisma.cCTNSComplaint.findUnique({
            where: { complRegNum: String(data.complRegNum || '') },
          });
          
          if (existing) {
            await prisma.cCTNSComplaint.update({
              where: { id: existing.id },
              data,
            });
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
};