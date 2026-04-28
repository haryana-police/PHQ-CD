import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions, getYoYBarOptions, getPieOptions } from '@/components/charts/Charts';
import { useDashboardSummary, useDistrictChart, useMonthWiseData } from '@/hooks/useData';
import { Select } from '@/components/common/Select';

const CY = new Date().getFullYear();
const DEFAULT_YEAR = CY;
const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

// ── KPI Card ──────────────────────────────────────────────────────────────
interface KpiProps { label: string; value: number; gradient: string; icon: React.ReactNode; sub?: string; }
const KpiCard = ({ label, value, gradient, icon, sub }: KpiProps) => (
  <div style={{
    borderRadius: '12px', padding: '18px 20px',
    background: gradient,
    position: 'relative', overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 32px rgba(0,0,0,0.4)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
  >
    {/* Background icon watermark */}
    <div style={{ position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)', opacity: 0.12, color: '#fff' }}>
      <div style={{ transform: 'scale(2.8)' }}>{icon}</div>
    </div>
    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.8, color: '#fff', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{value.toLocaleString()}</div>
    {sub && <div style={{ fontSize: '11px', opacity: 0.7, color: '#fff', marginTop: '4px' }}>{sub}</div>}
    {/* Shine overlay */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
  </div>
);

// ── Year Selector ─────────────────────────────────────────────────────────
const YearSelect = ({ value, onChange }: { value: number; onChange: (y: number) => void }) => (
  <Select
    value={value}
    onChange={onChange}
    options={YEARS.map(y => ({ value: y, label: String(y) }))}
    width="100px"
  />
);

export const DashboardPage = () => {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const { data: sumData, isLoading: sl } = useDashboardSummary(year);
  const { data: distData, isLoading: dl } = useDistrictChart(year);
  const { data: monthData, isLoading: ml } = useMonthWiseData(year);

  const s = sumData?.data;
  const districts = ((distData?.data || []) as { district: string; totalComplaints: number; pending: number; disposed: number }[]);
  const months    = ((monthData?.data || []) as { month: string; total: number; pending: number; disposed: number }[]);

  const distRows = districts.map(d => ({ district: d.district, total: d.totalComplaints, pending: d.pending, disposed: d.disposed, prevTotal: 0 }));

  return (
    <Layout>
      <div className="page-content">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.3px' }}>Dashboard Overview</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
              Real-time complaint monitoring · Haryana Police
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>Filter year:</span>
            <YearSelect value={year} onChange={setYear} />
          </div>
        </div>

        {/* KPI Cards */}
        {sl ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '20px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: '90px', borderRadius: '12px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
              <KpiCard label="Total Received" value={s?.totalReceived ?? 0} gradient="linear-gradient(135deg,#6a11cb,#2575fc)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} />
              <KpiCard label="Disposed" value={s?.totalDisposed ?? 0} gradient="linear-gradient(135deg,#11998e,#38ef7d)"
                sub={s?.totalReceived ? `${((s.totalDisposed/s.totalReceived)*100).toFixed(1)}% disposal rate` : ''}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>} />
              <KpiCard label="Pending" value={s?.totalPending ?? 0} gradient="linear-gradient(135deg,#ff416c,#ff4b2b)"
                sub={s?.totalReceived ? `${((s.totalPending/s.totalReceived)*100).toFixed(1)}% pending rate` : ''}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
              <KpiCard label="Pending 15-30 Days" value={s?.pendingOverFifteenDays ?? 0} gradient="linear-gradient(135deg,#f7971e,#ffd200)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <KpiCard label="Pending 1-2 Months" value={s?.pendingOverOneMonth ?? 0} gradient="linear-gradient(135deg,#ee0979,#ff6a00)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>} />
              <KpiCard label="Pending Over 2 Months" value={s?.pendingOverTwoMonths ?? 0} gradient="linear-gradient(135deg,#283c86,#45a247)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            </div>
          </>
        )}

        {/* Charts */}
        <div className="charts-grid">
          <ChartCard
            title={`District-wise · ${year}`}
            option={getDistrictBarOptions(distRows)}
            alternativeOptions={{ horizontal: getDistrictBarOptions(distRows, { horizontal: true }), grouped: getYoYBarOptions(distRows, year), pie: getPieOptions(distRows.map(d => ({ name: d.district, value: d.total }))) }}
            defaultType="stacked"
            isLoading={dl}
            height="320px"
          />
          <ChartCard
            title={`Monthly Trend · ${year}`}
            option={getDurationLineOptions(months, year)}
            isLoading={ml}
            height="320px"
          />
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;