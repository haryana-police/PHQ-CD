import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getStackedBarOptions } from '@/components/charts/Charts';
import { DataTable, Column } from '@/components/data/DataTable';

const StatCard = ({ label, value, subValue, colorClass }: { label: string; value: string | number; subValue?: string; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value}</div>
    {subValue && <div className="text-xs mt-1 opacity-80">{subValue}</div>}
  </div>
);

export const DistrictDetail = () => {
  const { district } = useParams<{ district: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['district-analysis', district],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/district-analysis/${district}`, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      return r.json();
    },
    enabled: !!district
  });

  const policeStations = data?.data?.policeStations || [];
  const categories = data?.data?.categories || [];
  
  // Aggregates
  const totalReceived = policeStations.reduce((sum: number, ps: any) => sum + ps.total, 0);
  const totalPending = policeStations.reduce((sum: number, ps: any) => sum + ps.pending, 0);
  const totalDisposed = policeStations.reduce((sum: number, ps: any) => sum + ps.disposed, 0);
  const totalDisposedDays = policeStations.reduce((sum: number, ps: any) => sum + (ps.avgDisposalDays * ps.disposed), 0);
  const avgDisposalTime = totalDisposed > 0 ? Math.round(totalDisposedDays / totalDisposed) : 0;

  // ── Police Station Summary Table ──────────────────────────────────────────
  const psCols: Column<any>[] = [
    { key: 'ps', label: 'Police Station', sortable: true },
    { key: 'total', label: 'Total', sortable: true, align: 'center' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'center' },
    { key: 'u7', label: '< 7 Days', sortable: true, align: 'center' },
    { key: 'u15', label: '7 - 15 Days', sortable: true, align: 'center' },
    { key: 'u30', label: '15 - 30 Days', sortable: true, align: 'center' },
    { key: 'o30', label: '> 30 Days', sortable: true, align: 'center' },
    { key: 'avgDisposalDays', label: 'Avg Disposal', sortable: true, align: 'center' },
  ];

  const renderPsCell = (col: Column<any>, row: any) => {
    if (col.key === 'ps') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.ps}</span>;
    if (col.key === 'total') return <span style={{ color: '#60a5fa' }}>{row.total}</span>;
    if (col.key === 'disposed') return <span style={{ color: '#4ade80' }}>{row.disposed}</span>;
    if (col.key === 'u7') return <span style={{ color: 'var(--text-muted)' }}>{row.u7}</span>;
    if (col.key === 'u15') return <span style={{ color: '#eab308' }}>{row.u15}</span>;
    if (col.key === 'u30') return <span style={{ color: '#fb923c', fontWeight: 500 }}>{row.u30}</span>;
    if (col.key === 'o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.o30}</span>;
    if (col.key === 'avgDisposalDays') return <span style={{ color: '#c084fc' }}>{row.avgDisposalDays}d</span>;
    return row[col.key];
  };

  // ── Pendency Ageing Matrix (Days) ─────────────────────────────────────────
  const pendencyCols: Column<any>[] = [
    { key: 'ps', label: 'Police Station', sortable: true },
    { key: 'u7', label: '< 7 Days', sortable: true, align: 'center' },
    { key: 'u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'o30', label: '> 30 Days', sortable: true, align: 'center' },
  ];

  const renderPendencyDays = (col: Column<any>, row: any) => {
    if (col.key === 'ps') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.ps}</span>;
    if (col.key === 'u7') return <span style={{ color: 'var(--text-muted)' }}>{row.u7}</span>;
    if (col.key === 'u15') return <span style={{ color: '#eab308' }}>{row.u15}</span>;
    if (col.key === 'u30') return <span style={{ color: '#fb923c', fontWeight: 500 }}>{row.u30}</span>;
    if (col.key === 'o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.o30}</span>;
    return row[col.key];
  };

  // ── Pendency Ageing Matrix (%) ────────────────────────────────────────────
  const pendingWithPct = policeStations.map((row: any) => {
    const total = (row.u7 + row.u15 + row.u30 + row.o30) || 1;
    return { ...row, pct_u7: Math.round(row.u7 * 100 / total), pct_u15: Math.round(row.u15 * 100 / total), pct_u30: Math.round(row.u30 * 100 / total), pct_o30: Math.round(row.o30 * 100 / total) };
  });

  const pendencyPctCols: Column<any>[] = [
    { key: 'ps', label: 'Police Station', sortable: true },
    { key: 'pct_u7', label: '< 7 Days', sortable: true, align: 'center' },
    { key: 'pct_u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'pct_u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'pct_o30', label: '> 30 Days', sortable: true, align: 'center' },
  ];

  const renderPendencyPct = (col: Column<any>, row: any) => {
    if (col.key === 'ps') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.ps}</span>;
    if (col.key === 'pct_u7') return <span style={{ color: 'var(--text-muted)' }}>{row.pct_u7}%</span>;
    if (col.key === 'pct_u15') return <span style={{ color: '#eab308' }}>{row.pct_u15}%</span>;
    if (col.key === 'pct_u30') return <span style={{ color: '#fb923c', fontWeight: 500 }}>{row.pct_u30}%</span>;
    if (col.key === 'pct_o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.pct_o30}%</span>;
    return row[col.key];
  };

  // ── Disposal Time Matrix (Days) ───────────────────────────────────────────
  const disposalCols: Column<any>[] = [
    { key: 'ps', label: 'Police Station', sortable: true },
    { key: 'du7', label: '< 7 Days', sortable: true, align: 'center' },
    { key: 'du15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'du30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'do30', label: '> 30 Days', sortable: true, align: 'center' },
  ];

  const renderDisposalDays = (col: Column<any>, row: any) => {
    if (col.key === 'ps') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.ps}</span>;
    if (col.key === 'du7') return <span style={{ color: '#4ade80' }}>{row.du7}</span>;
    if (col.key === 'du15') return <span style={{ color: '#a3e635' }}>{row.du15}</span>;
    if (col.key === 'du30') return <span style={{ color: '#eab308' }}>{row.du30}</span>;
    if (col.key === 'do30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.do30}</span>;
    return row[col.key];
  };

  // ── Disposal Time Matrix (%) ──────────────────────────────────────────────
  const disposalWithPct = policeStations.map((row: any) => {
    const total = (row.du7 + row.du15 + row.du30 + row.do30) || 1;
    return { ...row, dpct_u7: Math.round(row.du7 * 100 / total), dpct_u15: Math.round(row.du15 * 100 / total), dpct_u30: Math.round(row.du30 * 100 / total), dpct_o30: Math.round(row.do30 * 100 / total) };
  });

  const disposalPctCols: Column<any>[] = [
    { key: 'ps', label: 'Police Station', sortable: true },
    { key: 'dpct_u7', label: '< 7 Days', sortable: true, align: 'center' },
    { key: 'dpct_u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'dpct_u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'dpct_o30', label: '> 30 Days', sortable: true, align: 'center' },
  ];

  const renderDisposalPct = (col: Column<any>, row: any) => {
    if (col.key === 'ps') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.ps}</span>;
    if (col.key === 'dpct_u7') return <span style={{ color: '#4ade80' }}>{row.dpct_u7}%</span>;
    if (col.key === 'dpct_u15') return <span style={{ color: '#a3e635' }}>{row.dpct_u15}%</span>;
    if (col.key === 'dpct_u30') return <span style={{ color: '#eab308' }}>{row.dpct_u30}%</span>;
    if (col.key === 'dpct_o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.dpct_o30}%</span>;
    return row[col.key];
  };

  const matrixCardStyle = { backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' as const };

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                border: '1px solid #475569',
                borderRadius: '999px',
                color: '#cbd5e1',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
                (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #334155 0%, #1e293b 100%)';
                (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#475569';
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-slate-100">{district} District Analysis</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="btn-primary" 
              onClick={() => {
                const wb = XLSX.utils.book_new();
                
                // Sheet 1: Executive Summary
                const execSummary = [{
                  'Metric': 'District', 'Value': district
                }, {
                  'Metric': 'Total Received', 'Value': totalReceived
                }, {
                  'Metric': 'Total Disposed', 'Value': totalDisposed
                }, {
                  'Metric': 'Total Pending', 'Value': totalPending
                }, {
                  'Metric': 'Clearance Rate', 'Value': `${Math.round((totalDisposed / (totalReceived || 1)) * 100)}%`
                }, {
                  'Metric': 'Avg. Disposal Time (Days)', 'Value': avgDisposalTime
                }];
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(execSummary), 'Overview');

                // Sheet 2: Police Station Summary
                const psSummary = policeStations.map((ps: any) => ({
                  'Police Station': ps.ps,
                  'Total': ps.total,
                  'Disposed': ps.disposed,
                  'Pending': ps.pending,
                  '< 7 Days (Pending)': ps.u7,
                  '7 - 15 Days (Pending)': ps.u15,
                  '15 - 30 Days (Pending)': ps.u30,
                  '> 30 Days (Pending)': ps.o30,
                  'Avg Disposal (Days)': ps.avgDisposalDays
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(psSummary), 'PS Summary');

                // Sheet 3: Category Breakdown
                const catSummary = categories.map((cat: any) => ({
                  'Category': cat.category,
                  'Total': cat.total,
                  'Disposed': cat.disposed,
                  'Pending': cat.pending
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catSummary), 'Category Breakdown');

                // Sheet 4: Disposal Time Matrix
                const psDisposal = policeStations.map((ps: any) => ({
                  'Police Station': ps.ps,
                  '< 7 Days (Disposed)': ps.du7,
                  '7 - 15 Days (Disposed)': ps.du15,
                  '15 - 30 Days (Disposed)': ps.du30,
                  '> 30 Days (Disposed)': ps.do30
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(psDisposal), 'Disposal Matrix');
                
                // Write as binary array and download via Blob to avoid corruption
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${district}_District_Analysis.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              style={{ width: 'auto', margin: 0, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', borderColor: '#059669' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Export Excel
            </button>
            <button 
              className="btn-primary" 
              onClick={() => window.print()}
              style={{ width: 'auto', margin: 0, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Total Received" value={totalReceived.toLocaleString()} colorClass="blue" />
              <StatCard label="Total Disposed" value={totalDisposed.toLocaleString()} subValue={`${Math.round((totalDisposed / (totalReceived || 1)) * 100)}% Clearance`} colorClass="green" />
              <StatCard label="Total Pending" value={totalPending.toLocaleString()} colorClass="red" />
              <StatCard label="Avg. Disposal Time" value={`${avgDisposalTime} Days`} colorClass="purple" />
            </div>

            {/* PS Summary + Category Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 className="text-lg font-bold text-slate-100 mb-4">Police Station Breakdown &amp; Ageing</h2>
                <div style={{ flex: 1, position: 'relative' }}>
                  <DataTable
                    title="Police Station Breakdown & Ageing"
                    data={policeStations.sort((a: any, b: any) => b.o30 - a.o30 || b.pending - a.pending)}
                    columns={psCols.map(c => ({ ...c, render: (row) => renderPsCell(c, row) }))}
                    maxHeight="400px"
                  />
                </div>
              </div>
              <div className="lg:col-span-1">
                <ChartCard
                  title="Complaints by Category"
                  option={getStackedBarOptions(categories.slice(0, 10))}
                  height="450px"
                />
              </div>
            </div>

            {/* Pendency Ageing Matrices */}
            <div className="dashboard-matrices-grid">
              <div style={matrixCardStyle}>
                <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (Total)</h2>
                <DataTable
                  title="Pendency Ageing Matrix (Total)"
                  data={policeStations}
                  columns={pendencyCols.map(c => ({ ...c, render: (row) => renderPendencyDays(c, row) }))}
                  maxHeight="350px"
                />
              </div>
              <div style={matrixCardStyle}>
                <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (%)</h2>
                <DataTable
                  title="Pendency Ageing Matrix (%)"
                  data={pendingWithPct}
                  columns={pendencyPctCols.map(c => ({ ...c, render: (row) => renderPendencyPct(c, row) }))}
                  maxHeight="350px"
                />
              </div>
            </div>

            {/* Disposal Time Matrices */}
            <div className="dashboard-matrices-grid">
              <div style={matrixCardStyle}>
                <h2 className="text-lg font-bold text-slate-100 mb-4">Disposal Time Matrix (Total)</h2>
                <DataTable
                  title="Disposal Time Matrix (Total)"
                  data={policeStations}
                  columns={disposalCols.map(c => ({ ...c, render: (row) => renderDisposalDays(c, row) }))}
                  maxHeight="350px"
                />
              </div>
              <div style={matrixCardStyle}>
                <h2 className="text-lg font-bold text-slate-100 mb-4">Disposal Time Matrix (%)</h2>
                <DataTable
                  title="Disposal Time Matrix (%)"
                  data={disposalWithPct}
                  columns={disposalPctCols.map(c => ({ ...c, render: (row) => renderDisposalPct(c, row) }))}
                  maxHeight="350px"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default DistrictDetail;
