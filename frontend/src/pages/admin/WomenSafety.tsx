import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { DataTable, Column } from '@/components/data/DataTable';
import * as XLSX from 'xlsx';

export const WomenSafetyPage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['women-safety'],
    queryFn: async () => {
      const r = await fetch('/api/women-safety', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
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

  const records = (data?.data || []) as Record<string, unknown>[];

  const tableData = records.map(r => ({
    regNum: r.complRegNum || '-',
    name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || '-',
    mobile: r.mobile || '-',
    incidentType: r.incidentType || '-',
    date: r.complRegDt ? new Date(String(r.complRegDt)).toLocaleDateString() : '-',
    status: r.statusOfComplaint || 'Pending',
    id: r.id,
  }));

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

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : tableData.length === 0 ? (
          <div className="empty-state"><p>No records found</p></div>
        ) : (
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
                  return <Link to={`/admin/women-safety/${row.id}`} style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 500 }}>View</Link>;
                }
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

export default WomenSafetyPage;