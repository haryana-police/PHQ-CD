import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import {
  getPieOptions, getStackedBarOptions, getDistrictBarOptions,
  getYoYBarOptions,
} from '@/components/charts/Charts';
import { Select } from '@/components/common/Select';

// ── Constants ─────────────────────────────────────────────────────────────────
const CY = new Date().getFullYear();           // 2026
const DEFAULT_YEAR = CY - 1;                   // 2025 — last complete year as smart default
const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

const TABS = [
  { id: 'district',         label: 'District',          nameKey: 'district' },
  { id: 'mode-receipt',     label: 'Receipt Mode',      nameKey: 'mode' },
  { id: 'complaint-source', label: 'Complaint Source',  nameKey: 'complaintSource' },
  { id: 'nature-incident',  label: 'Incident Type',     nameKey: 'natureOfIncident' },
  { id: 'type-complaint',   label: 'Type of Complaint', nameKey: 'typeOfComplaint' },
  { id: 'type-against',     label: 'Type Against',      nameKey: 'typeAgainst' },
  { id: 'status',           label: 'Status',            nameKey: 'status' },
  { id: 'branch-wise',      label: 'Branch',            nameKey: 'branch' },
  { id: 'date-wise',        label: 'Date Wise',         nameKey: 'district' },
  { id: 'action-taken',     label: 'Action Taken',      nameKey: 'actionTaken' },
];

// ── Styled primitives ─────────────────────────────────────────────────────────
const PeriodBtn = ({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      padding: '7px 16px',
      borderRadius: '8px',
      fontSize: '12.5px',
      fontWeight: active ? 600 : 400,
      border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
      background: active
        ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.12))'
        : 'rgba(255,255,255,0.03)',
      color: active ? '#a5b4fc' : '#64748b',
      cursor: 'pointer',
      transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
      whiteSpace: 'nowrap' as const,
      backdropFilter: 'blur(4px)',
      boxShadow: active ? '0 0 0 1px rgba(99,102,241,0.2) inset' : 'none',
    }}
  >
    {children}
  </button>
);



const StyledDateInput = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    {label && <span style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' as const }}>{label}</span>}
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '6px 10px',
        borderRadius: '8px',
        background: 'rgba(15,23,42,0.8)',
        color: '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        outline: 'none',
        cursor: 'pointer',
        colorScheme: 'dark',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    />
  </div>
);

// ── YoY Change Badge ──────────────────────────────────────────────────────────
const Delta = ({ change }: { change: number | null }) => {
  if (change === null || change === 0)
    return <span style={{ color: '#475569', fontSize: '11px' }}>—</span>;
  const up = change > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      fontSize: '11px', fontWeight: 700,
      color: up ? '#fca5a5' : '#6ee7b7',
      background: up ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
      border: `1px solid ${up ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
      padding: '2px 6px', borderRadius: '4px',
    }}>
      {up ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  );
};

// ── Summary Stat Card ─────────────────────────────────────────────────────────
const SummaryCard = ({
  label, value, color, sub,
}: { label: string; value: string; color: string; sub?: string }) => (
  <div style={{
    background: 'rgba(19,32,53,0.7)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '16px 20px',
    borderTop: `3px solid ${color}`,
    transition: 'transform 0.15s',
  }}>
    <div style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    {sub && <div style={{ fontSize: '12px', color, marginTop: '4px', fontWeight: 600 }}>{sub}</div>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
type PeriodMode = 'year' | 'custom';

export const ReportsPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'district';

  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo,   setCustomTo]     = useState('');

  // Build API URL
  const apiUrl = useMemo(() => {
    const base = `/api/reports/${type}`;
    const p = new URLSearchParams();
    if (periodMode === 'year') {
      p.set('year', String(selectedYear));
    } else if (customFrom && customTo) {
      p.set('fromDate', customFrom);
      p.set('toDate',   customTo);
    } else {
      p.set('year', String(selectedYear));
    }
    return `${base}?${p}`;
  }, [type, periodMode, selectedYear, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', type, periodMode, selectedYear, customFrom, customTo],
    queryFn: async () => {
      const r = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const raw: Record<string, unknown>[] = useMemo(() => {
    const d = data?.data;
    if (!d) return [];
    return Array.isArray(d) ? d : (Array.isArray(d.rows) ? d.rows : []);
  }, [data]);

  const tab = TABS.find(t => t.id === type)!;

  // Summary
  const total = raw.reduce((s, r) => s + Number(r.total ?? r.count ?? 0), 0);
  const pend  = raw.reduce((s, r) => s + Number(r.pending  ?? 0), 0);
  const disp  = raw.reduce((s, r) => s + Number(r.disposed ?? 0), 0);
  const prevTotal = raw.reduce((s, r) => s + Number(r.prevTotal ?? 0), 0);

  const dispRate = total > 0 ? (disp / total * 100).toFixed(1) : '0.0';
  const pendRate = total > 0 ? (pend / total * 100).toFixed(1) : '0.0';

  // Period label
  const periodLabel = periodMode === 'custom' && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : `Year ${selectedYear}`;

  const showYoY = periodMode === 'year' && type === 'district';
  const activeYear = data?.data?.year ?? selectedYear;

  // Table rows
  const tableData = raw.map((r, i) => {
    const tot = Number(r.total ?? r.count ?? 0);
    const p   = Number(r.pending  ?? 0);
    const d   = Number(r.disposed ?? 0);
    return {
      name:      String(r[tab.nameKey] ?? r.district ?? r.category ?? `Item ${i + 1}`),
      total:     tot,
      pending:   p,
      disposed:  d,
      pendPct:   tot > 0 ? `${Math.round((p / tot) * 100)}%` : '—',
      dispPct:   tot > 0 ? `${Math.round((d / tot) * 100)}%` : '—',
      prevTotal: Number(r.prevTotal ?? 0),
      change:    (r.change as number | null) ?? null,
    };
  });

  const columns: Column<typeof tableData[0]>[] = [
    { key: 'name',     label: tab.label,  sortable: true },
    { key: 'total',    label: `Total (${periodLabel})`, sortable: true, align: 'right' },
    { key: 'pending',  label: 'Pending',  sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'right' },
    { key: 'pendPct',  label: 'Pend%',   sortable: true, align: 'center' },
    { key: 'dispPct',  label: 'Disp%',   sortable: true, align: 'center' },
    ...(showYoY ? [
      { key: 'prevTotal' as keyof typeof tableData[0], label: `${activeYear - 1} Total`, sortable: true, align: 'right' as const },
      { key: 'change'    as keyof typeof tableData[0], label: 'YoY',  align: 'center' as const },
    ] : []),
  ];

  // Chart options
  const districtData = raw.map(r => ({
    district: String(r[tab.nameKey] ?? r.district ?? ''),
    total:    Number(r.total ?? 0),
    pending:  Number(r.pending  ?? 0),
    disposed: Number(r.disposed ?? 0),
    prevTotal:Number(r.prevTotal ?? 0),
  }));

  const stackedOpt   = getDistrictBarOptions(districtData);
  const horizontalOpt= getDistrictBarOptions(districtData, { horizontal: true });
  const yoyOpt       = getYoYBarOptions(districtData, activeYear);
  const pieOpt       = getPieOptions(raw.map(r => ({
    name:  String(r[tab.nameKey] ?? r.district ?? ''),
    value: Number(r.total ?? r.count ?? 0),
  })));
  const stackedCatOpt= getStackedBarOptions(raw.map(r => ({
    category: String(r[tab.nameKey] ?? ''),
    total:    Number(r.total ?? 0),
    pending:  Number(r.pending ?? 0),
    disposed: Number(r.disposed ?? 0),
  })));

  const isDistrictType = type === 'district' || type === 'date-wise';
  const isPieType = type === 'mode-receipt' || type === 'status';

  const primaryOption = isDistrictType ? stackedOpt : isPieType ? pieOpt : stackedCatOpt;
  const altOptions = isDistrictType
    ? { horizontal: horizontalOpt, grouped: yoyOpt, pie: pieOpt }
    : isPieType
    ? { stacked: stackedCatOpt }
    : { pie: pieOpt };
  const defaultChartType = isDistrictType ? 'stacked' : isPieType ? 'pie' : 'stacked';

  return (
    <Layout>
      <div className="page-content">

        {/* ── Period Controls ─────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(19,32,53,0.6)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '14px',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
        }}>

          {/* Quick presets */}
          <PeriodBtn active={periodMode === 'year' && selectedYear === CY}
            onClick={() => { setPeriodMode('year'); setSelectedYear(CY); }}>
            This Year ({CY})
          </PeriodBtn>
          <PeriodBtn active={periodMode === 'year' && selectedYear === CY - 1}
            onClick={() => { setPeriodMode('year'); setSelectedYear(CY - 1); }}>
            Last Year ({CY - 1})
          </PeriodBtn>
          <PeriodBtn active={periodMode === 'year' && selectedYear === CY - 2}
            onClick={() => { setPeriodMode('year'); setSelectedYear(CY - 2); }}>
            {CY - 2}
          </PeriodBtn>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          {/* Year dropdown */}
          <Select
            value={selectedYear}
            onChange={v => { setSelectedYear(Number(v)); setPeriodMode('year'); }}
            options={YEARS.map(y => ({ value: y, label: String(y) }))}
            width="100px"
          />

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          {/* Custom range toggle */}
          <PeriodBtn
            active={periodMode === 'custom'}
            onClick={() => setPeriodMode(periodMode === 'custom' ? 'year' : 'custom')}
          >
            📅 Custom Range
          </PeriodBtn>

          {periodMode === 'custom' && (
            <>
              <StyledDateInput value={customFrom} onChange={setCustomFrom} label="From" />
              <StyledDateInput value={customTo}   onChange={setCustomTo}   label="to" />
            </>
          )}

          {/* Active badge */}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: '11.5px', fontWeight: 600,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.2)',
              padding: '5px 12px', borderRadius: '20px',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {periodLabel}
            </span>
          </div>
        </div>

        {/* ── Report Tabs ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px',
          marginBottom: '14px',
          padding: '6px',
          background: 'rgba(19,32,53,0.4)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {TABS.map(t => (
            <Link
              key={t.id}
              to={`?type=${t.id}`}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: type === t.id ? 600 : 400,
                textDecoration: 'none',
                color: type === t.id ? '#a5b4fc' : '#64748b',
                background: type === t.id
                  ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.1))'
                  : 'transparent',
                border: type === t.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', flexDirection: 'column', gap: '14px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ color: '#475569', fontSize: '13px' }}>Loading {tab.label} data for {periodLabel}…</span>
          </div>
        ) : (
          <>
            {/* ── Summary Cards ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '14px' }}>
              <SummaryCard label="Total Complaints" value={total.toLocaleString()} color="#6366f1" sub={`Period: ${periodLabel}`} />
              <SummaryCard label="Pending" value={pend.toLocaleString()} color="#f59e0b" sub={`${pendRate}% of total`} />
              <SummaryCard label="Disposed" value={disp.toLocaleString()} color="#10b981" sub={`${dispRate}% of total`} />
              <SummaryCard label="Categories" value={String(raw.length)} color="#818cf8" />
              {showYoY && prevTotal > 0 && (
                <SummaryCard
                  label={`${activeYear - 1} Total`}
                  value={prevTotal.toLocaleString()}
                  color="#475569"
                  sub={`vs ${total.toLocaleString()} this year`}
                />
              )}
            </div>

            {/* ── Chart ──────────────────────────────────────────────────── */}
            <div style={{ marginBottom: '14px' }}>
              <ChartCard
                title={`${tab.label} — ${periodLabel}`}
                option={primaryOption as any}
                alternativeOptions={altOptions as any}
                defaultType={defaultChartType as any}
                height="320px"
              />
            </div>

            {/* ── Data Table ─────────────────────────────────────────────── */}
            <DataTable
              title={`${tab.label} Breakdown · ${periodLabel}`}
              data={tableData}
              columns={columns.map(c => ({
                ...c,
                render: (row: any) => {
                  if (c.key === 'name')      return <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{String(row.name)}</span>;
                  if (c.key === 'total')     return <span style={{ fontWeight: 700 }}>{row.total.toLocaleString()}</span>;
                  if (c.key === 'pending')   return <span style={{ color: '#fbbf24', fontWeight: 600 }}>{row.pending.toLocaleString()}</span>;
                  if (c.key === 'disposed')  return <span style={{ color: '#34d399', fontWeight: 600 }}>{row.disposed.toLocaleString()}</span>;
                  if (c.key === 'pendPct')   return <span style={{ color: '#fbbf24', fontSize: '12px' }}>{String(row.pendPct)}</span>;
                  if (c.key === 'dispPct')   return <span style={{ color: '#34d399', fontSize: '12px' }}>{String(row.dispPct)}</span>;
                  if (c.key === 'prevTotal') return <span style={{ color: '#94a3b8' }}>{Number(row.prevTotal).toLocaleString()}</span>;
                  if (c.key === 'change')    return <Delta change={row.change} />;
                  return String(row[c.key as keyof typeof row] ?? '—');
                },
              }))}
              maxHeight="calc(100vh - 520px)"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;