import { FastifyInstance } from 'fastify';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

interface ApiResponse {
  DropDownDTO?: Array<{ ID: string; Name: string }>;
}

async function fetchXmlAsJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/xml',
    },
  });
  
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  
  let xml = await res.text();
  xml = xml.replace(/<d2p1:/g, '<').replace(/<\/d2p1:/g, '</').replace(/<d3p1:/g, '<').replace(/<\/d3p1:/g, '</');
  
  const json: ApiResponse = { DropDownDTO: [] };
  
  const idMatches = xml.matchAll(/<ID>(.*?)<\/ID>/g);
  const nameMatches = xml.matchAll(/<Name>(.*?)<\/Name>/g);
  
  const ids = Array.from(idMatches, m => m[1]);
  const names = Array.from(nameMatches, m => m[1]);
  
  json.DropDownDTO = ids.map((id, i) => ({
    ID: id,
    Name: names[i] || '',
  }));
  
  return json as T;
}

export const governmentRoutes = async (fastify: FastifyInstance) => {
  
  // GET all districts from local DB (fast — seeded on startup from hardcoded list)
  fastify.get('/gov/districts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, districts);
    } catch (error) {
      console.error('Error fetching districts:', error);
      return sendError(reply, 'Failed to fetch districts');
    }
  });

  // GET all districts from local DB only (alias kept for compatibility)
  fastify.get('/gov/districts/local', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, districts);
    } catch (error) {
      console.error('Error fetching local districts:', error);
      return sendError(reply, 'Failed to fetch districts');
    }
  });

  // SYNC districts from external government API (slow — use manually when needed)
  fastify.get('/gov/districts/sync', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const apiUrl = process.env.HARYANA_DISTRICT_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/district';
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);
      
      if (!data.DropDownDTO || data.DropDownDTO.length === 0) {
        return sendError(reply, 'No districts found from API');
      }
      
      for (const district of data.DropDownDTO) {
        await prisma.district_Master.upsert({
          where: { id: BigInt(district.ID) },
          update: { DistrictName: district.Name },
          create: { id: BigInt(district.ID), DistrictName: district.Name }
        });
      }
      
      const districts = await prisma.district_Master.findMany({ orderBy: { DistrictName: 'asc' } });
      return sendSuccess(reply, districts);
    } catch (error) {
      console.error('District sync error:', error);
      return sendError(reply, 'Failed to sync districts from API');
    }
  });

  // GET police stations from government API by district ID
  fastify.get('/gov/police-stations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { districtId } = request.query as { districtId?: string };
      
      if (!districtId) {
        return sendError(reply, 'districtId is required');
      }
      
      const apiUrl = `${process.env.HARYANA_POLICE_STATION_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetPSByDistrict'}?state=13&district=${districtId}`;
      
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);
      
      if (!data.DropDownDTO || data.DropDownDTO.length === 0) {
        return sendError(reply, 'No police stations found');
      }
      
      // Save to local database
      for (const ps of data.DropDownDTO) {
        await prisma.policeStation_Master.upsert({
          where: { id: BigInt(ps.ID) },
          update: { Name: ps.Name, DistrictID: BigInt(districtId) },
          create: { id: BigInt(ps.ID), Name: ps.Name, DistrictID: BigInt(districtId) }
        });
      }
      
      // Return from local database
      const stations = await prisma.policeStation_Master.findMany({
        where: { DistrictID: BigInt(districtId) },
        orderBy: { Name: 'asc' }
      });
      
      return sendSuccess(reply, stations);
    } catch (error) {
      console.error('Police station sync error:', error);
      return sendError(reply, 'Failed to sync police stations');
    }
  });

  // GET police stations from local DB
  fastify.get('/gov/police-stations/local', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { districtId } = request.query as { districtId?: string };
      
      const stations = await prisma.policeStation_Master.findMany({
        where: districtId ? { DistrictID: BigInt(districtId) } : undefined,
        orderBy: { Name: 'asc' }
      });
      return sendSuccess(reply, stations);
    } catch (error) {
      console.error('Error fetching local police stations:', error);
      return sendError(reply, 'Failed to fetch police stations');
    }
  });

  // GET all offices from government API and cache
  fastify.get('/gov/offices', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const apiUrl = process.env.HARYANA_OFFICE_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetAllOffices';
      
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);
      
      if (!data.DropDownDTO || data.DropDownDTO.length === 0) {
        return sendError(reply, 'No offices found from API');
      }
      
      // Save to local database
      for (const office of data.DropDownDTO) {
        await prisma.offices_Master.upsert({
          where: { id: BigInt(office.ID) },
          update: { Name: office.Name },
          create: { id: BigInt(office.ID), Name: office.Name }
        });
      }
      
      // Return from local database
      const offices = await prisma.offices_Master.findMany({ orderBy: { Name: 'asc' }});
      
      return sendSuccess(reply, offices);
    } catch (error) {
      console.error('Office sync error:', error);
      return sendError(reply, 'Failed to sync offices');
    }
  });

  // GET offices from local DB only
  fastify.get('/gov/offices/local', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const offices = await prisma.offices_Master.findMany({ orderBy: { Name: 'asc' }});
      return sendSuccess(reply, offices);
    } catch (error) {
      console.error('Error fetching local offices:', error);
      return sendError(reply, 'Failed to fetch offices');
    }
  });

  // Sync all reference data at once
  fastify.get('/gov/sync-all', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const results: Record<string, unknown> = {};
      
      // Sync districts
      try {
        const districtApi = process.env.HARYANA_DISTRICT_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/district';
        const districtData = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(districtApi);
        
        for (const d of districtData.DropDownDTO || []) {
          await prisma.district_Master.upsert({
            where: { id: BigInt(d.ID) },
            update: { DistrictName: d.Name },
            create: { id: BigInt(d.ID), DistrictName: d.Name }
          });
        }
        results.districts = districtData.DropDownDTO?.length || 0;
      } catch (e) {
        results.districts = 0;
      }
      
      // Sync offices
      try {
        const officeApi = process.env.HARYANA_OFFICE_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/GetAllOffices';
        const officeData = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(officeApi);
        
        for (const o of officeData.DropDownDTO || []) {
          await prisma.offices_Master.upsert({
            where: { id: BigInt(o.ID) },
            update: { Name: o.Name },
            create: { id: BigInt(o.ID), Name: o.Name }
          });
        }
        results.offices = officeData.DropDownDTO?.length || 0;
      } catch (e) {
        results.offices = 0;
      }
      
      return sendSuccess(reply, { message: 'Sync completed', ...results });
    } catch (error) {
      console.error('Sync all error:', error);
      return sendError(reply, 'Sync failed');
    }
  });
};