const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true"
    }
  }
});

async function test() {
  try {
    const admin = await prisma.admin.findFirst();
    console.log('Success connecting on port 6543:', admin?.username);
  } catch (err) {
    console.log('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
