const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function test() {
  try {
    const admin = await prisma.admin.findFirst();
    console.log('Success pooler:', admin?.username);
  } catch (err) {
    console.log('Error pooler:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
