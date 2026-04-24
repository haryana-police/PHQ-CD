import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  
  // Create admin
  const hashed = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: {
      username: 'admin',
      password: hashed,
      role: 'admin'
    }
  });
  
  console.log('✅ Admin created!');
  await prisma.$disconnect();
}

main();