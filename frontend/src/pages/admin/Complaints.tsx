import { useQuery } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import * as XLSX from 'xlsx';

export const ComplaintsPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50', search });
      const r = await fetch(`/api/complaints?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

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

  const tableData = complaints.map((c: Record<string, unknown>) => ({
    regNum: c.complRegNum || '-',
    district: (c.district as Record<string, unknown>)?.name || c.addressDistrict || '-',
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    mobile: c.mobile || '-',
    date: c.complRegDt ? new Date(String(c.complRegDt)).toLocaleDateString() : '-',
    status: c.statusOfComplaint || 'Pending',
    id: c.id,
  }));

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          <input className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '280px' }} />
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" className="hidden" />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import</Button>
            <Button variant="secondary" onClick={handleExport}>Export</Button>
            <Link to="/admin/complaints/add"><Button>Add</Button></Link>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No complaints found</p></div>
        ) : (
          <>
            <DataTable
              data={tableData}
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
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', alignSelf: 'center' }}>{pagination.page} / {pagination.totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>Next</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default ComplaintsPage;