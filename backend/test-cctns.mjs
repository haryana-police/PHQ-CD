async function test() {
  const tokenApi = 'http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken';
  const secretKey = 'UserHryDashboard';
  const url = `${tokenApi}?SecretKey=${encodeURIComponent(secretKey)}`;

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const rawText = await res.text();
  console.log('[Token Raw]:', rawText.substring(0, 100));

  const token = rawText.trim().replace(/^"|"$/g, '');
  console.log('[Token]:', token);

  const complaintApi = 'http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData';
  const dataUrl = `${complaintApi}?TimeFrom=01/01/2024&TimeTo=02/01/2024`;

  const dataRes = await fetch(dataUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
  const data = await dataRes.text();
  console.log('[Data first 800]:', data.substring(0, 800));
}
test();
