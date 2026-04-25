/**
 * End-to-end test:
 * 1. Get token
 * 2. Fetch complaints for a small date range
 * 3. Upsert into local DB via Prisma
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

function str(val) {
  const s = String(val ?? '').trim();
  return s === '' ? null : s;
}

function parseCctnsDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const match = dateStr.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
  if (match) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = match;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh.padStart(2,'0')}:${min.padStart(2,'0')}:${ss.padStart(2,'0')}.000Z`);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1753) return d;
  }
  return null;
}

async function main() {
  // Step 1: get token
  const tokenRes = await fetch('http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken?SecretKey=UserHryDashboard');
  const token = (await tokenRes.text()).trim().replace(/^"|"$/g, '');
  console.log('[Token]:', token.substring(0, 20) + '...');

  // Step 2: fetch complaints for just 1 day
  const dataRes = await fetch('http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData?TimeFrom=01/01/2024&TimeTo=01/01/2024', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  const rows = await dataRes.json();
  console.log('[Fetched]:', rows.length, 'records');

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const complRegNum = str(row.COMPL_REG_NUM);
    if (!complRegNum) { skipped++; continue; }

    try {
      const mapped = {
        complRegNum,
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

      const existing = await prisma.complaint.findUnique({ where: { complRegNum }, select: { id: true } });
      if (existing) {
        await prisma.complaint.update({
          where: { id: existing.id },
          data: { statusOfComplaint: mapped.statusOfComplaint, disposalDate: mapped.disposalDate, ioDetails: mapped.ioDetails }
        });
        updated++;
      } else {
        await prisma.complaint.create({ data: mapped });
        created++;
      }
    } catch(e) {
      console.error('[SKIP]', complRegNum, e.message);
      skipped++;
    }
  }

  console.log(`Done: created=${created}, updated=${updated}, skipped=${skipped}`);
  const total = await prisma.complaint.count();
  console.log(`Total complaints in DB: ${total}`);

  await prisma.$disconnect();
}
main();
