import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== FETCHING 5 SAMPLE COMPLAINTS ===");
  // Fetch 5 complaints that have dates set so we have meaningful data
  // Let's try to get a mix of disposed and pending
  const disposed = await prisma.complaint.findMany({
    where: { statusOfComplaint: { contains: 'Disposed' }, complRegDt: { not: null }, disposalDate: { not: null } },
    take: 2,
    select: { id: true, statusOfComplaint: true, complRegDt: true, disposalDate: true, addressDistrict: true }
  });
  
  const pending = await prisma.complaint.findMany({
    where: { 
      OR: [{ statusOfComplaint: null }, { statusOfComplaint: '' }, { statusOfComplaint: { contains: 'Pending' } }],
      complRegDt: { not: null }
    },
    take: 3,
    select: { id: true, statusOfComplaint: true, complRegDt: true, disposalDate: true, addressDistrict: true }
  });

  const sampleComplaints = [...disposed, ...pending];
  console.log(JSON.stringify(sampleComplaints, null, 2));

  console.log("\n=== MANUAL CALCULATION ON THESE 5 COMPLAINTS ===");
  
  // Avg Disposal Time
  let totalDisposalDays = 0;
  let disposedCount = 0;
  sampleComplaints.forEach(c => {
    if (c.statusOfComplaint?.includes('Disposed') && c.complRegDt && c.disposalDate) {
      const days = (c.disposalDate.getTime() - c.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`Complaint ${c.id}: Disposed. Disposal Time = ${days} days`);
      totalDisposalDays += days;
      disposedCount++;
    }
  });
  const avgDisposalTime = disposedCount > 0 ? Math.round(totalDisposalDays / disposedCount) : 0;
  console.log(`\nCalculated Avg Disposal Time for Sample: ${totalDisposalDays} / ${disposedCount} = ${avgDisposalTime} days`);

  // Pendency Ageing Matrix
  const now = new Date().getTime();
  const matrixMap = new Map();
  console.log("\nAgeing Calculation for Pending Complaints:");
  sampleComplaints.forEach(c => {
    if (!c.statusOfComplaint || c.statusOfComplaint === '' || c.statusOfComplaint.includes('Pending')) {
      if (c.complRegDt) {
        const daysPending = (now - c.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
        let bucket = '';
        if (daysPending < 7) bucket = 'u7';
        else if (daysPending < 15) bucket = 'u15';
        else if (daysPending < 30) bucket = 'u30';
        else bucket = 'o30';
        
        console.log(`Complaint ${c.id}: Pending. Age = ${daysPending.toFixed(2)} days -> Bucket: ${bucket}`);
        
        const dist = c.addressDistrict || 'Unknown';
        if (!matrixMap.has(dist)) matrixMap.set(dist, { u7: 0, u15: 0, u30: 0, o30: 0 });
        const stats = matrixMap.get(dist);
        stats[bucket]++;
      }
    }
  });

  console.log(`\nCalculated Ageing Matrix for Sample:`);
  console.log(JSON.stringify(Array.from(matrixMap.entries()).map(([district, stats]) => ({ district, ...stats })), null, 2));

  console.log("\n=== API DASHBOARD TOTAL SUMMARY RESULTS ===");
  // Fetch actual API dashboard summary values
  const totalReceived = await prisma.complaint.count();
  const totalDisposed = await prisma.complaint.count({ where: { statusOfComplaint: { contains: 'Disposed' } } });
  
  const PENDING_WHERE = [
    { statusOfComplaint: null },
    { statusOfComplaint: { equals: '' } },
    { statusOfComplaint: { contains: 'Pending' } },
  ];
  const totalPending = await prisma.complaint.count({ where: { OR: PENDING_WHERE } });
  
  const allDisposedComplaints = await prisma.complaint.findMany({
    where: { statusOfComplaint: { contains: 'Disposed' }, complRegDt: { not: null }, disposalDate: { not: null } },
    select: { complRegDt: true, disposalDate: true }
  });

  let apiTotalDisposalDays = 0;
  allDisposedComplaints.forEach(c => {
    if (c.complRegDt && c.disposalDate) {
      apiTotalDisposalDays += (c.disposalDate.getTime() - c.complRegDt.getTime()) / (1000 * 60 * 60 * 24);
    }
  });
  const apiAvgDisposalTime = allDisposedComplaints.length > 0 ? Math.round(apiTotalDisposalDays / allDisposedComplaints.length) : 0;

  console.log(JSON.stringify({
    totalReceived,
    totalDisposed,
    totalPending,
    avgDisposalTime: apiAvgDisposalTime,
    disposedCountWithDates: allDisposedComplaints.length
  }, null, 2));

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
