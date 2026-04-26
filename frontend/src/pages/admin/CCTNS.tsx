import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { Select } from '@/components/common/Select';

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

  const { data, isLoading } = useQuery({
    queryKey: ['cctns', page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
      const r = await fetch(`/api/cctns?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cctns'] });
    },
  });

  const syncEnquiryMutation = useMutation({
    mutationFn: async (body: { timeFrom: string; timeTo: string }) => {
      const r = await fetch('/api/cctns/sync-enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cctns'] });
    },
  });

  const records = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const tableData = records.map((r: any) => ({
    regNum: r.complRegNum || '-',
    psr: r.psrNumber || '-',
    fir: r.firNumber || '-',
    category: r.compCategory || '-',
    accused: r.accusedName || '-',
    victim: r.victimName || '-',
  }));

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum', label: 'Reg. No.', sortable: true },
    { key: 'psr', label: 'PSR No.', sortable: true },
    { key: 'fir', label: 'FIR No.', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'accused', label: 'Accused', sortable: true },
    { key: 'victim', label: 'Victim', sortable: true },
  ];

  const isConfigured = statusQuery.data?.data?.configured;
  const isSyncing = syncMutation.isPending || syncEnquiryMutation.isPending;

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>From:</label>
            <input
              type="date"
              value={timeFrom}
              onChange={e => setTimeFrom(e.target.value)}
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', colorScheme: 'dark' }}
            />
            <label className="form-label" style={{ marginBottom: 0 }}>To:</label>
            <input
              type="date"
              value={timeTo}
              onChange={e => setTimeTo(e.target.value)}
              className="form-input"
              style={{ width: '140px', padding: '6px 10px', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="primary"
              disabled={!isConfigured || isSyncing}
              onClick={() => {
                const dateFrom = new Date(timeFrom);
                const dateTo = new Date(timeTo);
                const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays > 366) {
                  alert("Please sync a maximum of 1 year (366 days) at a time. The state-wide API data is too massive to download more than a year in a single request.");
                  return;
                }
                const [y1, m1, d1] = timeFrom.split('-');
                const [y2, m2, d2] = timeTo.split('-');
                syncMutation.mutate({ timeFrom: `${d1}/${m1}/${y1}`, timeTo: `${d2}/${m2}/${y2}` });
              }}
            >
              {isSyncing ? 'Syncing...' : 'Sync Complaints'}
            </Button>
            <Button
              variant="secondary"
              disabled={!isConfigured || isSyncing}
              onClick={() => {
                const dateFrom = new Date(timeFrom);
                const dateTo = new Date(timeTo);
                const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays > 366) {
                  alert("Please sync a maximum of 1 year (366 days) at a time. The state-wide API data is too massive to download more than a year in a single request.");
                  return;
                }
                const [y1, m1, d1] = timeFrom.split('-');
                const [y2, m2, d2] = timeTo.split('-');
                syncEnquiryMutation.mutate({ timeFrom: `${d1}/${m1}/${y1}`, timeTo: `${d2}/${m2}/${y2}` });
              }}
            >
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
        {syncEnquiryMutation.data && !syncEnquiryMutation.data.success && (
          <div className="error-message" style={{ marginBottom: '12px' }}>
            <strong>{syncEnquiryMutation.data.message || syncEnquiryMutation.data.error}</strong>
          </div>
        )}

        {statusQuery.isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : !isConfigured ? (
          <div className="empty-state"><p>CCTNS API not configured. Contact administrator.</p></div>
        ) : isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No records found. Try syncing complaints first.</p></div>
        ) : (
          <>
            <DataTable
              title="CCTNS Synchronization Logs"
              data={tableData}
              columns={cols.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'regNum') return <span style={{ fontWeight: 500 }}>{String(row.regNum)}</span>;
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 220px)"
            />
            {pagination && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button variant="secondary" size="sm" onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Page {pagination.page} of {pagination.totalPages || 1}</span>
                  <Button variant="secondary" size="sm" onClick={() => setPage((p: number) => p + 1)} disabled={page >= pagination.totalPages}>Next</Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Per page:</span>
                  <Select
                    value={limit}
                    onChange={(v) => { setLimit(Number(v)); setPage(1); }}
                    options={[
                      { value: 50, label: '50' },
                      { value: 100, label: '100' },
                      { value: 200, label: '200' },
                      { value: 500, label: '500' },
                    ]}
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