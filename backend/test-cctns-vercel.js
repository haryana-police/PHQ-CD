async function test() {
  const loginRes = await fetch("https://backend-plum-six-63.vercel.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password123" })
  });
  const loginData = await loginRes.json();
  const jwt = loginData.data.token;

  console.log("Got JWT:", jwt.substring(0, 20) + "...");

  console.log("\n--- Testing /api/cctns/enquiries-live ---");
  const cctnsRes = await fetch("https://backend-plum-six-63.vercel.app/api/cctns/enquiries-live?timeFrom=23/04/2026&timeTo=27/04/2026", {
    headers: { "Authorization": `Bearer ${jwt}` }
  });
  
  const text = await cctnsRes.text();
  console.log("CCTNS Res Status:", cctnsRes.status);
  console.log("CCTNS Res Body:", text);
}
test().catch(console.error);
