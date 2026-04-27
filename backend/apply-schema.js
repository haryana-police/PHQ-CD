const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log("Connected successfully");
    const sql = fs.readFileSync('schema.sql', 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const stmt of statements) {
      await client.query(stmt);
    }
    console.log("Schema applied successfully");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
