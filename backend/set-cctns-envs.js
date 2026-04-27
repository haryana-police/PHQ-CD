const { execSync } = require('child_process');

const envs = {
  CCTNS_SECRET_KEY: "UserHryDashboard",
  CCTNS_DECRYPT_KEY: "O7yhrqWMMymKrM9Av64JkXo3GOoTebAyJlQ9diSxi0U=",
  CCTNS_TOKEN_API: "http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken",
  CCTNS_COMPLAINT_API: "http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData",
  CCTNS_ENQUIRY_API: "http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData"
};

for (const [key, value] of Object.entries(envs)) {
  try {
    execSync(`vercel env rm ${key} production --scope courtdataportal-3064s-projects --yes`, {stdio:'ignore'});
  } catch(e) {}
}

for (const [key, value] of Object.entries(envs)) {
  console.log(`Adding ${key} to production...`);
  execSync(`vercel env add ${key} production --scope courtdataportal-3064s-projects`, {input: value, stdio:['pipe', 'ignore', 'ignore']});
}

console.log('Deploying to production...');
execSync(`vercel deploy --prod --scope courtdataportal-3064s-projects --yes`, {stdio:'inherit'});
