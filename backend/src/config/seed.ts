import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hardcoded 22 official Haryana districts + common aliases.
 * These are seeded into District_Master on startup so that
 * /gov/districts/local works immediately without needing the external API.
 */
const HARYANA_DISTRICTS: { id: number; name: string }[] = [
  { id: 1,  name: 'AMBALA' },
  { id: 2,  name: 'BHIWANI' },
  { id: 3,  name: 'CHARKHI DADRI' },
  { id: 4,  name: 'FARIDABAD' },
  { id: 5,  name: 'FATEHABAD' },
  { id: 6,  name: 'GURUGRAM' },
  { id: 7,  name: 'HISAR' },
  { id: 8,  name: 'JHAJJAR' },
  { id: 9,  name: 'JIND' },
  { id: 10, name: 'KAITHAL' },
  { id: 11, name: 'KARNAL' },
  { id: 12, name: 'KURUKSHETRA' },
  { id: 13, name: 'MAHENDERGARH' },
  { id: 14, name: 'NUH' },
  { id: 15, name: 'PALWAL' },
  { id: 16, name: 'PANCHKULA' },
  { id: 17, name: 'PANIPAT' },
  { id: 18, name: 'REWARI' },
  { id: 19, name: 'ROHTAK' },
  { id: 20, name: 'SIRSA' },
  { id: 21, name: 'SONIPAT' },
  { id: 22, name: 'YAMUNANAGAR' },
];

export async function seedDistrictMaster(): Promise<void> {
  try {
    // Check if already seeded
    const existing = await prisma.district_Master.count();
    if (existing >= HARYANA_DISTRICTS.length) {
      console.log(`✅ District_Master already seeded (${existing} records)`);
      return;
    }

    for (const d of HARYANA_DISTRICTS) {
      await prisma.district_Master.upsert({
        where: { id: BigInt(d.id) },
        update: { DistrictName: d.name },
        create: { id: BigInt(d.id), DistrictName: d.name },
      });
    }
    console.log(`✅ District_Master seeded with ${HARYANA_DISTRICTS.length} Haryana districts`);
  } catch (err) {
    console.warn('⚠️ District_Master seed warning:', err instanceof Error ? err.message : err);
  }
}
