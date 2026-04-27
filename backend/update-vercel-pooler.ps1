vercel env rm DATABASE_URL production --scope courtdataportal-3064s-projects --yes
vercel env rm DATABASE_URL preview --scope courtdataportal-3064s-projects --yes
vercel env rm DATABASE_URL development --scope courtdataportal-3064s-projects --yes

vercel env rm DIRECT_URL production --scope courtdataportal-3064s-projects --yes
vercel env rm DIRECT_URL preview --scope courtdataportal-3064s-projects --yes
vercel env rm DIRECT_URL development --scope courtdataportal-3064s-projects --yes

$db = "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
$direct = "postgresql://postgres.wexeyxgadiupmdzuuenx:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

echo $db | vercel env add DATABASE_URL production --scope courtdataportal-3064s-projects
echo $db | vercel env add DATABASE_URL preview --scope courtdataportal-3064s-projects
echo $db | vercel env add DATABASE_URL development --scope courtdataportal-3064s-projects

echo $direct | vercel env add DIRECT_URL production --scope courtdataportal-3064s-projects
echo $direct | vercel env add DIRECT_URL preview --scope courtdataportal-3064s-projects
echo $direct | vercel env add DIRECT_URL development --scope courtdataportal-3064s-projects

Write-Host "Triggering prod deployment..."
vercel deploy --prod --scope courtdataportal-3064s-projects --yes
