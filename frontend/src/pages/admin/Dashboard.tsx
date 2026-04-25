import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions } from '@/components/charts/Charts';
import { useDashboardSummary, useDistrictChart, useDurationChart, useMonthWiseData } from '@/hooks/useData';

const StatCard = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value.toLocaleString()}</div>
  </div>
);

export const DashboardPage = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Summary is all-time based on current date
  const { data: summaryData, isLoading: sl } = useDashboardSummary();
  
  // Charts are filtered by year
  const { data: districtData } = useDistrictChart(selectedYear);
  const { data: durationData } = useDurationChart(selectedYear);

  const s = summaryData?.data;
  const districts = districtData?.data || [];
  const durations = durationData?.data || [];
  
  // Create an array of recent years for the dropdown
  const years = Array.from({ length: Math.max(currentYear - 2014, 1) }, (_, i) => currentYear - i);

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Dashboard Overview</h2>
          <div>
            <label style={{ marginRight: '10px', color: 'var(--text-secondary)' }}>Filter by Year: </label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                outline: 'none',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {sl ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Received" value={s?.totalReceived || 0} colorClass="blue" />
              <StatCard label="Disposed" value={s?.totalDisposed || 0} colorClass="green" />
              <StatCard label="Pending" value={s?.totalPending || 0} colorClass="red" />
              <StatCard label="15-30 Days" value={s?.pendingOverFifteenDays || 0} colorClass="yellow" />
            </div>
            <div className="stats-grid-half">
              <StatCard label="1-2 Months" value={s?.pendingOverOneMonth || 0} colorClass="purple" />
              <StatCard label="Over 2 Months" value={s?.pendingOverTwoMonths || 0} colorClass="teal" />
            </div>
          </>
        )}

        <div className="charts-grid">
          <ChartCard
            title={`District-wise Complaints (${selectedYear})`}
            option={getDistrictBarOptions(districts)}
            height="280px"
          />
          <ChartCard
            title={`Duration-wise Complaints (${selectedYear})`}
            option={getDurationLineOptions(durations)}
            height="280px"
          />
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;