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
export async function fetchCctnsComplaints(timeFrom: string, timeTo: string): Promise<Record<string, unknown>[]> {
  const token = await getCctnsToken();
  const complaintApi = process.env.CCTNS_COMPLAINT_API || 'http://api.haryanapolice.gov.in/phqdashboard/api/PHQDashboard/ComplaintData';

  const url = `${complaintApi}?TimeFrom=${encodeURIComponent(timeFrom)}&TimeTo=${encodeURIComponent(timeTo)}`;
  console.log('[CCTNS] Fetching complaints:', url);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      // No timeout set intentionally — old project used 10-minute HttpClient
    });
  } catch (err) {
    throw new Error(`CCTNS ComplaintData API unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    // Token may have expired — clear cache so next call gets a fresh one
    if (res.status === 401) {
      clearCctnsToken();
    }
    throw new Error(`Complaint API failed: ${res.status} ${res.statusText}`);
  }

  const responseText = await res.text();

  if (!responseText || responseText.trim() === '' || responseText.trim() === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(responseText);
    const rows = Array.isArray(parsed) ? parsed : (parsed.data || parsed.complaints || []);
    console.log(`[CCTNS] Fetched ${rows.length} records for ${timeFrom} - ${timeTo}`);
    return rows;
  } catch (error) {
    console.error('[CCTNS] Failed to parse complaints JSON. First 200 chars:', responseText.substring(0, 200));
    return [];
  }
}

/**
 * Fetch ENQUIRY complaints from Haryana Police CCTNS API (Endpoint B).
 * URL: /cmdashboard/api/HomeDashboard/ComplaintEnquiryData
 * Same token, same date format, same JSON array response.
 * These are CM Dashboard enquiry-type complaints (different source from PHQ complaints).
 */
export async function fetchCctnsEnquiries(timeFrom: string, timeTo: string): Promise<Record<string, unknown>[]> {
  const token = await getCctnsToken();
  const enquiryApi = process.env.CCTNS_ENQUIRY_API || 'http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData';

  const url = `${enquiryApi}?TimeFrom=${encodeURIComponent(timeFrom)}&TimeTo=${encodeURIComponent(timeTo)}`;
  console.log('[CCTNS] Fetching enquiry complaints:', url);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    throw new Error(`CCTNS ComplaintEnquiryData API unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    if (res.status === 401) clearCctnsToken();
    throw new Error(`Enquiry API failed: ${res.status} ${res.statusText}`);
  }

  const responseText = await res.text();
  if (!responseText || responseText.trim() === '' || responseText.trim() === '[]') return [];

  try {
    const parsed = JSON.parse(responseText);
    const rows = Array.isArray(parsed) ? parsed : (parsed.data || parsed.complaints || []);
    console.log(`[CCTNS] Fetched ${rows.length} enquiry records for ${timeFrom} - ${timeTo}`);
    return rows;
  } catch (error) {
    console.error('[CCTNS] Failed to parse enquiry JSON. First 200 chars:', responseText.substring(0, 200));
    return [];
  }
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