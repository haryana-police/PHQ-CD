import 'dotenv/config';
import { prisma } from './src/config/database.js';
import { fetchCctnsComplaints, fetchCctnsEnquiries } from './src/services/cctns.js';

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
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function syncChunk(startDate: Date, endDate: Date) {
  const timeFrom = formatDateStr(startDate);
  const timeTo = formatDateStr(endDate);
  
  console.log(`\n--- Syncing chunk: ${timeFrom} to ${timeTo} ---`);

  try {
    const complaints = await fetchCctnsComplaints(timeFrom, timeTo);
    let compCreated = 0;
    let compUpdated = 0;

    const newComplaints = [];

    for (const row of complaints as CctnsComplaintRow[]) {
      const data: any = {
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

      if (data.complRegNum) {
        newComplaints.push(data);
      }
    }

    if (newComplaints.length > 0) {
      try {
        const result = await prisma.cCTNSComplaint.createMany({
          data: newComplaints,
          skipDuplicates: true,
        });
        compCreated = result.count;
      } catch (e) {
        console.error('Failed to bulk insert complaints:', e);
      }
    }

    console.log(`  Complaints: ${compCreated} created (duplicates skipped)`);
  } catch (error) {
    console.error(`  [!] Failed to sync complaints for chunk: ${error}`);
  }

  try {
    const enquiries = await fetchCctnsEnquiries(timeFrom, timeTo);
    let enqCreated = 0;
    let enqUpdated = 0;

    const newEnquiries = [];

    for (const row of enquiries as CctnsEnquiryRow[]) {
      const complRegNum = row.COMPL_REG_NUM || null;
      if (!complRegNum) continue;

      const data: any = {
        complRegNum:   String(complRegNum),
        compCategory:  row.COMPLAINT_ACTION_TAKEN || null,
        ActSection:    row.ENQ_REMARKS || null,
        accusedName:   row.office_incharge?.trim() || null,
        incidentDate:  row.Investigation_start_date ? new Date(row.Investigation_start_date) : null,
      };
      
      newEnquiries.push(data);
    }
    
    if (newEnquiries.length > 0) {
      try {
        const result = await prisma.cCTNSComplaint.createMany({
          data: newEnquiries,
          skipDuplicates: true,
        });
        enqCreated = result.count;
      } catch (e) {
        console.error('Failed to bulk insert enquiries:', e);
      }
    }

    console.log(`  Enquiries: ${enqCreated} created (duplicates skipped)`);
  } catch (error) {
    console.error(`  [!] Failed to sync enquiries for chunk: ${error}`);
  }
}

async function runHistoricalSync() {
  console.log('Starting historical sync for the past 180 days...');
  const endDate = new Date(); // Today
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 180); // 180 days ago

  let currentStart = new Date(startDate);
  
  while (currentStart < endDate) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 7); // 7-day chunks
    
    if (currentEnd > endDate) {
      currentEnd = endDate;
    }

    await syncChunk(currentStart, currentEnd);
    
    // Move to next chunk
    currentStart = new Date(currentEnd);
    // Add a slight delay to prevent API throttling
    await delay(2000); 
  }
  
  console.log('\n✅ Historical sync completed successfully!');
}

runHistoricalSync();
