import { getCctnsToken } from './src/services/cctns.js';
import { config } from 'dotenv';
config();

async function test() {
  try {
    const token = await getCctnsToken();
    console.log("Token:", token);
    
    // Test for a single day in the past to avoid timeouts
    const url = `http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData?TimeFrom=01/01/2024&TimeTo=02/01/2024`;
    console.log("Fetching URL:", url);
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response (first 500 chars):", text.substring(0, 500));
  } catch(e) {
    console.error(e);
  }
}
test();
