// Bulk sync via Vercel backend - calls the deployed API in weekly batches
// First logs in to get a JWT, then calls sync-enquiries for each week

const BACKEND_URL = 'https://backend-sigma-six-18.vercel.app';

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }

function getWeeklyRanges(monthsBack) {
  const ranges = [];
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsBack);
  
  let current = new Date(start);
  while (current < now) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > now) weekEnd.setTime(now.getTime());
    
    ranges.push({ from: fmtDate(current), to: fmtDate(weekEnd) });
    
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
  }
  return ranges;
}

async function login() {
  console.log('Logging in...');
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const data = await res.json();
  if (data.data?.token) {
    console.log('✅ Login successful\n');
    return data.data.token;
  }
  throw new Error('Login failed: ' + JSON.stringify(data));
}

async function syncWeek(token, timeFrom, timeTo) {
  const res = await fetch(`${BACKEND_URL}/api/cctns/sync-enquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ timeFrom, timeTo }),
  });
  return await res.json();
}

async function main() {
  const MONTHS_BACK = 6;
  const ranges = getWeeklyRanges(MONTHS_BACK);
  
  console.log(`\n🔄 CCTNS Bulk Sync via Vercel Backend`);
  console.log(`   Last ${MONTHS_BACK} months in ${ranges.length} weekly batches\n`);
  
  const token = await login();
  
  let totalFetched = 0, totalCreated = 0, totalUpdated = 0;
  
  for (let i = 0; i < ranges.length; i++) {
    const { from, to } = ranges[i];
    process.stdout.write(`[${i + 1}/${ranges.length}] ${from} → ${to} ... `);
    
    try {
      const result = await syncWeek(token, from, to);
      
      if (result.data) {
        const { fetched = 0, created = 0, updated = 0 } = result.data;
        totalFetched += fetched;
        totalCreated += created;
        totalUpdated += updated;
        console.log(`✅ Fetched: ${fetched}, Created: ${created}, Updated: ${updated}`);
      } else {
        console.log(`⚠ ${result.error || JSON.stringify(result).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
    
    // Wait 2s between batches to avoid serverless cold start issues
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Sync Complete!`);
  console.log(`   Total fetched:  ${totalFetched}`);
  console.log(`   Total created:  ${totalCreated}`);
  console.log(`   Total updated:  ${totalUpdated}`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch(e => console.error('Fatal:', e.message));
