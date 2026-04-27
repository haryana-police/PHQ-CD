import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { cctnsApi } from '@/services/api';

interface SyncedRecord extends Record<string, unknown> {
  complRegNum: string;
  compCategory: string;
  accusedName: string;
  firNumber: string;
  incidentDate: string;
}

export const CCTNSPage = () => {
  const recordsQuery = useQuery({
    queryKey: ['cctns-synced'],
    queryFn: () => cctnsApi.list(),
    staleTime: 2 * 60 * 1000,
  });

  const statusQuery = useQuery({
    queryKey: ['cctns-status'],
    queryFn: () => cctnsApi.status(),
    staleTime: 5 * 60 * 1000,
  });

  const columns: Column<SyncedRecord>[] = [
    { key: 'complRegNum', label: 'Reg. No.', sortable: true },
    { key: 'compCategory', label: 'Category', sortable: true },
    { key: 'accusedName', label: 'Officer/Name', sortable: true },
    { key: 'firNumber', label: 'FIR No.', sortable: true },
    {
      key: 'incidentDate',
      label: 'Date',
      sortable: true,
      render: (row) => {
        if (!row.incidentDate) return <span>-</span>;
        const d = new Date(row.incidentDate);
        return <span>{isNaN(d.getTime()) ? row.incidentDate : d.toLocaleDateString('en-IN')}</span>;
      },
    },
  ];

  const records: SyncedRecord[] = (recordsQuery.data?.data || []).map((r: Record<string, unknown>) => ({
    complRegNum: String(r.complRegNum || '-'),
    compCategory: String(r.compCategory || '-'),
    accusedName: String(r.accusedName || '-'),
    firNumber: String(r.firNumber || '-'),
    incidentDate: String(r.incidentDate || ''),
  }));

  const isConfigured = statusQuery.data?.data?.configured;

  return (
    <Layout>
      <div className="page-content">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>CCTNS Integration</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Synced CCTNS records from the local database
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
            background: 'var(--card-bg)',
            borderRadius: 8,
            padding: '12px 16px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Showing {records.length} cached DB records
            {!statusQuery.isLoading && isConfigured === false ? ' - background CCTNS sync is not configured' : ''}
          </div>
          <Button
            variant="secondary"
            disabled={recordsQuery.isFetching}
            onClick={() => recordsQuery.refetch()}
            style={{ width: 'auto' }}
          >
            {recordsQuery.isFetching ? 'Refreshing...' : 'Refresh DB Data'}
          </Button>
        </div>

        {recordsQuery.isLoading ? (
          <div className="loading-spinner">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : recordsQuery.isError ? (
          <div className="error-message">
            Failed to load DB records: {String((recordsQuery.error as Error)?.message || 'Unknown error')}
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p>No CCTNS records have been synced to the local DB yet.</p>
          </div>
        ) : (
          <DataTable
            title="CCTNS Records (Local DB)"
            data={records}
            columns={columns}
            maxHeight="calc(100vh - 260px)"
          />
        )}
      </div>
    </Layout>
  );
};

export default CCTNSPage;
