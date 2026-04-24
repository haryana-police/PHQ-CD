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
  { id: 'branch', label: 'By Branch' },
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

  const rows = (data?.data || []) as Record<string, unknown>[];
  const total = rows.length;

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
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="tab-list" style={{ marginBottom: 0 }}>
            {tabs.map(t => (
              <Link key={t.id} to={`?type=${t.id}`} className={`tab-item ${type === t.id ? 'active' : ''}`}>{t.label}</Link>
            ))}
          </div>
          <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>{total} records</span>
        </div>

        {type === 'branch' && (
          <div style={{ marginBottom: '16px' }}>
            <select
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="form-select"
              style={{ minWidth: '200px', width: 'auto' }}
            >
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No pending complaints</p></div>
        ) : (
          <DataTable
            title="Pending Complaints"
            data={tableData}
            columns={cols.map(c => ({
              ...c,
              render: (row) => {
                if (c.key === 'regNum') return <span style={{ fontWeight: 500 }}>{String(row.regNum)}</span>;
                if (c.key === 'status') return <span className="status-badge pending">Pending</span>;
                return String(row[c.key as keyof typeof row] ?? '-');
              },
            }))}
            maxHeight="calc(100vh - 160px)"
          />
        )}
      </div>
    </Layout>
  );
};

export default PendingPage;