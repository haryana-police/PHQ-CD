/**
 * CCTNS Integration Service
 * Mirrors exactly the logic from old project: ComplaintDataFetch.aspx.cs
 *
 * Two data endpoints — both share the same token:
 * A) ComplaintData (PHQ complaints)
 *    GET /phqdashboard/api/PHQDashboard/ComplaintData?TimeFrom=dd/MM/yyyy&TimeTo=dd/MM/yyyy
 *
 * B) ComplaintEnquiryData (CM Dashboard enquiry complaints)
 *    GET /cmdashboard/api/HomeDashboard/ComplaintEnquiryData?TimeFrom=dd/MM/yyyy&TimeTo=dd/MM/yyyy
 *
 * Token flow (same for both):
 *    GET /cmDashboard/api/HomeDashboard/ReqToken?SecretKey=UserHryDashboard → bearer token (cached 55 min)
 */

interface CctnsToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CctnsToken | null = null;

export async function getCctnsToken(): Promise<string> {
  // Return cached token if still valid (55 min cache — same as old project's 10-min HttpClient timeout)
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const secretKey = process.env.CCTNS_SECRET_KEY || 'UserHryDashboard';
  const tokenApi = process.env.CCTNS_TOKEN_API || 'http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken';

  const url = `${tokenApi}?SecretKey=${encodeURIComponent(secretKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
    });
  } catch (err) {
    throw new Error(`Cannot reach CCTNS Token API: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`Token API HTTP error: ${res.status} ${res.statusText}`);
  }

  const rawText = await res.text();
  console.log('[CCTNS] Raw token API response:', rawText.substring(0, 100));

  // API returns a plain JSON string: "tokenvalue" (with surrounding quotes)
  const tokenStr = rawText.trim().replace(/^"|"$/g, '');

  if (!tokenStr || tokenStr.length < 10) {
    throw new Error(`Could not extract token from API response. Raw: ${rawText.substring(0, 100)}`);
  }

  cachedToken = {
    token: tokenStr,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutes
  };

  console.log('[CCTNS] Token obtained successfully');
  return tokenStr;
}

export function clearCctnsToken(): void {
  cachedToken = null;
}

/**
 * Fetch complaints from Haryana Police CCTNS API.
 * Dates must be in dd/MM/yyyy format exactly like old project.
 * Returns raw JSON array matching the Complaints table fields.
 */
function parseDDMMYYYY(dateStr: string): Date {
  const [d, m, y] = dateStr.split('/');
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function formatDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function chunkDateRange(fromStr: string, toStr: string, maxDays: number = 30): {from: string, to: string}[] {
  const chunks: {from: string, to: string}[] = [];
  let currentStart = parseDDMMYYYY(fromStr);
  const end = parseDDMMYYYY(toStr);

  while (currentStart <= end) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + maxDays);
    
    if (currentEnd > end) {
      currentEnd = end;
    }

    chunks.push({
      from: formatDDMMYYYY(currentStart),
      to: formatDDMMYYYY(currentEnd)
    });

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

export async function fetchCctnsComplaints(timeFrom: string, timeTo: string): Promise<Record<string, unknown>[]> {
  const chunks = chunkDateRange(timeFrom, timeTo, 30);
  let allRows: Record<string, unknown>[] = [];
  const complaintApi = process.env.CCTNS_COMPLAINT_API || 'http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData';

  for (const chunk of chunks) {
    const token = await getCctnsToken();
    const url = `${complaintApi}?TimeFrom=${encodeURIComponent(chunk.from)}&TimeTo=${encodeURIComponent(chunk.to)}`;
    console.log(`[CCTNS] Fetching complaints chunk ${chunk.from} - ${chunk.to}:`, url);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      throw new Error(`CCTNS ComplaintData API unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      if (res.status === 401) clearCctnsToken();
      throw new Error(`Complaint API failed for chunk ${chunk.from}-${chunk.to}: ${res.status} ${res.statusText}`);
    }

    const responseText = await res.text();
    if (!responseText || responseText.trim() === '' || responseText.trim() === '[]') {
      continue;
    }

    try {
      const parsed = JSON.parse(responseText);
      const rows = Array.isArray(parsed) ? parsed : (parsed.data || parsed.complaints || []);
      console.log(`[CCTNS] Fetched ${rows.length} records for chunk`);
      allRows = allRows.concat(rows);
    } catch (error) {
      console.error(`[CCTNS] Failed to parse JSON for chunk. Length: ${responseText.length}`);
    }
  }

  return allRows;
}

/**
 * Fetch ENQUIRY complaints from Haryana Police CCTNS API (Endpoint B).
 * URL: /cmdashboard/api/HomeDashboard/ComplaintEnquiryData
 * Same token, same date format, same JSON array response.
 * These are CM Dashboard enquiry-type complaints (different source from PHQ complaints).
 */
export async function fetchCctnsEnquiries(timeFrom: string, timeTo: string): Promise<Record<string, unknown>[]> {
  const chunks = chunkDateRange(timeFrom, timeTo, 30);
  let allRows: Record<string, unknown>[] = [];
  const enquiryApi = process.env.CCTNS_ENQUIRY_API || 'http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData';

  for (const chunk of chunks) {
    const token = await getCctnsToken();
    const url = `${enquiryApi}?TimeFrom=${encodeURIComponent(chunk.from)}&TimeTo=${encodeURIComponent(chunk.to)}`;
    console.log(`[CCTNS Enquiry] Fetching chunk ${chunk.from} - ${chunk.to}:`, url);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      throw new Error(`CCTNS Enquiry API unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      if (res.status === 401) clearCctnsToken();
      throw new Error(`Enquiry API failed for chunk ${chunk.from}-${chunk.to}: ${res.status} ${res.statusText}`);
    }

    const responseText = await res.text();
    if (!responseText || responseText.trim() === '' || responseText.trim() === '[]') {
      continue;
    }

    try {
      const parsed = JSON.parse(responseText);
      const rows = Array.isArray(parsed) ? parsed : (parsed.data || parsed.complaints || []);
      console.log(`[CCTNS Enquiry] Fetched ${rows.length} records for chunk`);
      allRows = allRows.concat(rows);
    } catch (error) {
      console.error(`[CCTNS Enquiry] Failed to parse JSON for chunk. Length: ${responseText.length}`);
    }
  }

  return allRows;
}
export function parseCctnsDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;

  // Try "dd-MM-yyyy HH:mm:ss" (CCTNS standard format)
  const match = dateStr.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
  if (match) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = match;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh.padStart(2,'0')}:${min.padStart(2,'0')}:${ss.padStart(2,'0')}.000Z`);
    // SQL Server minimum date guard (same as old project: dt >= new DateTime(1753, 1, 1))
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1753) return d;
  }

  return null;
}