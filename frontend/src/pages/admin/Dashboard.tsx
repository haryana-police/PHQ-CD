import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions, getStackedBarOptions } from '@/components/charts/Charts';
import { DataTable, Column } from '@/components/data/DataTable';
import { dashboardApi } from '@/services/api';
import { useFilters } from '@/contexts/FilterContext';

const StatCard = ({ label, value, subValue, colorClass }: { label: string; value: string | number; subValue?: string; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value}</div>
    {subValue && <div className="text-xs mt-1 opacity-80">{subValue}</div>}
  </div>
);

const SortDropdown = ({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: {label: string, value: string}[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button 
        onClick={() => setOpen(!open)}
        className="chart-expand-btn"
        title="Sort Options"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
          <line x1="10" y1="18" x2="14" y2="18"></line>
        </svg>
        Sort By
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          width: '200px',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          padding: '4px 0',
        }}>
          {options.map((opt: any) => (
            <div
              key={opt.value}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                color: value === opt.value ? '#60a5fa' : '#cbd5e1',
                fontWeight: value === opt.value ? 600 : 400,
                backgroundColor: value === opt.value ? 'rgba(51,65,85,0.5)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = '#334155'; }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { filters } = useFilters();
  
  // Clean empty filters before passing
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));

  const { data: summaryData, isLoading: sl } = useQuery({
    queryKey: ['dashboard', 'summary', activeFilters],
    queryFn: () => dashboardApi.summary(activeFilters),
  });

  const { data: districtData } = useQuery({
    queryKey: ['dashboard', 'district', activeFilters],
    queryFn: () => dashboardApi.districtWise(activeFilters),
  });

  const { data: durationData } = useQuery({
    queryKey: ['dashboard', 'duration', activeFilters],
    queryFn: () => dashboardApi.durationWise(activeFilters),
  });

  const { data: matrixData, isLoading: ml } = useQuery({
    queryKey: ['dashboard', 'matrix', activeFilters],
    queryFn: () => dashboardApi.ageingMatrix(activeFilters),
  });

  const { data: categoryData } = useQuery({
    queryKey: ['dashboard', 'category', activeFilters],
    queryFn: () => dashboardApi.categoryWise(activeFilters),
  });

  const { data: disposalMatrixData, isLoading: dml } = useQuery({
    queryKey: ['dashboard', 'disposal-matrix', activeFilters],
    queryFn: () => dashboardApi.disposalMatrix(activeFilters),
  });

  const s = summaryData?.data;
  const districts = districtData?.data || [];
  const durations = durationData?.data || [];
  const matrix = matrixData?.data || [];
  const categories = categoryData?.data || [];
  const disposalMatrix = disposalMatrixData?.data || [];

  const [districtSort, setDistrictSort] = useState<string>('pending_pct');
  const [categorySort, setCategorySort] = useState<string>('total');

  const stateTotal = s?.totalReceived || 1;

  const sortData = (data: any[], sortKey: string) => {
    return [...data].sort((a: any, b: any) => {
      let aVal = 0;
      let bVal = 0;
      switch (sortKey) {
        case 'total':
          aVal = a.total; bVal = b.total; break;
        case 'pending':
          aVal = a.pending; bVal = b.pending; break;
        case 'disposed':
          aVal = a.disposed; bVal = b.disposed; break;
        case 'total_pct_state':
          aVal = a.total / stateTotal; bVal = b.total / stateTotal; break;
        case 'pending_pct':
          aVal = a.total > 0 ? a.pending / a.total : 0; bVal = b.total > 0 ? b.pending / b.total : 0; break;
        case 'disposed_pct':
          aVal = a.total > 0 ? a.disposed / a.total : 0; bVal = b.total > 0 ? b.disposed / b.total : 0; break;
      }
      return bVal - aVal;
    });
  };

  const sortedDistricts = sortData(districts, districtSort);
  const sortedCategories = sortData(categories, categorySort);

  const matrixWithPct = matrix.map((row: any) => {
    const total = (row.u7 + row.u15 + row.u30 + row.o30) || 1;
    return {
      ...row,
      pct_u7: Math.round(row.u7 * 100 / total),
      pct_u15: Math.round(row.u15 * 100 / total),
      pct_u30: Math.round(row.u30 * 100 / total),
      pct_o30: Math.round(row.o30 * 100 / total),
    };
  });

  const matrixCols: Column<any>[] = [
    { key: 'district', label: 'District', sortable: true },
    { key: 'u7', label: '<7 Days', sortable: true, align: 'center' },
    { key: 'u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'o30', label: '>30 Days', sortable: true, align: 'center' },
  ];

  const renderMatrixDays = (col: any, row: any) => {
    if (col.key === 'district') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.district}</span>;
    if (col.key === 'u7') return <span style={{ color: 'var(--text-muted)' }}>{row.u7}</span>;
    if (col.key === 'u15') return <span style={{ color: '#eab308' }}>{row.u15}</span>;
    if (col.key === 'u30') return <span style={{ color: '#fb923c', fontWeight: 500 }}>{row.u30}</span>;
    if (col.key === 'o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.o30}</span>;
    return row[col.key];
  };

  const matrixPctCols: Column<any>[] = [
    { key: 'district', label: 'District', sortable: true },
    { key: 'pct_u7', label: '<7 Days', sortable: true, align: 'center' },
    { key: 'pct_u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'pct_u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'pct_o30', label: '>30 Days', sortable: true, align: 'center' },
  ];

  const renderMatrixPct = (col: any, row: any) => {
    if (col.key === 'district') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.district}</span>;
    if (col.key === 'pct_u7') return <span style={{ color: 'var(--text-muted)' }}>{row.pct_u7}%</span>;
    if (col.key === 'pct_u15') return <span style={{ color: '#eab308' }}>{row.pct_u15}%</span>;
    if (col.key === 'pct_u30') return <span style={{ color: '#fb923c', fontWeight: 500 }}>{row.pct_u30}%</span>;
    if (col.key === 'pct_o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.pct_o30}%</span>;
    return row[col.key];
  };

  // Disposal Time Matrix data
  const disposalMatrixWithPct = disposalMatrix.map((row: any) => {
    const total = (row.u7 + row.u15 + row.u30 + row.o30) || 1;
    return {
      ...row,
      pct_u7: Math.round(row.u7 * 100 / total),
      pct_u15: Math.round(row.u15 * 100 / total),
      pct_u30: Math.round(row.u30 * 100 / total),
      pct_o30: Math.round(row.o30 * 100 / total),
    };
  });

  const disposalCols: Column<any>[] = [
    { key: 'district', label: 'District', sortable: true },
    { key: 'u7', label: '<7 Days', sortable: true, align: 'center' },
    { key: 'u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'o30', label: '>30 Days', sortable: true, align: 'center' },
  ];

  const renderDisposalDays = (col: any, row: any) => {
    if (col.key === 'district') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.district}</span>;
    if (col.key === 'u7') return <span style={{ color: '#4ade80' }}>{row.u7}</span>;
    if (col.key === 'u15') return <span style={{ color: '#a3e635' }}>{row.u15}</span>;
    if (col.key === 'u30') return <span style={{ color: '#eab308' }}>{row.u30}</span>;
    if (col.key === 'o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.o30}</span>;
    return row[col.key];
  };

  const disposalPctCols: Column<any>[] = [
    { key: 'district', label: 'District', sortable: true },
    { key: 'pct_u7', label: '<7 Days', sortable: true, align: 'center' },
    { key: 'pct_u15', label: '7-15 Days', sortable: true, align: 'center' },
    { key: 'pct_u30', label: '15-30 Days', sortable: true, align: 'center' },
    { key: 'pct_o30', label: '>30 Days', sortable: true, align: 'center' },
  ];

  const renderDisposalPct = (col: any, row: any) => {
    if (col.key === 'district') return <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{row.district}</span>;
    if (col.key === 'pct_u7') return <span style={{ color: '#4ade80' }}>{row.pct_u7}%</span>;
    if (col.key === 'pct_u15') return <span style={{ color: '#a3e635' }}>{row.pct_u15}%</span>;
    if (col.key === 'pct_u30') return <span style={{ color: '#eab308' }}>{row.pct_u30}%</span>;
    if (col.key === 'pct_o30') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{row.pct_o30}%</span>;
    return row[col.key];
  };

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <h1 className="text-2xl font-bold text-slate-100">Executive Overview</h1>
          <div className="flex items-center gap-2">
            <button 
              className="btn-primary" 
              onClick={() => {
                const wb = XLSX.utils.book_new();
                
                // Sheet 1: Executive Summary
                const summaryDataSheet = [{
                  'Metric': 'Total Received', 'Value': s?.totalReceived || 0
                }, {
                  'Metric': 'Total Disposed', 'Value': s?.totalDisposed || 0
                }, {
                  'Metric': 'Total Pending', 'Value': s?.totalPending || 0
                }, {
                  'Metric': 'Clearance Rate', 'Value': `${Math.round(((s?.totalDisposed || 0) / (s?.totalReceived || 1)) * 100)}%`
                }, {
                  'Metric': 'Avg. Disposal Time (Days)', 'Value': s?.avgDisposalTime || 0
                }];
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryDataSheet), 'Summary');

                // Sheet 2: District Totals
                const districtSummary = districts.map((d: any) => ({
                  'District': d.district,
                  'Total': d.total,
                  'Disposed': d.disposed,
                  'Pending': d.pending
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(districtSummary), 'District Totals');

                // Sheet 3: Category Totals
                const categorySummary = categories.map((c: any) => ({
                  'Category': c.category,
                  'Total': c.total,
                  'Disposed': c.disposed,
                  'Pending': c.pending
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categorySummary), 'Category Totals');

                // Sheet 4: Monthly Trend
                const trendSummary = durations.map((d: any) => ({
                  'Month': d.duration || d.month,
                  'Total': d.total,
                  'Disposed': d.disposed,
                  'Pending': d.pending
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendSummary), 'Monthly Trend');

                // Sheet 5: Pendency Ageing Matrix
                const matrixSummary = matrix.map((d: any) => ({
                  'District': d.district,
                  '< 7 Days (Pending)': d.u7,
                  '7 - 15 Days (Pending)': d.u15,
                  '15 - 30 Days (Pending)': d.u30,
                  '> 30 Days (Pending)': d.o30
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrixSummary), 'Pendency Ageing Matrix');

                // Sheet 6: Disposal Time Matrix
                const dispMatrix = disposalMatrix.map((d: any) => ({
                  'District': d.district,
                  '< 7 Days (Disposed)': d.u7,
                  '7 - 15 Days (Disposed)': d.u15,
                  '15 - 30 Days (Disposed)': d.u30,
                  '> 30 Days (Disposed)': d.o30
                }));
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dispMatrix), 'Disposal Time Matrix');
                
                // Write as binary array and download via Blob to avoid corruption
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Statewide_Dashboard_Report.xlsx';
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

        {sl ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="stats-grid">
            <StatCard label="Total Received" value={(s?.totalReceived || 0).toLocaleString()} colorClass="blue" />
            <StatCard label="Total Disposed" value={(s?.totalDisposed || 0).toLocaleString()} subValue={`${Math.round(((s?.totalDisposed || 0) / (s?.totalReceived || 1)) * 100)}% Clearance Rate`} colorClass="green" />
            <StatCard label="Total Pending" value={(s?.totalPending || 0).toLocaleString()} colorClass="red" />
            <StatCard label="Avg. Disposal Time" value={`${s?.avgDisposalTime || 0} Days`} subValue="From Registration to Disposal" colorClass="purple" />
          </div>
        )}

        <div className="dashboard-charts-grid">
          <ChartCard
            title="State-wide Trend (Monthly)"
            option={getDurationLineOptions(durations)}
            fullOption={getDurationLineOptions(durations)}
            height="320px"
          />
          <ChartCard
            title="Top District Pendency"
            actions={
              <SortDropdown 
                value={districtSort}
                onChange={setDistrictSort}
                options={[
                  { value: 'total', label: 'Total Reg' },
                  { value: 'pending', label: 'Total Pending' },
                  { value: 'disposed', label: 'Total Disposed' },
                  { value: 'total_pct_state', label: 'Total % (from state total)' },
                  { value: 'pending_pct', label: 'Pending % (from district total)' },
                  { value: 'disposed_pct', label: 'Disposed % (from district total)' },
                ]}
              />
            }
            option={getDistrictBarOptions(sortedDistricts.slice(0, 7).reverse())}
            fullOption={getDistrictBarOptions([...sortedDistricts].reverse())}
            height="320px"
          />
          <ChartCard
            title="Top Complaint Categories"
            actions={
              <SortDropdown 
                value={categorySort}
                onChange={setCategorySort}
                options={[
                  { value: 'total', label: 'Total Reg' },
                  { value: 'pending', label: 'Total Pending' },
                  { value: 'disposed', label: 'Total Disposed' },
                  { value: 'total_pct_state', label: 'Total % (from state total)' },
                  { value: 'pending_pct', label: 'Pending % (from category total)' },
                  { value: 'disposed_pct', label: 'Disposed % (from category total)' },
                ]}
              />
            }
            option={getStackedBarOptions(sortedCategories.slice(0, 5).reverse())}
            fullOption={getStackedBarOptions([...sortedCategories].reverse())}
            height="320px"
          />
        </div>

        <div className="dashboard-matrices-grid">
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (Total)</h2>
            {ml ? (
              <div className="text-slate-400">Loading matrix...</div>
            ) : (
              <div style={{ flex: 1, position: 'relative' }}>
                <DataTable
                  title="Pendency Ageing Matrix (Total)"
                  data={matrix}
                  columns={matrixCols.map(c => ({
                    ...c,
                    render: (row) => renderMatrixDays(c, row),
                  }))}
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(String(row.district))}`)}
                  maxHeight="400px"
                />
              </div>
            )}
          </div>
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (%)</h2>
            {ml ? (
              <div className="text-slate-400">Loading matrix...</div>
            ) : (
              <div style={{ flex: 1, position: 'relative' }}>
                <DataTable
                  title="Pendency Ageing Matrix (%)"
                  data={matrixWithPct}
                  columns={matrixPctCols.map(c => ({
                    ...c,
                    render: (row) => renderMatrixPct(c, row),
                  }))}
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(String(row.district))}`)}
                  maxHeight="400px"
                />
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-matrices-grid">
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Disposal Time Matrix (Total)</h2>
            {dml ? (
              <div className="text-slate-400">Loading matrix...</div>
            ) : (
              <div style={{ flex: 1, position: 'relative' }}>
                <DataTable
                  title="Disposal Time Matrix (Total)"
                  data={disposalMatrix}
                  columns={disposalCols.map(c => ({
                    ...c,
                    render: (row) => renderDisposalDays(c, row),
                  }))}
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(String(row.district))}`)} 
                  maxHeight="400px"
                />
              </div>
            )}
          </div>
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Disposal Time Matrix (%)</h2>
            {dml ? (
              <div className="text-slate-400">Loading matrix...</div>
            ) : (
              <div style={{ flex: 1, position: 'relative' }}>
                <DataTable
                  title="Disposal Time Matrix (%)"
                  data={disposalMatrixWithPct}
                  columns={disposalPctCols.map(c => ({
                    ...c,
                    render: (row) => renderDisposalPct(c, row),
                  }))}
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(String(row.district))}`)} 
                  maxHeight="400px"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;