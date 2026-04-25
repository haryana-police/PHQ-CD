import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import {
  getDistrictBarOptions,
  getDurationLineOptions,
  getYoYBarOptions,
  getPieOptions,
} from '@/components/charts/Charts';
import { useDashboardSummary, useDistrictChart, useMonthWiseData } from '@/hooks/useData';

const CY = new Date().getFullYear();
const DEFAULT_YEAR = CY - 1; // Last complete year as smart default
const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

// ── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, colorClass, sub,
}: { label: string; value: number; colorClass: string; sub?: string }) => (
  <div className={`stat-card ${colorClass}`}>
    <div className="stat-card-label">{label}</div>
    <div className="stat-card-value">{value.toLocaleString()}</div>
    {sub && <div style={{ fontSize: '10px', opacity: 0.65, marginTop: '2px' }}>{sub}</div>}
  </div>
);

// ── Styled year select ─────────────────────────────────────────────────────
const YearSelect = ({
  value, onChange,
}: { value: number; onChange: (y: number) => void }) => (
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        padding: '7px 30px 7px 12px',
        borderRadius: '8px',
        background: 'rgba(15,23,42,0.85)',
        color: '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        minWidth: '90px',
      }}
    >
      {YEARS.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
    <svg
      style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#64748b' }}
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────
export const DashboardPage = () => {
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);

  const { data: summaryData, isLoading: sl } = useDashboardSummary();
  const { data: districtData, isLoading: dl } = useDistrictChart(selectedYear);
  const { data: monthData,    isLoading: ml } = useMonthWiseData(selectedYear);

  const s = summaryData?.data;

  const districts = (districtData?.data || []) as {
    district: string; totalComplaints: number; pending: number; disposed: number;
  }[];

  const months = (monthData?.data || []) as {
    month: string; monthNum: number; total: number; pending: number; disposed: number;
  }[];

  // Build chart option sets for district chart
  const districtRows = districts.map(d => ({
    district: d.district,
    total:    d.totalComplaints,
    pending:  d.pending,
    disposed: d.disposed,
    prevTotal: 0,
  }));

  const districtStackedOpt    = getDistrictBarOptions(districtRows);
  const districtHorizOpt      = getDistrictBarOptions(districtRows, { horizontal: true });
  const districtYoYOpt        = getYoYBarOptions(districtRows, selectedYear);
  const districtPieOpt        = getPieOptions(districtRows.map(d => ({ name: d.district, value: d.total })));

  return (
    <Layout>
      <div className="page-content">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '18px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9' }}>
              Dashboard Overview
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>
              Haryana Police Headquarters · Complaint Monitoring
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Year:</span>
            <YearSelect value={selectedYear} onChange={setSelectedYear} />
          </div>
        </div>

        {/* ── Summary Stats ────────────────────────────────────────────── */}
        {sl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: '#475569', fontSize: '13px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Loading summary…
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Total Received"    value={s?.totalReceived || 0}     colorClass="blue"   />
              <StatCard label="Disposed"           value={s?.totalDisposed || 0}     colorClass="green"  />
              <StatCard label="Pending"            value={s?.totalPending || 0}      colorClass="red"    />
              <StatCard label="Pending 15-30 Days" value={s?.pendingOverFifteenDays || 0} colorClass="yellow" />
            </div>
            <div className="stats-grid-half" style={{ marginTop: '10px' }}>
              <StatCard label="Pending 1-2 Months"    value={s?.pendingOverOneMonth || 0}  colorClass="purple" />
              <StatCard label="Pending Over 2 Months" value={s?.pendingOverTwoMonths || 0} colorClass="teal"   />
            </div>
          </>
        )}

        {/* ── Charts ───────────────────────────────────────────────────── */}
        <div className="charts-grid" style={{ marginTop: '18px' }}>
          <ChartCard
            title={`District-wise Complaints (${selectedYear})`}
            option={districtStackedOpt}
            alternativeOptions={{
              horizontal: districtHorizOpt,
              grouped:    districtYoYOpt,
              pie:        districtPieOpt,
            }}
            defaultType="stacked"
            isLoading={dl}
            height="320px"
          />
          <ChartCard
            title={`Monthly Trend (${selectedYear})`}
            option={getDurationLineOptions(months)}
            isLoading={ml}
            height="320px"
          />
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;