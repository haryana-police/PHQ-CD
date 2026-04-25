import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getPieOptions, getStackedBarOptions, getDistrictBarOptions } from '@/components/charts/Charts';

// ── Period preset helper ─────────────────────────────────────────────────────
type PeriodPreset = 'this-year' | 'last-year' | 'last-3' | 'custom';

function getPresetDates(preset: PeriodPreset, customFrom: string, customTo: string, year: number) {
  const cy = new Date().getFullYear();
  if (preset === 'this-year')  return { year: cy, fromDate: '', toDate: '' };
  if (preset === 'last-year')  return { year: cy - 1, fromDate: '', toDate: '' };
  if (preset === 'last-3')     return { year: null, fromDate: `${cy - 2}-01-01`, toDate: `${cy}-12-31` };
  if (preset === 'custom')     return { year: null, fromDate: customFrom, toDate: customTo };
  return { year, fromDate: '', toDate: '' };
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'district',          label: 'District',         nameKey: 'district' },
  { id: 'mode-receipt',      label: 'Receipt Mode',     nameKey: 'mode' },
  { id: 'complaint-source',  label: 'Complaint Source', nameKey: 'complaintSource' },
  { id: 'nature-incident',   label: 'Incident Type',    nameKey: 'natureOfIncident' },
  { id: 'type-complaint',    label: 'Type of Complaint',nameKey: 'typeOfComplaint' },
  { id: 'type-against',      label: 'Type Against',     nameKey: 'typeAgainst' },
  { id: 'status',            label: 'Status',           nameKey: 'status' },
  { id: 'branch-wise',       label: 'Branch',           nameKey: 'branch' },
  { id: 'date-wise',         label: 'Date Wise',        nameKey: 'district' },
  { id: 'action-taken',      label: 'Action Taken',     nameKey: 'actionTaken' },
];

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2014 }, (_, i) => CY - i);

// ── Pill button ───────────────────────────────────────────────────────────────
const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 14px',
      borderRadius: '20px',
      border: active ? 'none' : '1px solid var(--border)',
      background: active ? 'var(--accent)' : 'var(--bg-card)',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontSize: '0.8rem',
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    {children}
  </button>
);

// ── Badge: YoY change ─────────────────────────────────────────────────────────
const ChangeBadge = ({ change }: { change: number | null }) => {
  if (change === null) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</span>;
  const up = change > 0;
  return (
    <span style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      color: up ? '#f87171' : '#34d399',
      background: up ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
      padding: '2px 6px',
      borderRadius: '4px',
    }}>
      {up ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const ReportsPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'district';

  const [preset, setPreset]     = useState<PeriodPreset>('this-year');
  const [selectedYear, setYear] = useState(CY);
  const [customFrom, setFrom]   = useState('');
  const [customTo, setTo]       = useState('');

  const { year, fromDate, toDate } = getPresetDates(preset, customFrom, customTo, selectedYear);

  const buildUrl = useCallback(() => {
    const base = `/api/reports/${type}`;
    const params = new URLSearchParams();
    if (year)    params.set('year', String(year));
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate)   params.set('toDate', toDate);
    return `${base}?${params}`;
  }, [type, year, fromDate, toDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', type, year, fromDate, toDate],
    queryFn: async () => {
      const r = await fetch(buildUrl(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Support both { rows: [...] } and flat array response shapes
  const raw = data?.data?.rows ?? data?.data ?? [];
  const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw : [];

  const tab = TABS.find(t => t.id === type)!;

  // Summary numbers
  const total = rows.reduce((s, r) => s + Number(r.total ?? r.count ?? 0), 0);
  const pend  = rows.reduce((s, r) => s + Number(r.pending ?? 0), 0);
  const disp  = rows.reduce((s, r) => s + Number(r.disposed ?? 0), 0);

  // Table rows
  const tableData = rows.map((r, i) => {
    const tot = Number(r.total ?? r.count ?? 0);
    const p   = Number(r.pending  ?? 0);
    const d   = Number(r.disposed ?? 0);
    return {
      name:     String(r[tab.nameKey] ?? r.district ?? r.category ?? `Item ${i + 1}`),
      total:    tot,
      pending:  p,
      disposed: d,
      pendPct:  tot > 0 ? `${Math.round((p / tot) * 100)}%` : '0%',
      dispPct:  tot > 0 ? `${Math.round((d / tot) * 100)}%` : '0%',
      change:   r.change as number | null ?? null,
      prevTotal:Number(r.prevTotal ?? 0),
    };
  });

  const showYoY = !fromDate && !toDate && type === 'district';

  const columns: Column<typeof tableData[0]>[] = [
    { key: 'name',     label: tab.label,    sortable: true },
    { key: 'total',    label: 'Total',      sortable: true, align: 'right' },
    { key: 'pending',  label: 'Pending',    sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed',   sortable: true, align: 'right' },
    { key: 'pendPct',  label: 'Pend %',     align: 'center' },
    { key: 'dispPct',  label: 'Disp %',     align: 'center' },
    ...(showYoY ? [
      { key: 'prevTotal' as keyof typeof tableData[0], label: `${(year ?? CY) - 1} Total`, sortable: true, align: 'right' as const },
      { key: 'change'    as keyof typeof tableData[0], label: 'YoY Change', align: 'center' as const },
    ] : []),
  ];

  // Chart option
  const chartOption = (() => {
    const districtData = rows.map(r => ({
      district: String(r.district ?? r[tab.nameKey] ?? ''),
      total: Number(r.total ?? 0),
      pending: Number(r.pending ?? 0),
      disposed: Number(r.disposed ?? 0),
    }));

    if (type === 'district' || type === 'date-wise') {
      return getDistrictBarOptions(districtData);
    }
    if (type === 'mode-receipt' || type === 'status') {
      return getPieOptions(rows.map(r => ({
        name: String(r.mode ?? r.status ?? r[tab.nameKey] ?? ''),
        value: Number(r.total ?? r.count ?? 0),
      })));
    }
    return getStackedBarOptions(rows.map(r => ({
      category: String(r[tab.nameKey] ?? r.district ?? ''),
      total:    Number(r.total ?? 0),
      pending:  Number(r.pending ?? 0),
      disposed: Number(r.disposed ?? 0),
    })));
  })();

  // Period label for display
  const periodLabel = (() => {
    if (preset === 'this-year')  return `Year ${CY}`;
    if (preset === 'last-year')  return `Year ${CY - 1}`;
    if (preset === 'last-3')     return `${CY - 2} – ${CY}`;
    if (customFrom && customTo)  return `${customFrom} → ${customTo}`;
    return String(selectedYear);
  })();

  return (
    <Layout>
      <div className="page-content">

        {/* ── Period Controls ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: 4 }}>Period:</span>

          <Pill active={preset === 'this-year'} onClick={() => setPreset('this-year')}>This Year ({CY})</Pill>
          <Pill active={preset === 'last-year'} onClick={() => setPreset('last-year')}>Last Year ({CY - 1})</Pill>
          <Pill active={preset === 'last-3'}    onClick={() => setPreset('last-3')}>Last 3 Years</Pill>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select year:</span>
            <select
              value={selectedYear}
              onChange={e => { setYear(Number(e.target.value)); setPreset('this-year'); }}
              style={{
                padding: '4px 10px', borderRadius: '6px',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <span style={{ color: 'var(--border)', fontSize: '1rem' }}>|</span>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Custom range:</span>
          <input type="date" value={customFrom} onChange={e => { setFrom(e.target.value); setPreset('custom'); }}
            style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.8rem' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>to</span>
          <input type="date" value={customTo} onChange={e => { setTo(e.target.value); setPreset('custom'); }}
            style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.8rem' }} />

          <span style={{
            marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--accent)',
            background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600,
          }}>
            📅 Showing: {periodLabel}
          </span>
        </div>

        {/* ── Report Tabs ────────────────────────────────────────────────── */}
        <div className="tab-list" style={{ marginBottom: '16px' }}>
          {TABS.map(t => (
            <Link key={t.id} to={`?type=${t.id}`} className={`tab-item ${type === t.id ? 'active' : ''}`}>{t.label}</Link>
          ))}
        </div>

        {isLoading ? (
          <div className="loading-spinner">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* ── Summary Cards ──────────────────────────────────────────── */}
            <div className="summary-row" style={{ marginBottom: '16px' }}>
              <div className="summary-item">
                <span className="summary-value">{total.toLocaleString()}</span>
                <span className="summary-label">Total ({periodLabel})</span>
              </div>
              <div className="summary-item pending">
                <span className="summary-value">{pend.toLocaleString()}</span>
                <span className="summary-label">Pending {total > 0 ? `(${(pend / total * 100).toFixed(1)}%)` : ''}</span>
              </div>
              <div className="summary-item disposed">
                <span className="summary-value">{disp.toLocaleString()}</span>
                <span className="summary-label">Disposed {total > 0 ? `(${(disp / total * 100).toFixed(1)}%)` : ''}</span>
              </div>
              <div className="summary-item">
                <span className="summary-value">{rows.length}</span>
                <span className="summary-label">Categories</span>
              </div>
            </div>

            {/* ── Chart ──────────────────────────────────────────────────── */}
            <ChartCard
              title={`${tab.label} — ${periodLabel}`}
              option={chartOption}
              height="300px"
            />

            {/* ── Table ──────────────────────────────────────────────────── */}
            <DataTable
              title={`${tab.label} Breakdown`}
              data={tableData}
              columns={columns.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'name')      return <span style={{ fontWeight: 500 }}>{String(row.name)}</span>;
                  if (c.key === 'total')     return <span style={{ fontWeight: 600 }}>{row.total.toLocaleString()}</span>;
                  if (c.key === 'pending')   return <span style={{ color: '#fbbf24' }}>{row.pending.toLocaleString()}</span>;
                  if (c.key === 'disposed')  return <span style={{ color: '#34d399' }}>{row.disposed.toLocaleString()}</span>;
                  if (c.key === 'pendPct')   return <span style={{ color: '#fbbf24' }}>{String(row.pendPct)}</span>;
                  if (c.key === 'dispPct')   return <span style={{ color: '#34d399' }}>{String(row.dispPct)}</span>;
                  if (c.key === 'prevTotal') return <span style={{ color: 'var(--text-secondary)' }}>{Number(row.prevTotal).toLocaleString()}</span>;
                  if (c.key === 'change')    return <ChangeBadge change={row.change} />;
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 500px)"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;