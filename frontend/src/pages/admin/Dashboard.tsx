import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions } from '@/components/charts/Charts';

const StatCard = ({ label, value, subValue, colorClass }: { label: string; value: string | number; subValue?: string; colorClass: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value}</div>
    {subValue && <div className="text-xs mt-1 opacity-80">{subValue}</div>}
  </div>
);

export const DashboardPage = () => {
  const navigate = useNavigate();

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

  const { data: matrixData, isLoading: ml } = useQuery({
    queryKey: ['dashboard', 'matrix'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/ageing-matrix', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const s = summaryData?.data;
  const districts = districtData?.data || [];
  const durations = durationData?.data || [];
  const matrix = matrixData?.data || [];

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-slate-100">Executive Overview</h1>
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
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

        <div className="charts-grid">
          <ChartCard
            title="State-wide Trend (Monthly)"
            option={getDurationLineOptions(durations)}
            height="320px"
          />
          <ChartCard
            title="Top District Pendency"
            option={getDistrictBarOptions(districts.sort((a: any, b: any) => b.pending - a.pending).slice(0, 10))}
            height="320px"
          />
        </div>

        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Pendency Ageing Matrix (Days)</h2>
          {ml ? (
            <div className="text-slate-400">Loading matrix...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">District</th>
                    <th className="px-4 py-3 font-medium text-center">&lt; 7 Days</th>
                    <th className="px-4 py-3 font-medium text-center">7 - 15 Days</th>
                    <th className="px-4 py-3 font-medium text-center">15 - 30 Days</th>
                    <th className="px-4 py-3 font-medium text-center text-red-400">&gt; 30 Days</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.sort((a: any, b: any) => b.o30 - a.o30).map((row: any, i: number) => (
                    <tr 
                      key={i} 
                      onClick={() => navigate(`/admin/district/${encodeURIComponent(row.district)}`)}
                      className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer"
                      title={`View Police Station analysis for ${row.district}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-200">{row.district}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{row.u7}</td>
                      <td className="px-4 py-3 text-center text-yellow-500">{row.u15}</td>
                      <td className="px-4 py-3 text-center text-orange-400 font-medium">{row.u30}</td>
                      <td className="px-4 py-3 text-center text-red-500 font-bold bg-red-500/10">{row.o30}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;