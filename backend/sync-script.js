const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'phq-dashboard-secret-key-2024';
const BASE_URL = 'https://backend-sigma-six-18.vercel.app';

// Generate admin token
const token = jwt.sign(
  { id: 1, username: 'admin', role: 'superadmin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const monthsToSync = [
  { year: 2025, month: 11 },
  { year: 2025, month: 12 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
  { year: 2026, month: 4 }
];

async function syncAll() {
  console.log('Starting historical data sync...');
  for (const { year, month } of monthsToSync) {
    console.log(`Syncing ${year}-${month}...`);
    try {
      const response = await fetch(`${BASE_URL}/api/cctns/sync-month`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ year, month })
      });
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (response.ok) {
          console.log(`Success for ${year}-${month}:`, JSON.stringify(json, null, 2));
        } else {
          console.error(`Error for ${year}-${month}:`, response.status, json);
        }
      } catch (e) {
        console.error(`Failed to parse response for ${year}-${month}:`, response.status, text);
      }
    } catch (e) {
      console.error(`Network error for ${year}-${month}:`, e.message);
    }
  }
  console.log('Finished sync process.');
}

syncAll();
