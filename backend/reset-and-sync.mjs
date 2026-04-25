/**
 * STEP 1: Clear all dummy/seeded data
 * STEP 2: Sync real CCTNS data from Haryana Police API
 *
 * Safe tables kept as-is:
 *   - Admin (1 record = your login)
 *   - District_Master, PoliceStation_Master, Offices_Master (real gov data)
 *
 * Tables cleared:
 *   - Complaint (dummy seeded + wrongly mapped old CCTNSComplaint data)
 *   - WomenSafety (all dummy)
 *   - District (app-level dummy, not the Master tables)
 *   - CCTNSComplaint (old wrong table, now replaced by Complaint)
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

function mapRow(row) {
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

// Generate date range list: one entry per month (matching old project logic)
function getMonthRanges(startYear, startMonth, endYear, endMonth) {
  const ranges = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const lastDay = new Date(y, m, 0).getDate(); // last day of month
    const from = `01/${String(m).padStart(2,'0')}/${y}`;
    const to   = `${String(lastDay).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
    ranges.push({ from, to, label: `${String(m).padStart(2,'0')}/${y}` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return ranges;
}

async function getToken() {
  const res = await fetch('http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken?SecretKey=UserHryDashboard');
  return (await res.text()).trim().replace(/^"|"$/g, '');
}

async function fetchMonth(token, from, to, label) {
  const url = `http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData?TimeFrom=${encodeURIComponent(from)}&TimeTo=${encodeURIComponent(to)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (!res.ok) {
      console.log(`  [${label}] HTTP ${res.status} — skipping`);
      return [];
    }
    const text = await res.text();
    if (!text || text.trim() === '[]') return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    console.log(`  [${label}] Error: ${e.message} — skipping`);
    return [];
  }
}

async function main() {
  console.log('=== PHQ Dashboard — Clear Dummy + Sync Live CCTNS Data ===\n');

  // ── STEP 1: CLEAR DUMMY DATA ──
  console.log('Step 1: Deleting dummy data...');
  
  // Must delete in order to avoid FK constraint violations
  await prisma.cCTNSComplaint.deleteMany({});
  console.log('  ✓ CCTNSComplaint cleared');

  await prisma.complaint.deleteMany({});
  console.log('  ✓ Complaints cleared');

  await prisma.womenSafety.deleteMany({});
  console.log('  ✓ WomenSafety cleared');

  // District app table has FK refs - clear after child tables
  await prisma.district.deleteMany({});
  console.log('  ✓ Districts (app table) cleared');

  console.log('  ✓ Admin login preserved');
  console.log('  ✓ Government Master tables preserved (District_Master, PoliceStation_Master, Offices_Master)\n');

  // ── STEP 2: GET TOKEN ──
  console.log('Step 2: Getting CCTNS token...');
  let token;
  try {
    token = await getToken();
    console.log('  ✓ Token obtained:', token.substring(0, 16) + '...\n');
  } catch(e) {
    console.error('  ✗ Failed to get token:', e.message);
    await prisma.$disconnect();
    return;
  }

  // ── STEP 3: SYNC LIVE DATA ──
  // Old project synced from 2015 to current. We sync from Jan 2024 to Apr 2025 to match old project's range.
  // You can expand the range freely.
  const ranges = getMonthRanges(2024, 1, 2025, 3);
  console.log(`Step 3: Syncing ${ranges.length} months of live CCTNS data...`);

  let totalFetched = 0, totalCreated = 0, totalUpdated = 0, totalSkipped = 0;

  for (const { from, to, label } of ranges) {
    process.stdout.write(`  Fetching ${label}... `);
    
    const rows = await fetchMonth(token, from, to, label);
    process.stdout.write(`${rows.length} records → `);

    let created = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      const complRegNum = str(row.COMPL_REG_NUM);
      if (!complRegNum) { skipped++; continue; }

      try {
        const mapped = mapRow(row);
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
        skipped++;
      }
    }

    totalFetched += rows.length;
    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;
    console.log(`created=${created} updated=${updated} skipped=${skipped}`);

    // Small delay to avoid overloading government servers (same as old project's 300ms)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n=== Sync Complete ===');
  console.log(`Total fetched : ${totalFetched}`);
  console.log(`Total created : ${totalCreated}`);
  console.log(`Total updated : ${totalUpdated}`);
  console.log(`Total skipped : ${totalSkipped}`);

  const finalCount = await prisma.complaint.count();
  console.log(`\nFinal Complaint count in DB: ${finalCount}`);

  await prisma.$disconnect();
}

main();
