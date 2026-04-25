import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getStackedBarOptions } from '@/components/charts/Charts';

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
  
  // Calculate aggregates for this district from PS data
  const totalReceived = policeStations.reduce((sum: number, ps: any) => sum + ps.total, 0);
  const totalPending = policeStations.reduce((sum: number, ps: any) => sum + ps.pending, 0);
  const totalDisposed = policeStations.reduce((sum: number, ps: any) => sum + ps.disposed, 0);
  
  // Calculate weighted average disposal time
  const totalDisposedDays = policeStations.reduce((sum: number, ps: any) => sum + (ps.avgDisposalDays * ps.disposed), 0);
  const avgDisposalTime = totalDisposed > 0 ? Math.round(totalDisposedDays / totalDisposed) : 0;

  return (
    <Layout>
      <div className="page-content space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-slate-100">{district} District Analysis</h1>
          </div>
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
            Export PS Report
          </button>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-800 rounded-lg p-5 border border-slate-700">
                <h2 className="text-lg font-bold text-slate-100 mb-4">Police Station Breakdown & Ageing</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Police Station</th>
                        <th className="px-4 py-3 font-medium text-center">Total</th>
                        <th className="px-4 py-3 font-medium text-center">Disposed</th>
                        <th className="px-4 py-3 font-medium text-center border-l border-slate-700">&lt; 7 Days</th>
                        <th className="px-4 py-3 font-medium text-center">7 - 15 Days</th>
                        <th className="px-4 py-3 font-medium text-center">15 - 30 Days</th>
                        <th className="px-4 py-3 font-medium text-center text-red-400">&gt; 30 Days</th>
                        <th className="px-4 py-3 font-medium text-center border-l border-slate-700">Avg Disposal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policeStations.sort((a: any, b: any) => b.o30 - a.o30 || b.pending - a.pending).map((row: any, i: number) => (
                        <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-200">{row.ps}</td>
                          <td className="px-4 py-3 text-center text-blue-400">{row.total}</td>
                          <td className="px-4 py-3 text-center text-green-400">{row.disposed}</td>
                          
                          <td className="px-4 py-3 text-center text-slate-300 border-l border-slate-700/50">{row.u7}</td>
                          <td className="px-4 py-3 text-center text-yellow-500">{row.u15}</td>
                          <td className="px-4 py-3 text-center text-orange-400 font-medium">{row.u30}</td>
                          <td className="px-4 py-3 text-center text-red-500 font-bold bg-red-500/10">{row.o30}</td>
                          
                          <td className="px-4 py-3 text-center text-purple-400 border-l border-slate-700/50">{row.avgDisposalDays}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          </>
        )}
      </div>
    </Layout>
  );
};

export default DistrictDetail;
