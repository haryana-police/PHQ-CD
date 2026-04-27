const { execSync } = require('child_process');

const db = "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const direct = "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

const envs = ['production', 'preview', 'development'];

for (const env of envs) {
  try {
    console.log(`Removing DATABASE_URL from ${env}...`);
    execSync(`vercel env rm DATABASE_URL ${env} --scope courtdataportal-3064s-projects --yes`, {stdio:'inherit'});
  } catch(e) { console.log('Already removed or not found.'); }
  
  try {
    console.log(`Removing DIRECT_URL from ${env}...`);
    execSync(`vercel env rm DIRECT_URL ${env} --scope courtdataportal-3064s-projects --yes`, {stdio:'inherit'});
  } catch(e) { console.log('Already removed or not found.'); }
}

for (const env of envs) {
  console.log(`Adding DATABASE_URL to ${env}...`);
  execSync(`vercel env add DATABASE_URL ${env} --scope courtdataportal-3064s-projects`, {input: db, stdio:['pipe', 'inherit', 'inherit']});
  
  console.log(`Adding DIRECT_URL to ${env}...`);
  execSync(`vercel env add DIRECT_URL ${env} --scope courtdataportal-3064s-projects`, {input: direct, stdio:['pipe', 'inherit', 'inherit']});
}

console.log('Deploying to production...');
execSync(`vercel deploy --prod --scope courtdataportal-3064s-projects --yes`, {stdio:'inherit'});
