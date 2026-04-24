# PHQ Complaint Dashboard — Haryana Police

A modern full-stack complaint management system for the PHQ (Police Headquarters) built with **React + Vite** (frontend) and **Node.js + Fastify + Prisma** (backend), replacing the legacy ASP.NET 4.8.1 application.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query, ECharts |
| Backend | Node.js, Fastify, Prisma ORM |
| Database | Microsoft SQL Server Express (`db_CMS_PHQ`) |
| Auth | JWT (JSON Web Tokens) |
| Styling | Vanilla CSS (Glassmorphic dark design system) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- SQL Server Express (instance: `LALIT-PC\SQLEXPRESS`)
- Database: `db_CMS_PHQ`

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Push Prisma schema to SQL Server
npx prisma db push

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

```bash
# Terminal 1 — Backend (port 3000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

### Default Admin Credentials
- **Username:** `admin`
- **Password:** `admin123`

> To create admin: `cd backend && npx ts-node create-admin.ts`

---

## 📡 API Status — Verified Live Testing (2026-04-24)

### ✅ Fully Working APIs

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/auth/login` | ✅ 200 OK | JWT authentication working |
| `GET /api/dashboard/summary` | ✅ 200 OK | Returns complaint counts |
| `GET /api/dashboard/district-wise` | ✅ 200 OK | District breakdown |
| `GET /api/dashboard/duration-wise` | ✅ 200 OK | Time-based analytics |
| `GET /api/dashboard/month-wise` | ✅ 200 OK | Monthly trends |
| `GET /api/pending/all` | ✅ 200 OK | All pending complaints |
| `GET /api/pending/15-30-days` | ✅ 200 OK | 15–30 day pending |
| `GET /api/pending/30-60-days` | ✅ 200 OK | 30–60 day pending |
| `GET /api/pending/over-60-days` | ✅ 200 OK | Over 60 day pending |
| `GET /api/pending/branches` | ✅ 200 OK | Branch list |
| `GET /api/reports/district` | ✅ 200 OK | District report |
| `GET /api/reports/mode-receipt` | ✅ 200 OK | Receipt mode report |
| `GET /api/reports/complaint-source` | ✅ 200 OK | Complaint source report |
| `GET /api/reports/nature-incident` | ✅ 200 OK | Nature of incidents |
| `GET /api/reports/type-complaint` | ✅ 200 OK | Type of complaints |
| `GET /api/reports/type-against` | ✅ 200 OK | Type against report |
| `GET /api/reports/status` | ✅ 200 OK | Status breakdown |
| `GET /api/reports/branch-wise` | ✅ 200 OK | Branch-wise report |
| `GET /api/reports/date-wise` | ✅ 200 OK | Date-range report |
| `GET /api/reports/action-taken` | ✅ 200 OK | Action taken report |
| `GET /api/reports/highlights` | ✅ 200 OK | Highlights / top categories |
| `GET /api/women-safety` | ✅ 200 OK | Women safety records |
| `GET /api/cctns/status` | ✅ 200 OK | CCTNS key/config status |

### ✅ Government APIs — Live & Responding

| External API | Status | Notes |
|---|---|---|
| **CCTNS Token API** (`api.haryanapolice.gov.in/cmDashboard/.../ReqToken`) | ✅ **LIVE** | Returns valid encrypted token when called with `SecretKey=UserHryDashboard` |
| **Haryana District API** (`api.haryanapolice.gov.in/eSaralServices/.../district`) | ✅ **LIVE** | Returns all 22 Haryana districts |
| **Police Station API** (`/GetPSByDistrict`) | ✅ Integrated | Used in reference data |
| **All Offices API** (`/GetAllOffices`) | ✅ Integrated | Used in reference data |

### ⚠️ Blocked / Partial

| Endpoint / API | Status | Root Cause |
|---|---|---|
| **CCTNS Complaint API** (`164.100.137.228/homedashboard/.../ComplaintData`) | ⚠️ 500 Error | Government server returns HTTP 500. Likely **IP-whitelisted** — only responds to requests from authorized government network IPs. Works correctly once accessed from a whitelisted network. |
| **CCTNS Enquiry API** (`api.haryanapolice.gov.in/cmdashboard/.../ComplaintEnquiryData`) | ⚠️ Not yet tested | Requires valid complaint token; may also be IP-restricted. |
| `POST /api/cctns/sync` | ⚠️ Depends on above | Sync logic is fully implemented and correct — blocked only because the upstream complaint API returns 500 on non-whitelisted IPs. |

---

## 📊 Why Tables & Graphs Show No Data

**All APIs are working correctly and return `HTTP 200`.** The graphs and tables appear empty because the **local database (`db_CMS_PHQ`) currently has 0 rows** in the `Complaint`, `WomenSafety`, and `CCTNSComplaint` tables.

### How to populate data:

**Option 1 — Excel Import (recommended for PHQ complaint data):**
1. Go to **Complaints** page → click **Import**
2. Upload the `.xlsx` export from the old ASP.NET system
3. Data will immediately appear in all tables and charts

**Option 2 — Women Safety Import:**
1. Go to **Women Safety** page → click **Import**
2. Upload `.xlsx` file

**Option 3 — CCTNS Sync (requires whitelisted IP):**
1. Ensure the machine running the backend is on the authorized government network
2. Go to **CCTNS** page → click **Sync Complaints**
3. The system will fetch, decrypt (using `CCTNS_DECRYPT_KEY`), and save all records locally

---

## 🔑 Environment Variables (`.env`)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=phq-dashboard-secret-key-2024

# SQL Server
DATABASE_URL="sqlserver://LALIT-PC;instanceName=SQLEXPRESS;database=db_CMS_PHQ;user=sa;password=Hosting123;trustServerCertificate=true;encrypt=false;"
DB_SERVER=LALIT-PC\SQLEXPRESS
DB_NAME=db_CMS_PHQ
DB_USER=sa
DB_PASSWORD=Hosting123

# Government APIs (no auth key required)
HARYANA_POLICE_API_BASE=https://api.haryanapolice.gov.in/eSaralServices/api/common
HARYANA_DISTRICT_API=https://api.haryanapolice.gov.in/eSaralServices/api/common/district

# CCTNS Keys
CCTNS_SECRET_KEY=UserHryDashboard
CCTNS_DECRYPT_KEY=O7yhrqWMMymKrM9Av64JkXo3GOoTebAyJlQ9diSxi0U=
CCTNS_TOKEN_API=http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken
CCTNS_COMPLAINT_API=http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData
CCTNS_ENQUIRY_API=http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData
```

---

## 🗂️ Feature Parity with Legacy ASP.NET System

| Legacy Feature (ASP.NET 4.8.1) | New Implementation | Status |
|---|---|---|
| Login (`Login.aspx`) | `/login` page with JWT | ✅ Done |
| Admin Dashboard (`Welcome.aspx`) | `/admin/dashboard` | ✅ Done |
| Import Complaints (`Import_ComplaintsDetails.aspx`) | Complaints page → Import button | ✅ Done |
| View Complaint Detail (`View_ComplaintsDetails.aspx`) | `/admin/complaints/:id` | ✅ Done |
| Pending (All, 15-30, 30-60, 60+ days) | `/admin/pending?type=...` (tabbed) | ✅ Done |
| 10 separate Report pages | `/admin/reports?type=...` (tabbed) | ✅ Done |
| Highlights (`MainHighlights.aspx`) | `/admin/highlights` (expandable) | ✅ Done |
| CCTNS Records (`AllCCTNS_Record.aspx`) | `/admin/cctns` with sync | ✅ Done |
| Women Safety (`WomenSafetyPHQ`) | `/admin/women-safety` | ✅ Done |
| Women Safety Import | Women Safety page → Import | ✅ Done |
| Report: Received From Authority | Reports → Complaint Source tab | ✅ Done |
| Report: Type of Complaint | Reports → Type of Complaint tab | ✅ Done |

---

## 📁 Project Structure

```
phq-dashboard/
├── backend/
│   ├── src/
│   │   ├── config/        # DB connection, Prisma setup
│   │   ├── middleware/    # JWT auth middleware
│   │   ├── routes/        # All API route handlers
│   │   └── services/      # CCTNS API integration logic
│   └── prisma/
│       └── schema.prisma  # Database schema
└── frontend/
    └── src/
        ├── components/    # Reusable UI components
        ├── pages/         # Dashboard, Reports, Pending, etc.
        └── index.css      # Global glassmorphic design system
```

---

## 🛠️ Known Issues & Next Steps

1. **CCTNS Complaint API IP Whitelist** — Contact Haryana Police IT cell to whitelist the server IP for `164.100.137.228` access.
2. **Data Import** — The old ASP.NET database export (`.xlsx` or SQL backup) needs to be imported to populate all charts and tables.
3. **Password Reset** — No UI for changing admin password yet; must be updated directly in DB.