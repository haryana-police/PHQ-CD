import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions } from '@/components/charts/Charts';
import { useDashboardSummary, useDistrictChart, useMonthWiseData } from '@/hooks/useData';

const StatCard = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value.toLocaleString()}</div>
  </div>
);

export const DashboardPage = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Summary is all-time (like old project — headline numbers)
  const { data: summaryData, isLoading: sl } = useDashboardSummary();

  // District bar chart — top 22 districts for selected year
  const { data: districtData, isLoading: dl } = useDistrictChart(selectedYear);

  // Month-wise line chart — correct endpoint for the trend line
  const { data: monthData, isLoading: ml } = useMonthWiseData(selectedYear);

  const s = summaryData?.data;

  // District chart: top 22 already returned from backend
  const districts = (districtData?.data || []) as {
    district: string; totalComplaints: number; pending: number; disposed: number;
  }[];

  // Month chart: 12 months sorted
  const months = (monthData?.data || []) as {
    month: string; monthNum: number; total: number; pending: number; disposed: number;
  }[];

  const years = Array.from({ length: Math.max(currentYear - 2014, 1) }, (_, i) => currentYear - i);

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Dashboard Overview</h2>
          <div>
            <label style={{ marginRight: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Year: </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {sl ? (
          <div className="loading-spinner">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Total Received" value={s?.totalReceived || 0} colorClass="blue" />
              <StatCard label="Disposed"       value={s?.totalDisposed || 0} colorClass="green" />
              <StatCard label="Pending"        value={s?.totalPending || 0}  colorClass="red" />
              <StatCard label="Pending 15-30 Days" value={s?.pendingOverFifteenDays || 0} colorClass="yellow" />
            </div>
            <div className="stats-grid-half">
              <StatCard label="Pending 1-2 Months"  value={s?.pendingOverOneMonth || 0}  colorClass="purple" />
              <StatCard label="Pending Over 2 Months" value={s?.pendingOverTwoMonths || 0} colorClass="teal" />
            </div>
          </>
        )}

        {/* Charts */}
        <div className="charts-grid">
          <ChartCard
            title={`District-wise Complaints (${selectedYear})`}
            isLoading={dl}
            option={getDistrictBarOptions(
              districts.map(d => ({
                district: d.district,
                total: d.totalComplaints,
                pending: d.pending,
                disposed: d.disposed,
              }))
            )}
            height="300px"
          />
          <ChartCard
            title={`Monthly Trend (${selectedYear})`}
            isLoading={ml}
            option={getDurationLineOptions(
              months.map(m => ({
                month: m.month,
                total: m.total,
                pending: m.pending,
                disposed: m.disposed,
              }))
            )}
            height="300px"
          />
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;