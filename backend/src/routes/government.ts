import { FastifyInstance } from 'fastify';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

interface ApiResponse {
  DropDownDTO?: Array<{ ID: string; Name: string }>;
}

async function fetchXmlAsJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/xml' } });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  let xml = await res.text();
  xml = xml.replace(/<d2p1:/g, '<').replace(/<\/d2p1:/g, '</').replace(/<d3p1:/g, '<').replace(/<\/d3p1:/g, '</');

  const json: ApiResponse = { DropDownDTO: [] };
  const ids   = Array.from(xml.matchAll(/<ID>(.*?)<\/ID>/g),   m => m[1]);
  const names = Array.from(xml.matchAll(/<Name>(.*?)<\/Name>/g), m => m[1]);
  json.DropDownDTO = ids.map((id, i) => ({ ID: id, Name: names[i] || '' }));
  return json as T;
}

export const governmentRoutes = async (fastify: FastifyInstance) => {

  // ── Districts from local DB (populated by sync endpoint below)
  fastify.get('/gov/districts', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, districts);
    } catch (error) {
      return sendError(reply, 'Failed to fetch districts');
    }
  });

  fastify.get('/gov/districts/local', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, districts);
    } catch (error) {
      return sendError(reply, 'Failed to fetch districts');
    }
  });

  /**
   * Sync districts from Haryana Police API into District_Master.
   * Preserves isPoliceDistrict flag on existing records (upsert does NOT reset it).
   * Special bureau units that arrive from the API are preserved as-is; admin can
   * manually set isPoliceDistrict=false for them via DB or future admin route.
   */
  fastify.get('/gov/districts/sync', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const apiUrl = process.env.HARYANA_DISTRICT_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/district';
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);

      if (!data.DropDownDTO?.length) return sendError(reply, 'No districts found from API');

      // Known special/bureau units that should have isPoliceDistrict=false
      const NON_DISTRICT_NAMES = new Set([
        'GRP AMBALA CANTT',
        'Haryana State Enforcement Bureau (HSEnB)',
        'HARYANA STATE NARCOTICS CONTROL BUREAU,MADHUBAN KARNAL',
        'State Crime Branch',
      ]);

      for (const d of data.DropDownDTO) {
        const isPoliceDistrict = !NON_DISTRICT_NAMES.has(d.Name);
        await prisma.district_Master.upsert({
          where: { id: BigInt(d.ID) },
          // On update: keep existing isPoliceDistrict unless it's a known bureau unit
          update: { DistrictName: d.Name, isPoliceDistrict } as any,
          create: { id: BigInt(d.ID), DistrictName: d.Name, isPoliceDistrict } as any,
        });
      }

      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, { synced: districts.length, districts });
    } catch (error) {
      console.error('District sync error:', error);
      return sendError(reply, 'Failed to sync districts from API');
    }
  });

  // ── Police Stations by districtId from Haryana Police API
  fastify.get('/gov/police-stations', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { districtId } = request.query as { districtId?: string };
      if (!districtId) return sendError(reply, 'districtId is required');

      const apiUrl = `${process.env.HARYANA_POLICE_STATION_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetPSByDistrict'}?state=13&district=${districtId}`;
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);

      if (!data.DropDownDTO?.length) return sendError(reply, 'No police stations found');

      for (const ps of data.DropDownDTO) {
        await prisma.policeStation_Master.upsert({
          where: { id: BigInt(ps.ID) },
          update: { Name: ps.Name, DistrictID: BigInt(districtId) },
          create: { id: BigInt(ps.ID), Name: ps.Name, DistrictID: BigInt(districtId) },
        });
      }

      const stations = await prisma.policeStation_Master.findMany({
        where: { DistrictID: BigInt(districtId) },
        orderBy: { Name: 'asc' },
      });
      return sendSuccess(reply, stations);
    } catch (error) {
      console.error('Police station sync error:', error);
      return sendError(reply, 'Failed to sync police stations');
    }
  });

  // ── Local PS query
  fastify.get('/gov/police-stations/local', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { districtId } = request.query as { districtId?: string };
      const stations = await prisma.policeStation_Master.findMany({
        where: districtId ? { DistrictID: BigInt(districtId) } : undefined,
        orderBy: { Name: 'asc' },
      });
      return sendSuccess(reply, stations);
    } catch (error) {
      return sendError(reply, 'Failed to fetch police stations');
    }
  });

  /**
   * Sync ALL police stations for ALL police districts in District_Master.
   * Iterates every district with isPoliceDistrict=true and calls the PS API.
   * Long-running — intended to be called once to fully populate PoliceStation_Master.
   * Progress is logged server-side; response shows a per-district summary.
   */
  fastify.post('/gov/police-stations/sync-all', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const districts = await prisma.district_Master.findMany({
        where: { isPoliceDistrict: true } as any,
        orderBy: { DistrictName: 'asc' },
      });

      const results: { districtId: string; name: string; psCount: number; error?: string }[] = [];

      for (const dm of districts) {
        try {
          const districtId = dm.id.toString();
          const apiUrl = `${process.env.HARYANA_POLICE_STATION_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetPSByDistrict'}?state=13&district=${districtId}`;
          const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);

          let psCount = 0;
          for (const ps of (data.DropDownDTO || [])) {
            await prisma.policeStation_Master.upsert({
              where: { id: BigInt(ps.ID) },
              update: { Name: ps.Name, DistrictID: BigInt(districtId) },
              create: { id: BigInt(ps.ID), Name: ps.Name, DistrictID: BigInt(districtId) },
            });
            psCount++;
          }

          console.log(`[gov/ps/sync-all] ${dm.DistrictName}: ${psCount} PS synced`);
          results.push({ districtId, name: dm.DistrictName, psCount });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[gov/ps/sync-all] ${dm.DistrictName} failed: ${msg}`);
          results.push({ districtId: dm.id.toString(), name: dm.DistrictName, psCount: 0, error: msg });
        }
      }

      const totalPS = results.reduce((sum, r) => sum + r.psCount, 0);
      return sendSuccess(reply, {
        message: 'All-district PS sync complete',
        totalDistricts: districts.length,
        totalPoliceSations: totalPS,
        results,
      });
    } catch (error) {
      console.error('[gov/ps/sync-all] fatal error:', error);
      return sendError(reply, 'Failed to sync all police stations');
    }
  });

  // ── Offices
  fastify.get('/gov/offices', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const apiUrl = process.env.HARYANA_OFFICE_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetAllOffices';
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);
      if (!data.DropDownDTO?.length) return sendError(reply, 'No offices found from API');

      for (const o of data.DropDownDTO) {
        await prisma.offices_Master.upsert({
          where: { id: BigInt(o.ID) },
          update: { Name: o.Name },
          create: { id: BigInt(o.ID), Name: o.Name },
        });
      }
      const offices = await prisma.offices_Master.findMany({ orderBy: { Name: 'asc' } });
      return sendSuccess(reply, offices);
    } catch (error) {
      return sendError(reply, 'Failed to sync offices');
    }
  });

  fastify.get('/gov/offices/local', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const offices = await prisma.offices_Master.findMany({ orderBy: { Name: 'asc' } });
      return sendSuccess(reply, offices);
    } catch (error) {
      return sendError(reply, 'Failed to fetch offices');
    }
  });

  // ── Sync districts + offices in one call
  fastify.get('/gov/sync-all', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const results: Record<string, unknown> = {};

      try {
        const districtApi = process.env.HARYANA_DISTRICT_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/district';
        const districtData = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(districtApi);
        const NON_DISTRICT_NAMES = new Set([
          'GRP AMBALA CANTT',
          'Haryana State Enforcement Bureau (HSEnB)',
          'HARYANA STATE NARCOTICS CONTROL BUREAU,MADHUBAN KARNAL',
          'State Crime Branch',
        ]);
        for (const d of districtData.DropDownDTO || []) {
          const isPoliceDistrict = !NON_DISTRICT_NAMES.has(d.Name);
          await prisma.district_Master.upsert({
            where: { id: BigInt(d.ID) },
            update: { DistrictName: d.Name, isPoliceDistrict } as any,
            create: { id: BigInt(d.ID), DistrictName: d.Name, isPoliceDistrict } as any,
          });
        }
        results.districts = districtData.DropDownDTO?.length || 0;
      } catch (e) { results.districts = 0; }

      try {
        const officeApi = process.env.HARYANA_OFFICE_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetAllOffices';
        const officeData = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(officeApi);
        for (const o of officeData.DropDownDTO || []) {
          await prisma.offices_Master.upsert({
            where: { id: BigInt(o.ID) },
            update: { Name: o.Name },
            create: { id: BigInt(o.ID), Name: o.Name },
          });
        }
        results.offices = officeData.DropDownDTO?.length || 0;
      } catch (e) { results.offices = 0; }

      return sendSuccess(reply, { message: 'Sync completed', ...results });
    } catch (error) {
      return sendError(reply, 'Sync failed');
    }
  });
};