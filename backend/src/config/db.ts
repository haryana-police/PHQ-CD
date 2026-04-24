import sql from 'mssql';
import 'dotenv/config';

// Split server\instance for tedious (named instances need instanceName separately)
const rawServer = process.env.DB_SERVER || 'LALIT-PC\\SQLEXPRESS';
const [serverHost, instanceName] = rawServer.split('\\');

const dbConfig: sql.config = {
  server: serverHost,
  database: process.env.DB_NAME || 'db_CMS_PHQ',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: instanceName || undefined,
  },
};

let pool: sql.ConnectionPool | null = null;

export const connectDB = async () => {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('✅ Database connected!');
  }
  return pool;
};

export const disconnectDB = async () => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};

export const query = async (sqlQuery: string, params: any[] = []): Promise<any[]> => {
  const p = await connectDB();
  const request = p.request();
  
  for (const param of params) {
    request.input(param.name, param.value);
  }
  
  const result = await request.query(sqlQuery);
  return result.recordset;
};

export const queryOne = async (sqlQuery: string, params: any[] = []): Promise<any | null> => {
  const rows = await query(sqlQuery, params);
  return rows.length > 0 ? rows[0] : null;
};

export const initGovernmentTables = async () => {
  const createTablesSQL = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'District_Master')
    BEGIN
      CREATE TABLE District_Master (
        ID INT PRIMARY KEY,
        DistrictName NVARCHAR(255) NOT NULL UNIQUE,
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
      );
    END;

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PoliceStation_Master')
    BEGIN
      CREATE TABLE PoliceStation_Master (
        ID INT PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        DistrictID INT NOT NULL,
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
      );
    END;

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Offices_Master')
    BEGIN
      CREATE TABLE Offices_Master (
        ID INT PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
      );
    END;
  `;
  
  try {
    await query(createTablesSQL);
    console.log('✅ Government tables initialized');
  } catch (error) {
    console.error('Failed to init government tables:', error);
  }
};