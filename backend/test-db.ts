import { query } from './src/config/db.js';

async function test() {
  try {
    const res = await query('SELECT * FROM District_Master');
    console.log("Success:", res.length);
    process.exit(0);
  } catch(e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}
test();
