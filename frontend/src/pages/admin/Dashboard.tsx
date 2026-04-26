import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { filters } = useFilters();
  
  // Clean empty filters before passing
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));

  const { data: summaryData, isLoading: sl } = useQuery({
    queryKey: ['dashboard', 'summary', activeFilters],
    queryFn: () => dashboardApi.summary(activeFilters),
  });

  const { data: districtData, isLoading: dl } = useQuery({
    queryKey: ['dashboard', 'district', activeFilters],
    queryFn: () => dashboardApi.districtWise(activeFilters),
  });

  const { data: durationData, isLoading: durl } = useQuery({
    queryKey: ['dashboard', 'duration', activeFilters],
    queryFn: () => dashboardApi.durationWise(activeFilters),
  });

  const { data: matrixData, isLoading: ml } = useQuery({
    queryKey: ['dashboard', 'matrix', activeFilters],
    queryFn: () => dashboardApi.ageingMatrix(activeFilters),
  });

  const { data: categoryData, isLoading: cl } = useQuery({
    queryKey: ['dashboard', 'category', activeFilters],
    queryFn: () => dashboardApi.categoryWise(activeFilters),
  });

  const s = summaryData?.data;
  const districts = districtData?.data || [];
  const durations = durationData?.data || [];
  const matrix = matrixData?.data || [];
  const categories = categoryData?.data || [];

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

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <h1 className="text-2xl font-bold text-slate-100">Executive Overview</h1>
          <button className="btn-primary" style={{ width: 'auto', margin: 0, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Report PDF
          </button>
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
            option={getDistrictBarOptions(districts.sort((a: any, b: any) => b.pending - a.pending).slice(0, 7))}
            fullOption={getDistrictBarOptions(districts)}
            height="320px"
          />
          <ChartCard
            title="Top Complaint Categories"
            option={getStackedBarOptions(categories.slice(0, 5))}
            fullOption={getStackedBarOptions(categories)}
            height="320px"
          />
        </div>

        <div className="dashboard-matrices-grid">
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (Days)</h2>
            {ml ? (
              <div className="text-slate-400">Loading matrix...</div>
            ) : (
              <div style={{ flex: 1, position: 'relative' }}>
                <DataTable
                  title="Pendency Ageing Matrix (Days)"
                  data={matrix}
                  columns={matrixCols.map(c => ({
                    ...c,
                    render: (row) => renderMatrixDays(c, row),
                  }))}
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(row.district)}`)}
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
                  onRowClick={(row) => navigate(`/admin/district/${encodeURIComponent(row.district)}`)}
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