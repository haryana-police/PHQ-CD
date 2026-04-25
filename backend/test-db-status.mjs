import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

async function main() {
  const complaints = await prisma.complaint.count();
  const womenSafety = await prisma.womenSafety.count();
  const admins = await prisma.admin.count();
  const districts = await prisma.district.count();
  const districtMaster = await prisma.district_Master.count();
  const psMaster = await prisma.policeStation_Master.count();
  const officesMaster = await prisma.offices_Master.count();
  const cctns = await prisma.cCTNSComplaint.count();

  console.log('=== Current DB Record Counts ===');
  console.log('Complaints (main):', complaints);
  console.log('WomenSafety:', womenSafety);
  console.log('Admins:', admins);
  console.log('Districts (app table):', districts);
  console.log('CCTNSComplaint:', cctns);
  console.log('--- Government Master Tables ---');
  console.log('District_Master:', districtMaster);
  console.log('PoliceStation_Master:', psMaster);
  console.log('Offices_Master:', officesMaster);

  // Show a sample complaint to see if it looks like dummy data
  const sample = await prisma.complaint.findFirst({ orderBy: { id: 'asc' } });
  console.log('\n=== Sample complaint (first) ===');
  console.log(JSON.stringify(sample, null, 2));

  await prisma.$disconnect();
}
main();
