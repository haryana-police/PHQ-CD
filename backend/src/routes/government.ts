import { FastifyInstance } from 'fastify';
import { sendSuccess, sendError } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { query, queryOne } from '../config/db.js';

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
  
  // GET all districts from government API and cache to local DB
  fastify.get('/gov/districts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const apiUrl = process.env.HARYANA_DISTRICT_API || 'https://api.haryanapolice.gov.in/eSaralServices/api/common/district';
      
      const data = await fetchXmlAsJson<{ DropDownDTO: Array<{ ID: string; Name: string }> }>(apiUrl);
      
      if (!data.DropDownDTO || data.DropDownDTO.length === 0) {
        return sendError(reply, 'No districts found from API');
      }
      
      // Save to local database
      for (const district of data.DropDownDTO) {
        await query(
          `IF NOT EXISTS (SELECT 1 FROM District_Master WHERE ID = @id) INSERT INTO District_Master (ID, DistrictName) VALUES (@id, @name)`,
          [{ name: 'id', value: parseInt(district.ID) }, { name: 'name', value: district.Name }]
        );
      }
      
      // Return from local database
      const districts = await query('SELECT * FROM District_Master ORDER BY DistrictName');
      
      return sendSuccess(reply, districts);
    } catch (error) {
      console.error('District sync error:', error);
      return sendError(reply, 'Failed to sync districts');
    }
  });

  // GET all districts from local DB only (fast)
  fastify.get('/gov/districts/local', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const districts = await query('SELECT * FROM District_Master ORDER BY DistrictName');
      return sendSuccess(reply, districts);
    } catch (error) {
      return sendError(reply, 'Failed to fetch districts');
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
        await query(
          `IF NOT EXISTS (SELECT 1 FROM PoliceStation_Master WHERE ID = @id) INSERT INTO PoliceStation_Master (ID, Name, DistrictID) VALUES (@id, @name, @districtId)`,
          [{ name: 'id', value: parseInt(ps.ID) }, { name: 'name', value: ps.Name }, { name: 'districtId', value: parseInt(districtId) }]
        );
      }
      
      // Return from local database
      const stations = await query('SELECT * FROM PoliceStation_Master WHERE DistrictID = @districtId ORDER BY Name', [{ name: 'districtId', value: parseInt(districtId) }]);
      
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
      
      let sql = 'SELECT * FROM PoliceStation_Master';
      let params: any[] = [];
      
      if (districtId) {
        sql += ' WHERE DistrictID = @districtId';
        params = [{ name: 'districtId', value: parseInt(districtId) }];
      }
      
      sql += ' ORDER BY Name';
      
      const stations = await query(sql, params);
      return sendSuccess(reply, stations);
    } catch (error) {
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
        await query(
          `IF NOT EXISTS (SELECT 1 FROM Offices_Master WHERE ID = @id) INSERT INTO Offices_Master (ID, Name) VALUES (@id, @name)`,
          [{ name: 'id', value: parseInt(office.ID) }, { name: 'name', value: office.Name }]
        );
      }
      
      // Return from local database
      const offices = await query('SELECT * FROM Offices_Master ORDER BY Name');
      
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
      const offices = await query('SELECT * FROM Offices_Master ORDER BY Name');
      return sendSuccess(reply, offices);
    } catch (error) {
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
          await query(
            `IF NOT EXISTS (SELECT 1 FROM District_Master WHERE ID = @id) INSERT INTO District_Master (ID, DistrictName) VALUES (@id, @name)`,
            [{ name: 'id', value: parseInt(d.ID) }, { name: 'name', value: d.Name }]
          );
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
          await query(
            `IF NOT EXISTS (SELECT 1 FROM Offices_Master WHERE ID = @id) INSERT INTO Offices_Master (ID, Name) VALUES (@id, @name)`,
            [{ name: 'id', value: parseInt(o.ID) }, { name: 'name', value: o.Name }]
          );
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