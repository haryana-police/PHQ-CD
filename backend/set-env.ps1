echo "phq-dashboard-secret-key-2024" | vercel env add JWT_SECRET production,preview,development
echo "UserHryDashboard" | vercel env add CCTNS_SECRET_KEY production,preview,development
echo "O7yhrqWMMymKrM9Av64JkXo3GOoTebAyJlQ9diSxi0U=" | vercel env add CCTNS_DECRYPT_KEY production,preview,development
echo "http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken" | vercel env add CCTNS_TOKEN_API production,preview,development
echo "http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData" | vercel env add CCTNS_COMPLAINT_API production,preview,development
echo "http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData" | vercel env add CCTNS_ENQUIRY_API production,preview,development
echo "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:5432/postgres" | vercel env add DATABASE_URL production,preview,development
echo "postgresql://postgres:2qIgm5dXVmTehReC@db.wexeyxgadiupmdzuuenx.supabase.co:5432/postgres" | vercel env add DIRECT_URL production,preview,development
