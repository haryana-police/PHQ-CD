$val = "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true"

# Update production
vercel env add DATABASE_URL production --value $val --yes --scope courtdataportal-3064s-projects --force 2>&1 | Out-Null
Write-Host "Updated Production DATABASE_URL"

# Update preview
vercel env add DATABASE_URL preview --value $val --yes --scope courtdataportal-3064s-projects --force 2>&1 | Out-Null
Write-Host "Updated Preview DATABASE_URL"

# Update development
vercel env add DATABASE_URL development --value $val --yes --scope courtdataportal-3064s-projects --force 2>&1 | Out-Null
Write-Host "Updated Development DATABASE_URL"

# Redeploy to apply changes to preview
Write-Host "Redeploying to preview..."
vercel deploy --scope courtdataportal-3064s-projects --yes
