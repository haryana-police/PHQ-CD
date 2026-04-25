import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const rows = await prisma.$queryRawUnsafe(`
  SELECT TOP 30 statusOfComplaint, COUNT(*) as cnt 
  FROM Complaint 
  GROUP BY statusOfComplaint 
  ORDER BY cnt DESC
`);

console.log('=== Distinct statusOfComplaint values ===');
rows.forEach(r => console.log(`  "${r.statusOfComplaint}" -> ${r.cnt}`));
await prisma.$disconnect();
