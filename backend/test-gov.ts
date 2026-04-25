import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    const district = { ID: '1', Name: 'Test' };
    const res = await prisma.$executeRawUnsafe(
      `IF NOT EXISTS (SELECT 1 FROM District_Master WHERE ID = ${parseInt(district.ID)}) INSERT INTO District_Master (ID, DistrictName) VALUES (${parseInt(district.ID)}, '${district.Name.replace(/'/g, "''")}')`
    );
    console.log("Execute Result:", res);
    
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM District_Master ORDER BY DistrictName');
    console.log("Rows:", rows);
  } catch(e) {
    console.error("Prisma Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
