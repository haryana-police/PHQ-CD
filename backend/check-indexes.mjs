import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking existing indexes on Complaint table ===');
  
  const existing = await prisma.$queryRawUnsafe(`
    SELECT i.name, i.type_desc, c.name as column_name
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('Complaint')
    ORDER BY i.name, ic.key_ordinal
  `);
  
  console.log('Existing indexes:');
  existing.forEach(r => console.log(' -', r.name, '|', r.type_desc, '| col:', r.column_name));

  console.log('\n=== Creating missing performance indexes ===');

  // Index on statusOfComplaint — needed for LIKE '%Disposed%', '%Pending%' counts
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Complaint_status' AND object_id = OBJECT_ID('Complaint'))
      CREATE INDEX IX_Complaint_status ON Complaint (statusOfComplaint)
    `);
    console.log('✅ IX_Complaint_status created (or already exists)');
  } catch (e) { console.error('❌ IX_Complaint_status:', e.message); }

  // Index on complRegDt — needed for date range queries
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Complaint_regDt' AND object_id = OBJECT_ID('Complaint'))
      CREATE INDEX IX_Complaint_regDt ON Complaint (complRegDt)
    `);
    console.log('✅ IX_Complaint_regDt created (or already exists)');
  } catch (e) { console.error('❌ IX_Complaint_regDt:', e.message); }

  // Index on addressDistrict — needed for GROUP BY district
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Complaint_district' AND object_id = OBJECT_ID('Complaint'))
      CREATE INDEX IX_Complaint_district ON Complaint (addressDistrict)
    `);
    console.log('✅ IX_Complaint_district created (or already exists)');
  } catch (e) { console.error('❌ IX_Complaint_district:', e.message); }

  // Composite index — needed for date+status combined queries (summary cards)
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Complaint_regDt_status' AND object_id = OBJECT_ID('Complaint'))
      CREATE INDEX IX_Complaint_regDt_status ON Complaint (complRegDt, statusOfComplaint)
    `);
    console.log('✅ IX_Complaint_regDt_status created (or already exists)');
  } catch (e) { console.error('❌ IX_Complaint_regDt_status:', e.message); }

  console.log('\n=== Done ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
