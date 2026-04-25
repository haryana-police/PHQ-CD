import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DataTable, Column } from '@/components/data/DataTable';

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

const StyledSelect = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        appearance: 'none', padding: '7px 32px 7px 12px', borderRadius: '8px',
        background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', outline: 'none',
        backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', minWidth: '160px',
      }}
    >
      {children}
    </select>
    <svg style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#64748b' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
  </div>
);

export const PendingPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'all';
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);

  const { data: branchesData } = useQuery({
    queryKey: ['pending', 'branches'],
    queryFn: async () => {
      const r = await fetch('/api/pending/branches', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
    enabled: type === 'branch',
  });

  useEffect(() => {
    if (branchesData?.data) {
      setBranches(branchesData.data);
    }
  }, [branchesData]);

  const getEndpoint = () => {
    if (type === 'branch' && branch) {
      return `/api/pending/branch/${encodeURIComponent(branch)}`;
    }
    return ep[type] || ep.all;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['pending', type, branch],
    queryFn: async () => {
      const r = await fetch(getEndpoint(), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
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
    status: 'Pending',
  }));

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
          backdropFilter: 'blur(12px)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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

          {type === 'branch' && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
              <StyledSelect value={branch} onChange={setBranch}>
                <option value="">Select District…</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </StyledSelect>
            </>
          )}
        </div>

        {/* Data Table */}
        <DataTable
          title={`${tabs.find(t => t.id === type)?.label} Records`}
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
          maxHeight="calc(100vh - 260px)"
        />
      </div>
    </Layout>
  );
};

export default PendingPage;