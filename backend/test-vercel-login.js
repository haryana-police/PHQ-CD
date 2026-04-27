async function test() {
  try {
    const res = await fetch('https://backend-plum-six-63.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    
    if (res.ok) {
      console.log('Success:', await res.json());
    } else {
      console.log('Error:', res.status, await res.text());
    }
  } catch (err) {
    console.log('Fetch Error:', err.message);
  }
}
test();
