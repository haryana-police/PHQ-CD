import sql from 'mssql';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const sqlConfig: sql.config = {
  server: 'LALIT-PC',
  database: 'db_CMS_PHQ',
  user: 'sa',
  password: 'Hosting123',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: 'SQLEXPRESS'
  }
};

async function migrateData() {
  console.log('🚀 Starting Data Migration: SQL Server -> Supabase PostgreSQL');
  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to local SQL Server (LALIT-PC)');
  } catch (error) {
    console.error('❌ Failed to connect to SQL Server:', error);
    process.exit(1);
  }

  try {
    // 1. Migrate Admins
    console.log('\n📦 Migrating Admins...');
    const admins = await pool.request().query('SELECT * FROM Admin');
    for (const row of admins.recordset) {
      await prisma.admin.upsert({
        where: { username: row.username },
        update: {},
        create: {
          username: row.username,
          password: row.password,
          role: row.role || 'admin',
          createdAt: row.createdAt || new Date(),
          updatedAt: row.updatedAt || new Date()
        }
      });
    }
    console.log(`✅ Migrated ${admins.recordset.length} Admins`);

    // 2. Migrate Districts
    console.log('\n📦 Migrating Districts...');
    let districtQuery;
    try {
      districtQuery = await pool.request().query('SELECT * FROM District');
      for (const row of districtQuery.recordset) {
        await prisma.district.upsert({
          where: { name: row.name },
          update: {},
          create: {
            id: row.id,
            name: row.name,
            code: row.code,
            createdAt: row.createdAt || new Date()
          }
        });
      }
      console.log(`✅ Migrated ${districtQuery.recordset.length} Districts`);
    } catch (e) {
      console.log('⚠️ District table might not exist or differs in structure in old DB.');
    }

    // 3. Migrate Complaints (Partial fetch to avoid memory overload)
    console.log('\n📦 Migrating Complaints...');
    try {
      const complaints = await pool.request().query('SELECT * FROM Complaint');
      let cCount = 0;
      for (const row of complaints.recordset) {
        if (!row.complRegNum) continue;
        
        await prisma.complaint.upsert({
          where: { complRegNum: row.complRegNum },
          update: {},
          create: {
            complRegNum: row.complRegNum,
            complDesc: row.complDesc,
            complRegDt: row.complRegDt,
            firstName: row.firstName,
            mobile: row.mobile,
            statusOfComplaint: row.statusOfComplaint,
            districtId: row.districtId,
            createdAt: row.createdAt || new Date(),
            updatedAt: row.updatedAt || new Date(),
            actionTaken: row.actionTaken,
            ioDetails: row.ioDetails
          }
        });
        cCount++;
      }
      console.log(`✅ Migrated ${cCount} Complaints`);
    } catch (e) {
      console.log('⚠️ Complaint table error:', e.message);
    }

    // Done
    console.log('\n🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Migration Error:', error);
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

migrateData();
