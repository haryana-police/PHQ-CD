# PHQ Complaint Dashboard - Modern Stack Implementation

## Project Overview

This is the modern stack implementation of the PHQ Complaint Dashboard, converted from ASP.NET Web Forms to Node.js + Fastify + React.

## Project Structure

```
phq-dashboard/
├── backend/               # Node.js + Fastify + TypeScript API
│   ├── prisma/           # Prisma schema
│   ├── src/
│   │   ├── config/      # Configuration
│   │   ├── middleware/ # Auth middleware
│   │   ├── routes/     # API routes
│   │   ├── types/     # TypeScript types
│   │   ├── utils/     # Utilities
│   │   └── index.ts   # Entry point
│   └── package.json
│
└── frontend/            # React + Vite + TypeScript
    ├── src/
    │   ├── components/ # Reusable components
    │   │   ├── charts/# ECharts wrappers
    │   │   ├── common/ # Button, Card, Input
    │   │   ├── data/  # DataTable
    │   │   └── layout/# Layout
    │   ├── hooks/    # Custom hooks
    │   ├── pages/    # Page components
    │   ├── services/ # API services
    │   └── types/    # TypeScript types
    └── package.json
```

## Technology Stack

### Backend
- Node.js 20+
- Fastify (Web Framework)
- TypeScript
- Prisma ORM
- SQL Server
- JWT Authentication
- Zod Validation

### Frontend
- React 18+
- TypeScript
- Vite (Build Tool)
- TanStack Query (State Management)
- Apache ECharts (Charts)
- Tailwind CSS
- React Router v6

## Getting Started

### Prerequisites
- Node.js 20+
- SQL Server
- npm or yarn

### Backend Setup

1. Navigate to backend folder:
```bash
cd phq-dashboard/backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variable:
```bash
# Edit .env.example and save as .env
DATABASE_URL="sqlserver://sa:your_password@LALIT-PC\\SQLEXPRESS:1433/db_CMS_PHQ?encrypt=true&trustServerCertificate=true"
JWT_SECRET="your-secret-key"
PORT=3000
```

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Push schema to database:
```bash
npx prisma db push
```

6. Start server:
```bash
npm run dev
```

The backend will run on http://localhost:3000

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd phq-dashboard/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variable:
```bash
# Edit .env.example and save as .env
VITE_API_URL=http://localhost:3000
```

4. Start development server:
```bash
npm run dev
```

The frontend will run on http://localhost:5173

## API Endpoints

### Authentication
- POST /api/auth/login - Login
- POST /api/auth/register - Register admin
- GET /api/auth/me - Get current user

### Complaints
- GET /api/complaints - List complaints (paginated)
- GET /api/complaints/:id - Get complaint
- POST /api/complaints - Create complaint
- PUT /api/complaints/:id - Update complaint
- DELETE /api/complaints/:id - Delete complaint

### Dashboard
- GET /api/dashboard/summary - Summary stats
- GET /api/dashboard/district-wise - District chart data
- GET /api/dashboard/duration-wise - Duration chart data
- GET /api/dashboard/date-wise - Date range chart
- GET /api/dashboard/month-wise - Month wise data

### Reports
- GET /api/reports/district - District-wise report
- GET /api/reports/mode-receipt - Mode of receipt
- GET /api/reports/nature-incident - Nature of incident
- GET /api/reports/type-against - Type against
- GET /api/reports/status - Status report
- GET /api/reports/branch-wise - Branch-wise
- GET /api/reports/highlights - Highlights
- GET /api/reports/date-wise - Date-wise report (supports fromDate/toDate query params)
- GET /api/reports/action-taken - Action taken by PHQ

### Pending
- GET /api/pending/all - All pending
- GET /api/pending/15-30-days - 15-30 days pending
- GET /api/pending/30-60-days - 30-60 days pending
- GET /api/pending/over-60-days - Over 60 days pending
- GET /api/pending/branches - List all branches
- GET /api/pending/branch/:branch - Pending by specific branch
- GET /api/pending/branch/:branch/15-30-days - Branch pending 15-30 days
- GET /api/pending/branch/:branch/30-60-days - Branch pending 30-60 days
- GET /api/pending/branch/:branch/over-60-days - Branch pending over 60 days

### Reference Data
- GET /api/districts - List districts
- GET /api/branches - List branches
- GET /api/reference/nature-crime - Nature of crime
- GET /api/reference/reception-mode - Reception modes
- GET /api/reference/status - Statuses

### Import/Export
- POST /api/import/complaints - Import complaints
- GET /api/export/complaints - Export complaints
- POST /api/import/cctns - Import CCTNS
- POST /api/import/women-safety - Import women safety

## Features

- Dashboard with summary cards and charts
- District-wise, duration-wise, date-wise charts
- Multiple report types
- Pending complaints tracking
- Excel import/export for complaints
- Women safety module
- CCTNS module
- JWT authentication
- Pagination and search

## License

This project is for educational purposes.