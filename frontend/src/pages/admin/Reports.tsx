import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getPieOptions, getStackedBarOptions, getDistrictBarOptions } from '@/components/charts/Charts';
import { Button } from '@/components/common/Button';

const tabs = [
  { id: 'district', label: 'District' },
  { id: 'mode-receipt', label: 'Receipt Mode' },
  { id: 'complaint-source', label: 'Complaint Source' },
  { id: 'nature-incident', label: 'Incident Type' },
  { id: 'type-complaint', label: 'Type of Complaint' },
  { id: 'type-against', label: 'Type Against' },
  { id: 'status', label: 'Status' },
  { id: 'branch-wise', label: 'Branch' },
  { id: 'date-wise', label: 'Date Wise' },
  { id: 'action-taken', label: 'Action Taken' },
];

export const ReportsPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'district';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', type, fromDate, toDate],
    queryFn: async () => {
      const url = type === 'date-wise' && fromDate && toDate
        ? `/api/reports/${type}?fromDate=${fromDate}&toDate=${toDate}`
        : `/api/reports/${type === 'mode-receipt' ? 'mode-receipt' : type}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const rows = data?.data || [];
  const total = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.total || r.count || 0), 0);
  const pend = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.pending || 0), 0);
  const disp = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.disposed || 0), 0);

  const tableData = rows.map((r: Record<string, unknown>, i: number) => {
    const tot = Number(r.total || r.count || 0);
    const p = Number(r.pending || 0);
    const d = Number(r.disposed || 0);
    return {
      name: String(r.district || r.branch || r.mode || r.status || r.natureOfIncident || r.typeAgainst || r.actionTaken || r.complaintSource || r.typeOfComplaint || `Item ${i + 1}`),
      total: tot,
      pending: p,
      disposed: d,
      pendPct: tot > 0 ? Math.round((p / tot) * 100) + '%' : '0%',
      dispPct: tot > 0 ? Math.round((d / tot) * 100) + '%' : '0%',
    };
  });

  const columns: Column<typeof tableData[0]>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
    { key: 'pending', label: 'Pending', sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'right' },
    { key: 'pendPct', label: 'Pending %', sortable: true, align: 'center' },
    { key: 'dispPct', label: 'Disposed %', sortable: true, align: 'center' },
  ];

  const chartOption = (() => {
    if (type === 'district' || type === 'branch-wise' || type === 'date-wise') return getDistrictBarOptions(rows);
    if (type === 'mode-receipt' || type === 'status') return getPieOptions(rows.map((d: Record<string, unknown>) => ({ name: String(d.mode || d.status || ''), value: Number(d.count || 0) })));
    return getStackedBarOptions(rows.map((d: Record<string, unknown>) => ({ category: String(d.natureOfIncident || d.typeAgainst || d.actionTaken || d.complaintSource || d.typeOfComplaint || ''), total: Number(d.total || 0), pending: Number(d.pending || 0), disposed: Number(d.disposed || 0) })));
  })();

  return (
    <Layout>
      <div className="page-content">
        <div className="tab-list">
          {tabs.map(t => (
            <Link key={t.id} to={`?type=${t.id}`} className={`tab-item ${type === t.id ? 'active' : ''}`}>{t.label}</Link>
          ))}
        </div>

        {type === 'date-wise' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="form-input"
              style={{ width: 'auto' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="form-input"
              style={{ width: 'auto' }}
            />
            <Button
              onClick={() => refetch()}
              disabled={!fromDate || !toDate}
            >
              Apply
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-value">{total.toLocaleString()}</span>
                <span className="summary-label">Total</span>
              </div>
              <div className="summary-item pending">
                <span className="summary-value">{pend.toLocaleString()}</span>
                <span className="summary-label">Pending {total > 0 ? `(${(pend / total * 100).toFixed(1)}%)` : ''}</span>
              </div>
              <div className="summary-item disposed">
                <span className="summary-value">{disp.toLocaleString()}</span>
                <span className="summary-label">Disposed {total > 0 ? `(${(disp / total * 100).toFixed(1)}%)` : ''}</span>
              </div>
              <div className="summary-item">
                <span className="summary-value">{rows.length}</span>
                <span className="summary-label">Categories</span>
              </div>
            </div>

            <ChartCard
              title={tabs.find(t => t.id === type)?.label || 'Report'}
              option={chartOption}
              height="280px"
            />

            <DataTable
              title={tabs.find(t => t.id === type)?.label || 'Report'}
              data={tableData}
              columns={columns.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'name') return <span style={{ fontWeight: 500 }}>{String(row.name)}</span>;
                  if (c.key === 'total') return <span style={{ fontWeight: 600 }}>{row.total}</span>;
                  if (c.key === 'pending') return <span style={{ color: '#fbbf24' }}>{row.pending}</span>;
                  if (c.key === 'disposed') return <span style={{ color: '#34d399' }}>{row.disposed}</span>;
                  if (c.key === 'pendPct') return <span style={{ color: '#fbbf24' }}>{String(row.pendPct)}</span>;
                  if (c.key === 'dispPct') return <span style={{ color: '#34d399' }}>{String(row.dispPct)}</span>;
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 440px)"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;