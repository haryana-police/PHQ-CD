import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DataTable, Column } from '@/components/data/DataTable';
import { MultiSelectFilter } from '@/components/common/MultiSelectFilter';

const tabs = [
  { id: 'all', label: 'All Pending' },
  { id: '15-30', label: '15-30 Days' },
  { id: '30-60', label: '30-60 Days' },
  { id: 'over-60', label: 'Over 60 Days' },
  { id: 'branch', label: 'By District' },
];

const ep: Record<string, string> = {
  all: '/api/pending/all',
  '15-30': '/api/pending/15-30-days',
  '30-60': '/api/pending/30-60-days',
  'over-60': '/api/pending/over-60-days',
};

export const PendingPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'all';
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Fetch distinct filter options from server (once)
  const { data: filterOpts } = useQuery({
    queryKey: ['pending-filter-options'],
    queryFn: async () => {
      const r = await fetch('/api/pending/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });

  const districtOptions = (filterOpts?.data?.districts ?? []).map((v: string) => ({ value: v, label: v }));
  const sourceOptions = (filterOpts?.data?.sources ?? []).map((v: string) => ({ value: v, label: v }));
  const complaintTypeOptions = (filterOpts?.data?.types ?? []).map((v: string) => ({ value: v, label: v }));

  // ── Build query string with all active filters
  const buildParams = () => {
    const params = new URLSearchParams();
    if (districtFilter.length > 0) params.set('district', districtFilter.join(','));
    if (sourceFilter.length > 0) params.set('source', sourceFilter.join(','));
    if (complaintTypeFilter.length > 0) params.set('complaintType', complaintTypeFilter.join(','));
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params.toString();
  };

  const endpoint = ep[type] || ep.all;

  const { data, isLoading } = useQuery({
    queryKey: ['pending', type, districtFilter, sourceFilter, complaintTypeFilter, fromDate, toDate],
    queryFn: async () => {
      const qs = buildParams();
      const url = qs ? `${endpoint}?${qs}` : endpoint;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const rows = (data?.data?.rows ?? data?.data ?? []) as Record<string, unknown>[];

  const tableData = rows.map(r => ({
    regNum: r.complRegNum || '-',
    district: r.addressDistrict || '-',
    name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || '-',
    mobile: r.mobile || '-',
    date: r.complRegDt ? new Date(String(r.complRegDt)).toLocaleDateString() : '-',
    status: r.statusOfComplaint || 'Pending',
    source: r.complaintSource || 'General Complaints',
    complaintType: r.typeOfComplaint || r.incidentType || 'Other',
  }));

  // All filtering is server-side
  const filteredTableData = tableData;
  const isFiltered = districtFilter.length > 0 || sourceFilter.length > 0 || complaintTypeFilter.length > 0 || statusFilter.length > 0 || !!fromDate || !!toDate;

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum', label: 'Reg. No.', sortable: true },
    { key: 'district', label: 'District', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'date', label: 'Reg. Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
  ];

  return (
    <Layout>
      <div className="page-content">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Pending Complaints</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>Track overdue complaints by duration</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: 'rgba(19,32,53,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          backdropFilter: 'blur(12px)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end',
          position: 'relative', zIndex: 1000
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {tabs.map(t => (
              <Link
                key={t.id}
                to={`?type=${t.id}`}
                style={{
                  padding: '7px 16px', borderRadius: '8px', fontSize: '12.5px',
                  fontWeight: type === t.id ? 600 : 400, textDecoration: 'none',
                  color: type === t.id ? '#a5b4fc' : '#64748b',
                  background: type === t.id ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.12))' : 'rgba(255,255,255,0.03)',
                  border: type === t.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.18s',
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
            {/* Date Range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#64748b' }}>
                Date Range
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.9)', 
                    color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12.5px',
                    outline: 'none', cursor: 'pointer'
                  }} 
                />
                <span style={{ color: '#475569' }}>-</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.9)', 
                    color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12.5px',
                    outline: 'none', cursor: 'pointer'
                  }} 
                />
              </div>
            </div>

            <MultiSelectFilter
              label="Source"
              options={sourceOptions}
              selected={sourceFilter}
              onChange={setSourceFilter}
              placeholder="All Sources"
              minWidth="160px"
            />

            <MultiSelectFilter
              label="District"
              options={districtOptions}
              selected={districtFilter}
              onChange={setDistrictFilter}
              placeholder="All Districts"
              minWidth="160px"
            />

            <MultiSelectFilter
              label="Complaint Type"
              options={complaintTypeOptions}
              selected={complaintTypeFilter}
              onChange={setComplaintTypeFilter}
              placeholder="All Types"
              minWidth="160px"
            />

            {isFiltered && (
              <button
                onClick={() => { setDistrictFilter([]); setSourceFilter([]); setComplaintTypeFilter([]); setStatusFilter([]); setFromDate(''); setToDate(''); }}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', alignSelf: 'flex-end', marginBottom: '2px' }}
              >
                ✕ Clear All
              </button>
            )}
          </div>
        </div>
        {/* Data Table */}
        <DataTable
          title={`${tabs.find(t => t.id === type)?.label} · ${filteredTableData.length} records${isFiltered ? ' (filtered)' : ''}`}
          data={filteredTableData}
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
          maxHeight="calc(100vh - 260px)"
        />
      </div>
    </Layout>
  );
};

export default PendingPage;
