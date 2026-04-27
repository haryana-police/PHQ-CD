const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});
client.connect()
  .then(() => { console.log("Pooler aws-1 connected successfully"); client.end(); })
  .catch(err => { console.error("Connection error aws-1:", err.message); client.end(); });
