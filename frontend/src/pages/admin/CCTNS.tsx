import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { Select } from '@/components/common/Select';
import { MultiSelectFilter } from '@/components/common/MultiSelectFilter';

export const CCTNSPage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [timeFrom, setTimeFrom] = useState(firstDay);
  const [timeTo, setTimeTo] = useState(today);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const search = '';

  // ── Filter state
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const handleFilterChange = (setter: (v: any) => void) => (v: any) => { setter(v); setPage(1); };

  // ── Fetch distinct filter options from server
  const { data: filterOpts } = useQuery({
    queryKey: ['cctns-filter-options'],
    queryFn: async () => {
      const r = await fetch('/api/cctns/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const districtOptions = (filterOpts?.data?.districts ?? []).map((v: string) => ({ value: v, label: v }));
  const categoryOptions = (filterOpts?.data?.categories ?? []).map((v: string) => ({ value: v, label: v }));

  // ── Build query params with all active filters
  const buildParams = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (districtFilter.length > 0) params.set('district', districtFilter.join(','));
    if (categoryFilter.length > 0) params.set('category', categoryFilter.join(','));
    return params;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['cctns', page, limit, search, fromDate, toDate, districtFilter, categoryFilter],
    queryFn: async () => {
      const r = await fetch(`/api/cctns?${buildParams()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
  });

  const statusQuery = useQuery({
    queryKey: ['cctns-status'],
    queryFn: async () => {
      const r = await fetch('/api/cctns/status', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (body: { timeFrom: string; timeTo: string }) => {
      const r = await fetch('/api/cctns/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cctns'] }); },
  });

  const syncEnquiryMutation = useMutation({
    mutationFn: async (body: { timeFrom: string; timeTo: string }) => {
      const r = await fetch('/api/cctns/sync-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cctns'] }); },
  });

  const records = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const tableData = records.map((r: any) => ({
    regNum: r.complRegNum || '-',
    psr: r.psrNumber || '-',
    fir: r.firNumber || '-',
    category: r.compCategory || '-',
    district: r.district?.name || '-',
    accused: r.accusedName || '-',
    victim: r.victimName || '-',
    firDate: r.firDate ? new Date(r.firDate).toLocaleDateString() : '-',
  }));

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum', label: 'Reg. No.', sortable: true },
    { key: 'fir', label: 'FIR No.', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'district', label: 'District', sortable: true },
    { key: 'accused', label: 'Accused', sortable: true },
    { key: 'victim', label: 'Victim', sortable: true },
    { key: 'firDate', label: 'FIR Date', sortable: true },
  ];

  const isConfigured = statusQuery.data?.data?.configured;
  const isSyncing = syncMutation.isPending || syncEnquiryMutation.isPending;
  const isFiltered = districtFilter.length > 0 || categoryFilter.length > 0 || !!fromDate || !!toDate;

  return (
    <Layout>
      <div className="page-content">
        {/* Header / Sync controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>CCTNS Records</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>Crime & Criminal Tracking Network & Systems sync</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label className="form-label" style={{ marginBottom: 0, fontSize: '12px' }}>Sync From:</label>
            <input
              type="date" value={timeFrom} onChange={e => setTimeFrom(e.target.value)}
              className="form-input" style={{ width: '140px', padding: '6px 10px', colorScheme: 'dark' }}
            />
            <label className="form-label" style={{ marginBottom: 0, fontSize: '12px' }}>To:</label>
            <input
              type="date" value={timeTo} onChange={e => setTimeTo(e.target.value)}
              className="form-input" style={{ width: '140px', padding: '6px 10px', colorScheme: 'dark' }}
            />
            <Button variant="primary" disabled={!isConfigured || isSyncing} onClick={() => {
              const diff = Math.ceil(Math.abs(new Date(timeTo).getTime() - new Date(timeFrom).getTime()) / 864e5);
              if (diff > 366) { alert('Please sync max 1 year at a time.'); return; }
              const [y1,m1,d1] = timeFrom.split('-'), [y2,m2,d2] = timeTo.split('-');
              syncMutation.mutate({ timeFrom: `${d1}/${m1}/${y1}`, timeTo: `${d2}/${m2}/${y2}` });
            }}>
              {isSyncing ? 'Syncing...' : 'Sync Complaints'}
            </Button>
            <Button variant="secondary" disabled={!isConfigured || isSyncing} onClick={() => {
              const diff = Math.ceil(Math.abs(new Date(timeTo).getTime() - new Date(timeFrom).getTime()) / 864e5);
              if (diff > 366) { alert('Please sync max 1 year at a time.'); return; }
              const [y1,m1,d1] = timeFrom.split('-'), [y2,m2,d2] = timeTo.split('-');
              syncEnquiryMutation.mutate({ timeFrom: `${d1}/${m1}/${y1}`, timeTo: `${d2}/${m2}/${y2}` });
            }}>
              {isSyncing ? 'Syncing...' : 'Sync Enquiries'}
            </Button>
            <input type="file" ref={fileInputRef} onChange={() => {}} accept=".xlsx,.xls" className="hidden" />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import</Button>
          </div>
        </div>

        {syncMutation.data && (
          <div className={syncMutation.data.success ? 'success-message' : 'error-message'} style={{ marginBottom: '12px' }}>
            <strong>{syncMutation.data.message || syncMutation.data.error}</strong>
            {syncMutation.data.data && (
              <span style={{ marginLeft: '8px' }}>
                Fetched: {syncMutation.data.data.fetched} | Created: {syncMutation.data.data.created} | Updated: {syncMutation.data.data.updated}
              </span>
            )}
          </div>
        )}

        {/* Filter Bar */}
        <div style={{
          background: 'rgba(19,32,53,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '14px',
          backdropFilter: 'blur(12px)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end',
          position: 'relative', zIndex: 1000,
        }}>
          {/* Date Range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#64748b' }}>Date Range</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12.5px', outline: 'none', cursor: 'pointer' }} />
              <span style={{ color: '#475569' }}>-</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12.5px', outline: 'none', cursor: 'pointer' }} />
            </div>
          </div>

          <MultiSelectFilter label="District" options={districtOptions} selected={districtFilter} onChange={handleFilterChange(setDistrictFilter)} placeholder="All Districts" minWidth="160px" />
          <MultiSelectFilter label="Category" options={categoryOptions} selected={categoryFilter} onChange={handleFilterChange(setCategoryFilter)} placeholder="All Categories" minWidth="160px" />

          {isFiltered && (
            <button
              onClick={() => { setDistrictFilter([]); setCategoryFilter([]); setFromDate(''); setToDate(''); setPage(1); }}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              ✕ Clear All
            </button>
          )}
        </div>

        {statusQuery.isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : !isConfigured ? (
          <div className="empty-state"><p>CCTNS API not configured. Contact administrator.</p></div>
        ) : isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No records found. Try syncing complaints first or adjust filters.</p></div>
        ) : (
          <>
            <DataTable
              title={`CCTNS Records · ${pagination?.total?.toLocaleString() ?? tableData.length} total${isFiltered ? ' (filtered)' : ''}`}
              data={tableData}
              columns={cols.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'regNum') return <span style={{ fontWeight: 500 }}>{String(row.regNum)}</span>;
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 280px)"
            />
            {pagination && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Page {pagination.page} of {pagination.totalPages || 1}</span>
                  <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>Next</Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Per page:</span>
                  <Select
                    value={limit}
                    onChange={(v) => { setLimit(Number(v)); setPage(1); }}
                    options={[{ value: 50, label: '50' }, { value: 100, label: '100' }, { value: 200, label: '200' }, { value: 500, label: '500' }]}
                    width="80px"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default CCTNSPage;