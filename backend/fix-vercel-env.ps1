vercel env rm DATABASE_URL production --scope courtdataportal-3064s-projects --yes
vercel env rm DATABASE_URL preview --scope courtdataportal-3064s-projects --yes
vercel env rm DATABASE_URL development --scope courtdataportal-3064s-projects --yes

echo "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL production --scope courtdataportal-3064s-projects
echo "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL preview --scope courtdataportal-3064s-projects
echo "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:6543/postgres?pgbouncer=true" | vercel env add DATABASE_URL development --scope courtdataportal-3064s-projects

Write-Host "Re-deploying..."
vercel deploy --prod --scope courtdataportal-3064s-projects --yes
