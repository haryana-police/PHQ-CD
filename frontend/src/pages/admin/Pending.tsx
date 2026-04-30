import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DataTable, Column } from '@/components/data/DataTable';
import { GlobalFilterBar } from '@/components/common/GlobalFilterBar';

const tabs = [
  { id: 'all',     label: 'All Pending' },
  { id: '15-30',   label: '15–30 Days' },
  { id: '30-60',   label: '30–60 Days' },
  { id: 'over-60', label: 'Over 60 Days' },
  { id: 'branch',  label: 'By District' },
];

const ep: Record<string, string> = {
  all:      '/api/pending/all',
  '15-30':  '/api/pending/15-30-days',
  '30-60':  '/api/pending/30-60-days',
  'over-60':'/api/pending/over-60-days',
};

export const PendingPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'all';

  const [districtFilter,      setDistrictFilter]      = useState<string[]>([]);
  const [sourceFilter,        setSourceFilter]        = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const buildParams = () => {
    const params = new URLSearchParams();
    if (districtFilter.length > 0)      params.set('district',      districtFilter.join(','));
    if (sourceFilter.length > 0)        params.set('source',        sourceFilter.join(','));
    if (complaintTypeFilter.length > 0) params.set('complaintType', complaintTypeFilter.join(','));
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate)   params.set('toDate',   toDate);
    return params.toString();
  };

  const endpoint = ep[type] || ep.all;

  const { data, isLoading } = useQuery({
    queryKey: ['pending', type, districtFilter, sourceFilter, complaintTypeFilter, fromDate, toDate],
    queryFn: async () => {
      const qs  = buildParams();
      const url = qs ? `${endpoint}?${qs}` : endpoint;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = (data?.data?.rows ?? data?.data ?? []) as Record<string, unknown>[];

  const tableData = rows.map(r => ({
    regNum:        r.complRegNum || '—',
    district:      r.addressDistrict || '—',
    name:          `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—',
    mobile:        r.mobile || '—',
    date:          r.complRegDt ? new Date(String(r.complRegDt)).toLocaleDateString() : '—',
    status:        r.statusOfComplaint || 'Pending',
    source:        r.complaintSource || '—',
    complaintType: r.typeOfComplaint || r.incidentType || '—',
  }));

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum',   label: 'Reg. No.',  sortable: true },
    { key: 'district', label: 'District',  sortable: true },
    { key: 'name',     label: 'Name',      sortable: true },
    { key: 'mobile',   label: 'Mobile',    sortable: true },
    { key: 'date',     label: 'Reg. Date', sortable: true },
    { key: 'status',   label: 'Status',    sortable: true, align: 'center' },
  ];

  return (
    <Layout>
      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Pending Complaints</h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>Track overdue complaints by duration</p>
          </div>

          {/* ── Duration Tabs (inline, compact) ────────────────── */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <Link
                key={t.id}
                to={`?type=${t.id}`}
                style={{
                  padding: '5px 13px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: type === t.id ? 600 : 400,
                  textDecoration: 'none',
                  color: type === t.id ? '#a5b4fc' : '#64748b',
                  background: type === t.id
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.12))'
                    : 'rgba(255,255,255,0.03)',
                  border: type === t.id
                    ? '1px solid rgba(99,102,241,0.5)'
                    : '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Unified Filter Bar ──────────────────────────────────── */}
        <GlobalFilterBar
          showDate
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}

          districtFilter={districtFilter}
          onDistrictChange={setDistrictFilter}

          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}

          complaintTypeFilter={complaintTypeFilter}
          onComplaintTypeChange={setComplaintTypeFilter}

          onClearAll={() => {
            setDistrictFilter([]);
            setSourceFilter([]);
            setComplaintTypeFilter([]);
            setFromDate('');
            setToDate('');
          }}
        />

        {/* ── Data Table ──────────────────────────────────────────── */}
        <DataTable
          title={`${tabs.find(t => t.id === type)?.label ?? 'Pending'} · ${tableData.length.toLocaleString()} records`}
          data={tableData}
          isLoading={isLoading}
          skeletonRows={8}
          columns={cols.map(c => ({
            ...c,
            render: (row) => {
              if (c.key === 'regNum') return <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{String(row.regNum)}</span>;
              if (c.key === 'status') return (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  Pending
                </span>
              );
              return String(row[c.key as keyof typeof row] ?? '—');
            },
          }))}
          maxHeight="calc(100vh - 240px)"
        />
      </div>
    </Layout>
  );
};

export default PendingPage;
