import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { getDistrictBarOptions, getDurationLineOptions, getYoYBarOptions } from '@/components/charts/Charts';
import { useDashboardSummary, useDistrictChart, useMonthWiseData } from '@/hooks/useData';
import { Select } from '@/components/common/Select';
import { GlobalFilterBar } from '@/components/common/GlobalFilterBar';

const CY = new Date().getFullYear();
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
    <div style={{ position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)', opacity: 0.12, color: '#fff' }}>
      <div style={{ transform: 'scale(2.8)' }}>{icon}</div>
    </div>
    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.8, color: '#fff', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{value.toLocaleString()}</div>
    {sub && <div style={{ fontSize: '11px', opacity: 0.7, color: '#fff', marginTop: '4px' }}>{sub}</div>}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
  </div>
);

const YearSelect = ({ value, onChange }: { value: number; onChange: (y: number) => void }) => (
  <Select value={value} onChange={onChange} options={YEARS.map(y => ({ value: y, label: String(y) }))} width="100px" />
);

const DASHBOARD_SORT_OPTIONS = [
  { label: 'Total Reg',                   value: 'Total Reg' },
  { label: 'Total Pending',               value: 'Total Pending' },
  { label: 'Total Disposed',              value: 'Total Disposed' },
  { label: 'Total % (from state total)',  value: 'Total %' },
  { label: 'Pending % (from district total)',  value: 'Pending %' },
  { label: 'Disposed % (from district total)', value: 'Disposed %' },
];

export const DashboardPage = () => {
  const [year, setYear]             = useState(CY);
  const [districtSort, setDistrictSort] = useState('Total Reg');

  // ── Unified filter state
  const [districtFilter,      setDistrictFilter]      = useState<string[]>([]);
  const [sourceFilter,        setSourceFilter]        = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  // ── All filters passed to every API hook — React Query re-fetches on any change
  const filters = useMemo(() => ({
    year:          fromDate ? undefined : year,
    fromDate:      fromDate || undefined,
    toDate:        toDate   || undefined,
    district:      districtFilter.length      > 0 ? districtFilter      : undefined,
    source:        sourceFilter.length        > 0 ? sourceFilter        : undefined,
    complaintType: complaintTypeFilter.length > 0 ? complaintTypeFilter : undefined,
  }), [year, fromDate, toDate, districtFilter, sourceFilter, complaintTypeFilter]);

  const { data: sumData,   isLoading: sl } = useDashboardSummary(filters);
  const { data: distData,  isLoading: dl } = useDistrictChart(filters);
  const { data: monthData, isLoading: ml } = useMonthWiseData(filters);

  const s        = sumData?.data;
  const districts = ((distData?.data || []) as { district: string; totalComplaints: number; pending: number; disposed: number; prevYearTotal: number }[]);
  const months    = ((monthData?.data || []) as { month: string; total: number; pending: number; disposed: number }[]);

  const distRows = districts.map(d => ({ district: d.district, total: d.totalComplaints, pending: d.pending, disposed: d.disposed, prevTotal: d.prevYearTotal }));

  const sortedDistRows = useMemo(() => {
    const arr = [...distRows];
    switch (districtSort) {
      case 'Total Pending':  arr.sort((a, b) => b.pending - a.pending);  break;
      case 'Total Disposed': arr.sort((a, b) => b.disposed - a.disposed); break;
      case 'Pending %':
        arr.sort((a, b) => {
          const pA = a.total > 0 ? a.pending / a.total : 0;
          const pB = b.total > 0 ? b.pending / b.total : 0;
          return pB - pA;
        }); break;
      case 'Disposed %':
        arr.sort((a, b) => {
          const dA = a.total > 0 ? a.disposed / a.total : 0;
          const dB = b.total > 0 ? b.disposed / b.total : 0;
          return dB - dA;
        }); break;
      default: arr.sort((a, b) => b.total - a.total);
    }
    return arr;
  }, [distRows, districtSort]);

  const clearAll = () => {
    setDistrictFilter([]); setSourceFilter([]); setComplaintTypeFilter([]);
    setFromDate(''); setToDate('');
  };

  const activeFilters = districtFilter.length + sourceFilter.length + complaintTypeFilter.length + (fromDate ? 1 : 0);

  return (
    <Layout>
      <div className="page-content">
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.3px' }}>Dashboard Overview</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
              Real-time complaint monitoring · Haryana Police
              {activeFilters > 0 && <span style={{ color: '#6366f1', marginLeft: 8 }}>· {activeFilters} filter{activeFilters > 1 ? 's' : ''} active</span>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>Year:</span>
            <YearSelect value={year} onChange={setYear} />
          </div>
        </div>

        {/* ── Global Filter Bar ── */}
        <GlobalFilterBar
          fromDate={fromDate} toDate={toDate}
          onFromDateChange={setFromDate} onToDateChange={setToDate}
          districtFilter={districtFilter} onDistrictChange={setDistrictFilter}
          sourceFilter={sourceFilter} onSourceChange={setSourceFilter}
          complaintTypeFilter={complaintTypeFilter} onComplaintTypeChange={setComplaintTypeFilter}
          onClearAll={clearAll}
        />

        {/* ── KPI Cards — data reflects active filters ── */}
        {sl ? (
          <div className="stats-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: '90px', borderRadius: '12px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        ) : (
          <>
            <div className="stats-grid">
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
            <div className="stats-grid-half">
              <KpiCard label="Pending 1-2 Months" value={s?.pendingOverOneMonth ?? 0} gradient="linear-gradient(135deg,#ee0979,#ff6a00)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>} />
              <KpiCard label="Pending Over 2 Months" value={s?.pendingOverTwoMonths ?? 0} gradient="linear-gradient(135deg,#283c86,#45a247)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            </div>
          </>
        )}

        {/* ── Charts — both reflect active filters ── */}
        <div className="charts-grid">
          <ChartCard
            title={`District-wise · ${fromDate ? `${fromDate} → ${toDate}` : year}${districtFilter.length > 0 ? ` · ${districtFilter.length} districts` : ''}`}
            option={getDistrictBarOptions(sortedDistRows, { horizontal: true })}
            alternativeOptions={{ grouped: getYoYBarOptions(sortedDistRows, year) }}
            sortOptions={DASHBOARD_SORT_OPTIONS}
            currentSort={districtSort}
            onSortChange={setDistrictSort}
            isLoading={dl}
            height="320px"
          />
          <ChartCard
            title={`Monthly Trend · ${fromDate ? `${fromDate} → ${toDate}` : year}`}
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