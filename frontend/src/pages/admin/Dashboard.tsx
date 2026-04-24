import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions } from '@/components/charts/Charts';

const StatCard = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value.toLocaleString()}</div>
  </div>
);

export const DashboardPage = () => {
  const { data: summaryData, isLoading: sl } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/summary', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const { data: districtData, isLoading: dl } = useQuery({
    queryKey: ['dashboard', 'district'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/district-wise', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const { data: durationData, isLoading: durl } = useQuery({
    queryKey: ['dashboard', 'duration'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/duration-wise', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const s = summaryData?.data;
  const districts = districtData?.data || [];
  const durations = durationData?.data || [];

  return (
    <Layout>
      <div className="page-content">
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
            title="District-wise Complaints"
            option={getDistrictBarOptions(districts)}
            height="280px"
          />
          <ChartCard
            title="Duration-wise Complaints"
            option={getDurationLineOptions(durations)}
            height="280px"
          />
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;