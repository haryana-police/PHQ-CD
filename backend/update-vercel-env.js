const fs = require('fs');

const TOKEN = process.env.VERCEL_TOKEN;
const BACKEND_PROJECT_ID = 'prj_uAulasQGr9TuEOIleJvvGCTfZ7Hf';
const FRONTEND_PROJECT_ID = 'prj_fAH5kLzCqFBMiDHb8kXzaOdwf7XF';
const TEAM_ID = 'team_LFptVDR1sFKvC4p8MuAfN3CP';

async function fetchEnvVars(projectId) {
  const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?teamId=${TEAM_ID}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  return data.envs || [];
}

async function updateEnvVarTarget(projectId, envId, key, value, type) {
  // First delete the existing one
  await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${envId}?teamId=${TEAM_ID}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  // Then recreate with all targets
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key,
      value: String(value),
      type,
      target: ['production', 'preview', 'development']
    })
  });
  if (!res.ok) {
      console.log(`Failed to add ${key}:`, await res.text());
  } else {
      console.log(`Added ${key} to all environments`);
  }
}

async function processProject(projectId, label) {
  console.log(`Processing ${label}...`);
  const envs = await fetchEnvVars(projectId);
  
  for (const env of envs) {
    if (env.target.includes('preview') && env.target.includes('development') && env.target.includes('production')) {
      console.log(`Skipping ${env.key}, already has all targets.`);
      continue;
    }
    
    // For Vercel API, if it's encrypted, we can't get the plaintext value from the API.
    // If it's the backend, we read from .env
    console.log(`Need to update ${env.key} for ${label}`);
  }
}

async function main() {
  const dotenv = fs.readFileSync('.env', 'utf8');
  const localEnvs = {};
  for (const line of dotenv.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          localEnvs[match[1].trim()] = val;
      }
  }

  // Update backend envs using local .env values since API values are encrypted
  console.log('Updating backend...');
  const backendEnvs = await fetchEnvVars(BACKEND_PROJECT_ID);
  for (const env of backendEnvs) {
     if (env.key in localEnvs) {
        console.log(`Updating backend env ${env.key}`);
        await updateEnvVarTarget(BACKEND_PROJECT_ID, env.id, env.key, localEnvs[env.key], 'encrypted');
     }
  }

  console.log('Updating frontend...');
  const frontendEnvs = await fetchEnvVars(FRONTEND_PROJECT_ID);
  for (const env of frontendEnvs) {
      if (env.key === 'VITE_API_URL') {
         console.log(`Updating frontend env ${env.key}`);
         await updateEnvVarTarget(FRONTEND_PROJECT_ID, env.id, env.key, 'https://backend-sigma-six-18.vercel.app', 'plain');
      }
  }

  console.log('Done!');
}

main().catch(console.error);
