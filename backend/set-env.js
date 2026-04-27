const { execSync } = require('child_process');
const fs = require('fs');

const envs = {
  DATABASE_URL: "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
};

for (const [key, value] of Object.entries(envs)) {
  try {
    execSync(`vercel env rm ${key} production --yes`, { stdio: 'ignore' });
  } catch (e) {}
  
  try {
    fs.writeFileSync('temp.txt', value);
    execSync(`cmd.exe /c "vercel env add ${key} production < temp.txt"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed to add ${key}`);
  }
}
try { fs.unlinkSync('temp.txt'); } catch(e) {}
console.log("Done");
