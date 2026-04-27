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

const processInBatches = async <T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<void>
) => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(item => processor(item)));
  }
};

interface CctnsSyncResult {
  timeFrom: string;
  timeTo: string;
  complaints: {
    fetched: number;
    upserted: number;
    errors: number;
  };
  enquiries: {
    fetched: number;
    upserted: number;
    errors: number;
  };
}

let isSyncing = false;

export const runCctnsSync = async (): Promise<CctnsSyncResult | null> => {
  if (isSyncing) {
    console.log('[SYNC] Already syncing, skipping...');
    return null;
  }

  isSyncing = true;
  console.log('[SYNC] Starting background CCTNS data sync...');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 2);

  const timeFrom = formatDateStr(startDate);
  const timeTo = formatDateStr(endDate);
  const result: CctnsSyncResult = {
    timeFrom,
    timeTo,
    complaints: { fetched: 0, upserted: 0, errors: 0 },
    enquiries: { fetched: 0, upserted: 0, errors: 0 },
  };

  try {
    console.log(`[SYNC] Fetching complaints from ${timeFrom} to ${timeTo}...`);
    const complaints = (await fetchCctnsComplaints(timeFrom, timeTo)) as CctnsComplaintRow[];
    result.complaints.fetched = complaints.length;

    await processInBatches(complaints, 10, async (row) => {
      if (!row.ComplRegNum) return;

      const data = {
        complRegNum: row.ComplRegNum,
        compCategory: row.ComplCategory || row.ComplMainCat || null,
        psrNumber: row.PSRNmuber || null,
        firNumber: row.FIRNumber || null,
        firDate: row.FIRDate ? new Date(row.FIRDate) : null,
        ActSection: row.ActSection || null,
        accusedName: row.AccusedName || null,
        accusedAge: row.AccusedAge ? parseInt(String(row.AccusedAge), 10) : null,
        accusedAddress: row.AccusedAddress || null,
        victimName: row.VictimName || null,
        incidentDate: row.IncidentDate ? new Date(row.IncidentDate) : null,
      };

      try {
        await prisma.cCTNSComplaint.upsert({
          where: { complRegNum: row.ComplRegNum },
          update: data,
          create: data,
        });
        result.complaints.upserted++;
      } catch (error) {
        result.complaints.errors++;
        console.error('[SYNC] Error saving complaint:', error);
      }
    });

    console.log(`[SYNC] Complaints synced. Fetched: ${result.complaints.fetched}, Upserted: ${result.complaints.upserted}, Errors: ${result.complaints.errors}`);
  } catch (error) {
    result.complaints.errors++;
    console.error(`[SYNC] Failed to sync complaints: ${error}`);
  }

  try {
    console.log(`[SYNC] Fetching enquiries from ${timeFrom} to ${timeTo}...`);
    const enquiries = (await fetchCctnsEnquiries(timeFrom, timeTo)) as CctnsEnquiryRow[];
    result.enquiries.fetched = enquiries.length;

    await processInBatches(enquiries, 10, async (row) => {
      const complRegNum = row.COMPL_REG_NUM || null;
      if (!complRegNum) return;

      const data = {
        complRegNum,
        compCategory: row.COMPLAINT_ACTION_TAKEN || null,
        ActSection: row.ENQ_REMARKS || null,
        accusedName: row.office_incharge?.trim() || null,
        incidentDate: row.Investigation_start_date ? new Date(row.Investigation_start_date) : null,
      };

      try {
        await prisma.cCTNSComplaint.upsert({
          where: { complRegNum },
          update: data,
          create: data,
        });
        result.enquiries.upserted++;
      } catch (error) {
        result.enquiries.errors++;
        console.error('[SYNC] Error saving enquiry:', error);
      }
    });

    console.log(`[SYNC] Enquiries synced. Fetched: ${result.enquiries.fetched}, Upserted: ${result.enquiries.upserted}, Errors: ${result.enquiries.errors}`);
  } catch (error) {
    result.enquiries.errors++;
    console.error(`[SYNC] Failed to sync enquiries: ${error}`);
  } finally {
    isSyncing = false;
  }

  return result;
};

let intervalHandle: NodeJS.Timeout | null = null;

export const startCctnsBackgroundSync = () => {
  if (intervalHandle) return;

  runCctnsSync().catch(error => console.error('[SYNC] Initial sync failed:', error));
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  intervalHandle = setInterval(() => {
    runCctnsSync().catch(error => console.error('[SYNC] Scheduled sync failed:', error));
  }, FOUR_HOURS_MS);
};
