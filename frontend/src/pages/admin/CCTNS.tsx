import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { cctnsApi } from '@/services/api';

type Tab = 'enquiries' | 'synced';

// Helper: API expects DD/MM/YYYY natively, no conversion needed
function toApiDate(ddmmyyyy: string): string {
  return ddmmyyyy;
}

// Helper: today and 30 days ago in DD/MM/YYYY for the UI
function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface EnquiryRecord {
  complRegNum: string | null;
  officeIncharge: string | null;
  investigationStartDate: string | null;
  enquiryRemarks: string | null;
  actionTaken: string | null;
}

interface SyncedRecord {
  complRegNum: string;
  compCategory: string;
  accusedName: string;
  firNumber: string;
  incidentDate: string;
}

export const CCTNSPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('enquiries');

  // Date range state (DD/MM/YYYY for display)
  const [timeFrom, setTimeFrom] = useState(thirtyDaysAgoStr());
  const [timeTo, setTimeTo]     = useState(todayStr());

  // ── Enquiries live query (enabled only when on enquiries tab and user clicks Fetch) ──
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const enquiriesQuery = useQuery({
    queryKey: ['cctns-enquiries-live', timeFrom, timeTo, fetchTrigger],
    queryFn: () => cctnsApi.enquiriesLive(toApiDate(timeFrom), toApiDate(timeTo)),
    enabled: fetchTrigger > 0,
    retry: 1,
  });

  // ── Synced records from DB ──
  const syncedQuery = useQuery({
    queryKey: ['cctns-synced'],
    queryFn: () => cctnsApi.list(),
    enabled: activeTab === 'synced',
  });

  // ── Status ──
  const statusQuery = useQuery({
    queryKey: ['cctns-status'],
    queryFn: () => cctnsApi.status(),
  });

  // ── Sync Enquiries to DB mutation ──
  const syncEnquiryMutation = useMutation({
    mutationFn: () => cctnsApi.syncEnquiries(toApiDate(timeFrom), toApiDate(timeTo)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cctns-synced'] });
    },
  });

  const isConfigured = statusQuery.data?.data?.configured;

  // ── Enquiry table columns ──
  const enquiryCols: Column<any>[] = [
    {
      key: 'complRegNum',
      label: 'Complaint No.',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>
          {row.complRegNum || '—'}
        </span>
      ),
    },
    {
      key: 'officeIncharge',
      label: 'Officer Incharge',
      sortable: true,
      render: (row) => <span>{row.officeIncharge || '—'}</span>,
    },
    {
      key: 'investigationStartDate',
      label: 'Investigation Start',
      sortable: true,
      render: (row) => {
        if (!row.investigationStartDate) return <span>—</span>;
        const d = new Date(row.investigationStartDate);
        return <span>{isNaN(d.getTime()) ? row.investigationStartDate : d.toLocaleDateString('en-IN')}</span>;
      },
    },
    {
      key: 'actionTaken',
      label: 'Action Taken',
      sortable: true,
      render: (row) => (
        <span style={{
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          background: row.actionTaken ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
          color: row.actionTaken ? '#22c55e' : '#94a3b8',
        }}>
          {row.actionTaken || 'Pending'}
        </span>
      ),
    },
    {
      key: 'enquiryRemarks',
      label: 'Remarks',
      sortable: false,
      render: (row) => (
        <span title={row.enquiryRemarks || ''} style={{ maxWidth: 240, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.enquiryRemarks || '—'}
        </span>
      ),
    },
  ];

  // ── Synced table columns ──
  const syncedCols: Column<any>[] = [
    { key: 'complRegNum',  label: 'Reg. No.',    sortable: true },
    { key: 'compCategory', label: 'Category',    sortable: true },
    { key: 'accusedName',  label: 'Officer/Name', sortable: true },
    { key: 'firNumber',    label: 'FIR No.',      sortable: true },
    {
      key: 'incidentDate',
      label: 'Date',
      sortable: true,
      render: (row) => {
        if (!row.incidentDate) return <span>—</span>;
        const d = new Date(row.incidentDate);
        return <span>{isNaN(d.getTime()) ? row.incidentDate : d.toLocaleDateString('en-IN')}</span>;
      },
    },
  ];

  const enquiryData: EnquiryRecord[] = enquiriesQuery.data?.data?.records || [];
  const syncedData: SyncedRecord[] = (syncedQuery.data?.data || []).map((r: Record<string, unknown>) => ({
    complRegNum:  String(r.complRegNum || '—'),
    compCategory: String(r.compCategory || '—'),
    accusedName:  String(r.accusedName || '—'),
    firNumber:    String(r.firNumber || '—'),
    incidentDate: String(r.incidentDate || ''),
  }));

  return (
    <Layout>
      <div className="page-content">

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>CCTNS Integration</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Live enquiry data from Haryana Police CCTNS — Enquiry API
          </p>
        </div>

        {/* ── Date Range + Controls ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16, flexWrap: 'wrap', gap: 12,
          background: 'var(--card-bg)', borderRadius: 10, padding: '12px 16px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="form-label" style={{ marginBottom: 0, fontSize: 13, whiteSpace: 'nowrap' }}>From (DD/MM/YYYY):</label>
              <input
                type="text"
                value={timeFrom}
                onChange={e => setTimeFrom(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="form-input"
                style={{ width: 120 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="form-label" style={{ marginBottom: 0, fontSize: 13, whiteSpace: 'nowrap' }}>To:</label>
              <input
                type="text"
                value={timeTo}
                onChange={e => setTimeTo(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="form-input"
                style={{ width: 120 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              disabled={!isConfigured || enquiriesQuery.isFetching}
              onClick={() => { setActiveTab('enquiries'); setFetchTrigger(t => t + 1); }}
            >
              {enquiriesQuery.isFetching ? 'Fetching...' : 'Fetch Live Enquiries'}
            </Button>
            <Button
              variant="secondary"
              disabled={!isConfigured || syncEnquiryMutation.isPending}
              onClick={() => syncEnquiryMutation.mutate()}
            >
              {syncEnquiryMutation.isPending ? 'Saving...' : 'Sync to DB'}
            </Button>
          </div>
        </div>

        {/* ── Sync feedback ── */}
        {syncEnquiryMutation.data && (
          <div
            className={syncEnquiryMutation.data.success ? 'success-message' : 'error-message'}
            style={{ marginBottom: 12 }}
          >
            <strong>{syncEnquiryMutation.data.message || syncEnquiryMutation.data.error}</strong>
            {syncEnquiryMutation.data.data && (
              <span style={{ marginLeft: 8 }}>
                Fetched: {syncEnquiryMutation.data.data.fetched} &nbsp;|&nbsp;
                Created: {syncEnquiryMutation.data.data.created} &nbsp;|&nbsp;
                Updated: {syncEnquiryMutation.data.data.updated}
              </span>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['enquiries', 'synced'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 700 : 400,
                fontSize: 13,
                background: activeTab === tab ? 'var(--accent)' : 'var(--card-bg)',
                color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'enquiries' ? 'Live Enquiries' : 'Synced Records (DB)'}
              {tab === 'enquiries' && enquiryData.length > 0 && (
                <span style={{
                  marginLeft: 8, background: 'rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11,
                }}>
                  {enquiryData.length}
                </span>
              )}
              {tab === 'synced' && syncedData.length > 0 && (
                <span style={{
                  marginLeft: 8, background: 'rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11,
                }}>
                  {syncedData.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Not configured ── */}
        {!statusQuery.isLoading && !isConfigured && (
          <div className="empty-state">
            <p>CCTNS API not configured. Contact administrator.</p>
          </div>
        )}

        {/* ── Live Enquiries Tab ── */}
        {isConfigured && activeTab === 'enquiries' && (
          <>
            {fetchTrigger === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 15, marginBottom: 8 }}>Set a date range and click <strong>Fetch Live Enquiries</strong></p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Data is fetched directly from the CCTNS Enquiry API in real time.
                </p>
              </div>
            ) : enquiriesQuery.isFetching ? (
              <div className="loading-spinner">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : enquiriesQuery.isError ? (
              <div className="error-message">
                Failed to fetch: {String((enquiriesQuery.error as Error)?.message || 'Unknown error')}
              </div>
            ) : enquiryData.length === 0 ? (
              <div className="empty-state">
                <p>No enquiry records found for this date range.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                  Showing <strong>{enquiryData.length}</strong> live enquiry records from CCTNS &nbsp;•&nbsp;
                  {timeFrom} to {timeTo}
                </div>
                <DataTable
                  title="CCTNS Live Enquiry Records"
                  data={enquiryData as any}
                  columns={enquiryCols as any}
                  maxHeight="calc(100vh - 320px)"
                />
              </>
            )}
          </>
        )}

        {/* ── Synced Records Tab ── */}
        {isConfigured && activeTab === 'synced' && (
          <>
            {syncedQuery.isLoading ? (
              <div className="loading-spinner">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : syncedData.length === 0 ? (
              <div className="empty-state">
                <p>No records in local DB. Use <strong>Sync to DB</strong> to save enquiry records.</p>
              </div>
            ) : (
              <DataTable
                title="CCTNS Synced Records (Local DB)"
                data={syncedData}
                columns={syncedCols}
                maxHeight="calc(100vh - 320px)"
              />
            )}
          </>
        )}

      </div>
    </Layout>
  );
};

export default CCTNSPage;