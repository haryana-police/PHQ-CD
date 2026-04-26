import { prisma } from '../config/database.js';
import { fetchCctnsComplaints, fetchCctnsEnquiries } from '../services/cctns.js';

// Fields from CCTNS Complaint Data API
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

// Fields from CCTNS Enquiry Data API
interface CctnsEnquiryRow {
  COMPL_REG_NUM?: string;
  office_incharge?: string;
  Investigation_start_date?: string;
  ENQ_REMARKS?: string;
  COMPLAINT_ACTION_TAKEN?: string;
  [key: string]: unknown;
}

const formatDateStr = (date: Date): string => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export const runCctnsSync = async () => {
  console.log('[SYNC] Starting background CCTNS data sync...');
  
  // Sync the last 2 days automatically
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 2);
  
  const timeFrom = formatDateStr(startDate);
  const timeTo = formatDateStr(endDate);

  try {
    console.log(`[SYNC] Fetching complaints from ${timeFrom} to ${timeTo}...`);
    const complaints = await fetchCctnsComplaints(timeFrom, timeTo);
    
    let compCreated = 0;
    let compUpdated = 0;

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

      if (!data.complRegNum) continue;

      try {
        const existing = await prisma.cCTNSComplaint.findUnique({
          where: { complRegNum: String(data.complRegNum) },
        });

        if (existing) {
          await prisma.cCTNSComplaint.update({ where: { id: existing.id }, data });
          compUpdated++;
        } else {
          await prisma.cCTNSComplaint.create({ data });
          compCreated++;
        }
      } catch (e) {
        console.error('[SYNC] Error saving complaint:', e);
      }
    }
    console.log(`[SYNC] Complaints synced. Created: ${compCreated}, Updated: ${compUpdated}`);
  } catch (error) {
    console.error(`[SYNC] Failed to sync complaints: ${error}`);
  }

  try {
    console.log(`[SYNC] Fetching enquiries from ${timeFrom} to ${timeTo}...`);
    const enquiries = await fetchCctnsEnquiries(timeFrom, timeTo);

    let enqCreated = 0;
    let enqUpdated = 0;

    for (const row of enquiries as CctnsEnquiryRow[]) {
      const complRegNum = row.COMPL_REG_NUM || null;
      if (!complRegNum) continue;

      const data: Record<string, unknown> = {
        complRegNum,
        compCategory:  row.COMPLAINT_ACTION_TAKEN || null,
        ActSection:    row.ENQ_REMARKS || null,
        accusedName:   row.office_incharge?.trim() || null,
        incidentDate:  row.Investigation_start_date ? new Date(row.Investigation_start_date) : null,
      };

      try {
        const existing = await prisma.cCTNSComplaint.findUnique({
          where: { complRegNum: String(complRegNum) },
        });

        if (existing) {
          await prisma.cCTNSComplaint.update({ where: { id: existing.id }, data });
          enqUpdated++;
        } else {
          await prisma.cCTNSComplaint.create({ data });
          enqCreated++;
        }
      } catch (e) {
        console.error('[SYNC] Error saving enquiry:', e);
      }
    }
    console.log(`[SYNC] Enquiries synced. Created: ${enqCreated}, Updated: ${enqUpdated}`);
  } catch (error) {
    console.error(`[SYNC] Failed to sync enquiries: ${error}`);
  }
};

export const startCctnsBackgroundSync = () => {
  // Run once immediately, then every 4 hours
  runCctnsSync();
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  setInterval(runCctnsSync, FOUR_HOURS_MS);
};
