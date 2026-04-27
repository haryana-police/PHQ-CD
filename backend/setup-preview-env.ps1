# Fix preview env vars - add --yes flag to skip branch prompt
$envVars = @{
    "DATABASE_URL" = "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:5432/postgres"
    "DIRECT_URL" = "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:5432/postgres"
    "JWT_SECRET" = "phq-dashboard-secret-key-2024"
    "CCTNS_SECRET_KEY" = "UserHryDashboard"
    "CCTNS_DECRYPT_KEY" = "O7yhrqWMMymKrM9Av64JkXo3GOoTebAyJlQ9diSxi0U="
    "CCTNS_TOKEN_API" = "http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken"
    "CCTNS_COMPLAINT_API" = "http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData"
    "CCTNS_ENQUIRY_API" = "http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData"
}

foreach ($key in $envVars.Keys) {
    $val = $envVars[$key]
    Write-Host "Setting $key for preview (all branches)..."
    vercel env add $key preview --value $val --yes --scope courtdataportal-3064s-projects --force 2>&1 | Out-Null
    Write-Host "  Done."
}

Write-Host "`nAll backend preview env vars set!"
