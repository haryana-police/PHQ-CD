import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import { Select } from '@/components/common/Select';
import { MultiSelectFilter } from '@/components/common/MultiSelectFilter';
import * as XLSX from 'xlsx';

export const WomenSafetyPage = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [incidentFilter, setIncidentFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>(['Women Safety']);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const search = '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['women-safety', page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
      const r = await fetch(`/api/women-safety?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(fileData, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);
          
          const r = await fetch('/api/import/women-safety', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(json),
          });
          const result = await r.json();
          if (result?.success) {
            refetch();
          }
        } catch (err) {
          console.error('Import error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleExport = async () => {
    const r = await fetch('/api/export/women-safety', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'women_safety.xlsx'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const records = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  type WomenSafetyRow = { regNum: string; name: string; mobile: string; incidentType: string; date: string; status: string; id: unknown; };

  const tableData: WomenSafetyRow[] = records.map((r: Record<string, unknown>) => ({
    regNum: String(r.complRegNum || '-'),
    name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || '-',
    mobile: String(r.mobile || '-'),
    incidentType: String(r.incidentType || '-'),
    date: r.complRegDt ? new Date(String(r.complRegDt)).toLocaleDateString() : '-',
    status: String(r.statusOfComplaint || 'Pending'),
    id: r.id,
  }));

  const incidentOptions = useMemo(() => {
    const s = new Set(tableData.map((r: WomenSafetyRow) => r.incidentType).filter(Boolean));
    return Array.from(s).sort().map(v => ({ value: v, label: v }));
  }, [tableData]);

  const statusOptions = useMemo(() => {
    const s = new Set(tableData.map((r: WomenSafetyRow) => r.status).filter(Boolean));
    return Array.from(s).sort().map(v => ({ value: v, label: v }));
  }, [tableData]);

  const districtOptions = useMemo(() => {
    // Ideally from r.district if it existed in WomenSafetyRow, using mock or available
    return [];
  }, [tableData]);

  const sourceOptions = [
    { value: 'All Sources', label: 'All Sources' },
    { value: 'General Complaints', label: 'General Complaints' },
    { value: 'Women Safety', label: 'Women Safety' },
    { value: 'CCTNS / FIR', label: 'CCTNS / FIR' },
  ];

  const filteredData = useMemo(() => tableData.filter((r: WomenSafetyRow) => {
    const incOk = incidentFilter.length === 0 || incidentFilter.includes(r.incidentType);
    const statOk = statusFilter.length === 0 || statusFilter.includes(r.status);
    return incOk && statOk;
  }), [tableData, incidentFilter, statusFilter]);

  const cols: Column<typeof tableData[0]>[] = [
    { key: 'regNum', label: 'Reg. No.', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'incidentType', label: 'Incident Type', sortable: true },
    { key: 'date', label: 'Reg. Date', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'action', label: 'Action', width: '60px' },
  ];

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".xlsx,.xls" 
            style={{ display: 'none' }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button variant="secondary" onClick={handleExport}>Export</Button>
          <Link to="/admin/women-safety/add"><Button>Add</Button></Link>
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
            singleSelect={true}
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
            label="Incident Type"
            options={incidentOptions}
            selected={incidentFilter}
            onChange={setIncidentFilter}
            minWidth="160px"
          />

          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selected={statusFilter}
            onChange={setStatusFilter}
            minWidth="160px"
          />
          {(incidentFilter.length > 0 || statusFilter.length > 0 || districtFilter.length > 0 || sourceFilter.length > 0) && (
            <button
              onClick={() => { setIncidentFilter([]); setStatusFilter([]); setDistrictFilter([]); setSourceFilter([]); }}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
            >
              ✕ Clear All
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No records found</p></div>
        ) : (
          <>
            <DataTable
              title={`Women Safety Complaints${incidentFilter.length || statusFilter.length ? ` · Filtered (${filteredData.length})` : ''}`}
              data={filteredData}
              columns={cols.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'regNum') return <span style={{ fontWeight: 500 }}>{String(row.regNum)}</span>;
                  if (c.key === 'status') {
                    const d = String(row.status).toLowerCase().includes('disposed');
                    return <span className={`status-badge ${d ? 'disposed' : 'pending'}`}>{String(row.status)}</span>;
                  }
                  if (c.key === 'action') {
                    return <Link to={`/admin/women-safety/${row.id}`} style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 500 }}>View</Link>;
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

export default WomenSafetyPage;