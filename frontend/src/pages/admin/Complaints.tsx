import { useQuery } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { Select } from '@/components/common/Select';
import { MultiSelectFilter } from '@/components/common/MultiSelectFilter';
import * as XLSX from 'xlsx';

export const ComplaintsPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch distinct filter options from server
  const { data: filterOpts } = useQuery({
    queryKey: ['complaints-filter-options'],
    queryFn: async () => {
      const r = await fetch('/api/complaints/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });

  const districtOptions = (filterOpts?.data?.districts ?? []).map((v: string) => ({ value: v, label: v }));
  const sourceOptions = (filterOpts?.data?.sources ?? []).map((v: string) => ({ value: v, label: v }));
  const complaintTypeOptions = (filterOpts?.data?.types ?? []).map((v: string) => ({ value: v, label: v }));
  const statusOptions = (filterOpts?.data?.statuses ?? []).map((v: string) => ({ value: v, label: v }));

  // ── Build API params including all active filters
  const buildParams = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (districtFilter.length > 0) params.set('district', districtFilter.join(','));
    if (sourceFilter.length > 0) params.set('source', sourceFilter.join(','));
    if (complaintTypeFilter.length > 0) params.set('complaintType', complaintTypeFilter.join(','));
    if (statusFilter.length > 0) params.set('status', statusFilter.join(','));
    return params;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints', page, limit, search, fromDate, toDate, districtFilter, sourceFilter, complaintTypeFilter, statusFilter],
    queryFn: async () => {
      const r = await fetch(`/api/complaints?${buildParams()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
  });

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void) => (v: any) => { setter(v); setPage(1); };

  const complaints = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const handleExport = async () => {
    const r = await fetch('/api/export/complaints', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'complaints.xlsx'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        await fetch('/api/import/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(data),
        });
        refetch();
        alert('Import successful!');
      } catch { alert('Import failed'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  type ComplaintRow = { regNum: string; district: string; name: string; mobile: string; rawDate: string; date: string; status: string; source: string; complaintType: string; id: unknown; };

  const tableData: ComplaintRow[] = complaints.map((c: Record<string, unknown>) => ({
    regNum: String(c.complRegNum || '-'),
    district: String((c.district as Record<string, unknown>)?.name || c.addressDistrict || '-'),
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || '-',
    mobile: String(c.mobile || '-'),
    rawDate: c.complRegDt ? String(c.complRegDt).slice(0, 10) : '',
    date: c.complRegDt ? new Date(String(c.complRegDt)).toLocaleDateString() : '-',
    status: String(c.statusOfComplaint || 'Pending'),
    source: String(c.complaintSource || 'General Complaints'),
    complaintType: String(c.typeOfComplaint || c.incidentType || 'Other'),
    id: c.id,
  }));

  // All filtering is done server-side — data returned is already the filtered set
  const filteredTableData = tableData;
  const isFiltered = districtFilter.length > 0 || sourceFilter.length > 0 || complaintTypeFilter.length > 0 || statusFilter.length > 0 || !!fromDate || !!toDate;

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum', label: 'Reg. No.', sortable: true },
    { key: 'district', label: 'District', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'date', label: 'Reg. Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'action', label: 'Action', width: '60px' },
  ];

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '280px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" className="hidden" />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import</Button>
            <Button variant="secondary" onClick={handleExport}>Export</Button>
            <Link to="/admin/complaints/add"><Button>Add</Button></Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: 'rgba(19,32,53,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '14px',
          backdropFilter: 'blur(12px)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end',
          position: 'relative', zIndex: 1000
        }}>
          {/* Date Range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#64748b' }}>
              Date Range
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1); }}
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
                onChange={e => { setToDate(e.target.value); setPage(1); }}
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
            onChange={handleFilterChange(setSourceFilter)}
            placeholder="All Sources"
            minWidth="160px"
          />

          <MultiSelectFilter
            label="District"
            options={districtOptions}
            selected={districtFilter}
            onChange={handleFilterChange(setDistrictFilter)}
            placeholder="All Districts"
            minWidth="160px"
          />

          <MultiSelectFilter
            label="Complaint Type"
            options={complaintTypeOptions}
            selected={complaintTypeFilter}
            onChange={handleFilterChange(setComplaintTypeFilter)}
            placeholder="All Types"
            minWidth="160px"
          />

          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selected={statusFilter}
            onChange={handleFilterChange(setStatusFilter)}
            placeholder="All Status"
            minWidth="160px"
          />
          {isFiltered && (
            <button
              onClick={() => { setDistrictFilter([]); setStatusFilter([]); setSourceFilter([]); setComplaintTypeFilter([]); setFromDate(''); setToDate(''); setPage(1); }}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
            >
              ✕ Clear All
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No complaints found</p></div>
        ) : (
          <>
            <DataTable
              title={`All Complaints${districtFilter.length || statusFilter.length ? ` · Filtered (${filteredTableData.length})` : ''}`}
              data={filteredTableData}
              columns={cols.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'regNum') return <span style={{ fontWeight: 500 }}>{String(row.regNum)}</span>;
                  if (c.key === 'status') {
                    const d = String(row.status).toLowerCase().includes('disposed');
                    return <span className={`status-badge ${d ? 'disposed' : 'pending'}`}>{String(row.status)}</span>;
                  }
                  if (c.key === 'action') {
                    return <Link to={`/admin/complaints/${row.id}`} style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 500 }}>View</Link>;
                  }
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 160px)"
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

export default ComplaintsPage;
