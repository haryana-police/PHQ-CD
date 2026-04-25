async function test() {
  const url = 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetAllOffices';
  const res = await fetch(url, { headers: { 'Accept': 'application/xml' }});
  let xml = await res.text();
  
  xml = xml.replace(/<d2p1:/g, '<').replace(/<\/d2p1:/g, '</').replace(/<d3p1:/g, '<').replace(/<\/d3p1:/g, '</');
  const idMatches = Array.from(xml.matchAll(/<ID>(.*?)<\/ID>/g), m => m[1]);
  
  const numbers = idMatches.map(id => parseInt(id)).filter(n => !isNaN(n));
  const max = Math.max(...numbers);
  console.log("Max ID:", max);
  console.log("Is larger than Int32 Max (2147483647)?", max > 2147483647);
}
test();
