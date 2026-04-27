const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true"
    }
  }
});

async function main() {
  try {
    const admin = await prisma.admin.findFirst();
    if (admin) {
      console.log('--- ADMIN CREDENTIALS ---');
      console.log(`Username: ${admin.username}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Hashed Password: ${admin.password}`);
      console.log('-------------------------');
      console.log('NOTE: The original plaintext password was set to "password123" by the reset script earlier.');
    } else {
      console.log('No admin found in database!');
    }
  } catch (err) {
    console.log('Error reading from DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
