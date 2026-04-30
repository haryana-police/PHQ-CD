import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import {
  getHorizontalSingleBarOptions, getGroupedBarOptions, getDistrictBarOptions,
  getYoYBarOptions,
} from '@/components/charts/Charts';
import { GlobalFilterBar, PeriodMode } from '@/components/common/GlobalFilterBar';

// ── Constants ─────────────────────────────────────────────────────────────────
const CY = new Date().getFullYear();
const DEFAULT_YEAR = CY;

const REPORTS_SORT_OPTIONS = [
  { label: 'Total Reg',      value: 'Total Reg' },
  { label: 'Total Pending',  value: 'Total Pending' },
  { label: 'Total Disposed', value: 'Total Disposed' },
  { label: 'Pending %',      value: 'Pending %' },
  { label: 'Disposed %',     value: 'Disposed %' },
];

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
    padding: '14px 18px',
    borderTop: `3px solid ${color}`,
    transition: 'transform 0.15s',
  }}>
    <div style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    {sub && <div style={{ fontSize: '12px', color, marginTop: '4px', fontWeight: 600 }}>{sub}</div>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export const ReportsPage = () => {
  const [sp] = useSearchParams();
  const type = sp.get('type') || 'district';

  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [chartSort, setChartSort] = useState('Total Reg');
  const [itemFilter, setItemFilter] = useState<string[]>([]);
  const [districtFilter,      setDistrictFilter]      = useState<string[]>([]);
  const [sourceFilter,        setSourceFilter]        = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);

  // Reset item/district filter when report tab changes
  useEffect(() => { setItemFilter([]); setDistrictFilter([]); }, [type]);

  // Build API URL — includes ALL active filters so server does the real filtering
  const apiFilters = useMemo(() => {
    const p = new URLSearchParams();
    if (periodMode === 'year') {
      p.set('year', String(selectedYear));
    } else if (customFrom && customTo) {
      p.set('fromDate', customFrom);
      p.set('toDate',   customTo);
    } else {
      p.set('year', String(selectedYear));
    }
    if (districtFilter.length > 0)      p.set('district',      districtFilter.join(','));
    if (sourceFilter.length > 0)        p.set('source',        sourceFilter.join(','));
    if (complaintTypeFilter.length > 0) p.set('complaintType', complaintTypeFilter.join(','));
    return p.toString();
  }, [type, periodMode, selectedYear, customFrom, customTo, districtFilter, sourceFilter, complaintTypeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', type, apiFilters],
    queryFn: async () => {
      const r = await fetch(`/api/reports/${type}?${apiFilters}`, {
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

  const sortedRawForChart = useMemo(() => {
    const arr = [...raw];
    switch (chartSort) {
      case 'Total Pending':
        arr.sort((a, b) => Number(b.pending ?? 0) - Number(a.pending ?? 0));
        break;
      case 'Total Disposed':
        arr.sort((a, b) => Number(b.disposed ?? 0) - Number(a.disposed ?? 0));
        break;
      case 'Pending %':
        arr.sort((a, b) => {
          const tA = Number(a.total ?? a.count ?? 0); const pA = Number(a.pending ?? 0);
          const tB = Number(b.total ?? b.count ?? 0); const pB = Number(b.pending ?? 0);
          return (tB > 0 ? pB / tB : 0) - (tA > 0 ? pA / tA : 0);
        });
        break;
      case 'Disposed %':
        arr.sort((a, b) => {
          const tA = Number(a.total ?? a.count ?? 0); const dA = Number(a.disposed ?? 0);
          const tB = Number(b.total ?? b.count ?? 0); const dB = Number(b.disposed ?? 0);
          return (tB > 0 ? dB / tB : 0) - (tA > 0 ? dA / tA : 0);
        });
        break;
      case 'Total Reg':
      default:
        arr.sort((a, b) => Number(b.total ?? b.count ?? 0) - Number(a.total ?? a.count ?? 0));
    }
    return arr;
  }, [raw, chartSort]);

  // Multi-select item filter (client-side — filters rows by the current tab's name key)
  const tab = TABS.find(t => t.id === type)!;

  const filterOptions = useMemo(() =>
    raw.map(r => {
      const name = String(r[tab?.nameKey] ?? r.district ?? '');
      return { value: name, label: name };
    }).filter((o, i, a) => o.value && a.findIndex(x => x.value === o.value) === i),
    [raw, tab]
  );

  // Item filter is client-side; source/type/district go to API
  const applyItemFilter = (arr: Record<string, unknown>[]) =>
    itemFilter.length === 0
      ? arr
      : arr.filter(r => itemFilter.includes(String(r[tab?.nameKey] ?? r.district ?? '')));

  const filteredRawForChart = useMemo(() => applyItemFilter(sortedRawForChart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedRawForChart, itemFilter, tab]);

  const filteredRaw = useMemo(() => applyItemFilter(raw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, itemFilter, tab]);

  // Summary (use filteredRaw so KPIs reflect filter)
  const total = filteredRaw.reduce((s, r) => s + Number(r.total ?? r.count ?? 0), 0);
  const pend  = filteredRaw.reduce((s, r) => s + Number(r.pending  ?? 0), 0);
  const disp  = filteredRaw.reduce((s, r) => s + Number(r.disposed ?? 0), 0);
  const prevTotal = filteredRaw.reduce((s, r) => s + Number(r.prevTotal ?? 0), 0);

  const dispRate = total > 0 ? (disp / total * 100).toFixed(1) : '0.0';
  const pendRate = total > 0 ? (pend / total * 100).toFixed(1) : '0.0';

  const periodLabel = periodMode === 'custom' && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : `Year ${selectedYear}`;

  const showYoY = periodMode === 'year' && type === 'district';
  const activeYear = data?.data?.year ?? selectedYear;

  // Table rows
  const tableData = filteredRaw.map((r, i) => {
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
  const districtData = filteredRawForChart.map(r => ({
    district: String(r[tab.nameKey] ?? r.district ?? ''),
    total:    Number(r.total ?? 0),
    pending:  Number(r.pending  ?? 0),
    disposed: Number(r.disposed ?? 0),
    prevTotal:Number(r.prevTotal ?? 0),
  }));

  const horizontalOpt      = getDistrictBarOptions(districtData, { horizontal: true });
  const yoyOpt             = getYoYBarOptions(districtData, activeYear);
  const horizontalSingleOpt = getHorizontalSingleBarOptions(filteredRawForChart.map(r => ({
    name:  String(r[tab.nameKey] ?? r.district ?? ''),
    value: Number(r.total ?? r.count ?? 0),
  })));
  const groupedCatOpt = getGroupedBarOptions(filteredRawForChart.map(r => ({
    category: String(r[tab.nameKey] ?? ''),
    total:    Number(r.total ?? 0),
    pending:  Number(r.pending ?? 0),
    disposed: Number(r.disposed ?? 0),
  })));

  const isDistrictType = type === 'district' || type === 'date-wise';
  const isPieType = type === 'mode-receipt' || type === 'status';

  const primaryOption    = isDistrictType ? horizontalOpt : isPieType ? horizontalSingleOpt : groupedCatOpt;
  const altOptions       = isDistrictType ? { grouped: yoyOpt } : {};
  const defaultChartType = isDistrictType ? 'horizontal' : isPieType ? 'horizontal' : 'grouped';

  return (
    <Layout>
      <div className="page-content">

        {/* ── Unified Filter Bar (period + all filters in one row) ── */}
        <GlobalFilterBar
          showPeriod
          periodMode={periodMode}
          onPeriodModeChange={(m) => {
            setPeriodMode(m);
            if (m === 'year') { setCustomFrom(''); setCustomTo(''); }
          }}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          onFromDateChange={setCustomFrom}
          onToDateChange={setCustomTo}

          districtFilter={districtFilter}   onDistrictChange={setDistrictFilter}
          sourceFilter={sourceFilter}       onSourceChange={setSourceFilter}
          complaintTypeFilter={complaintTypeFilter} onComplaintTypeChange={setComplaintTypeFilter}

          extraLabel={tab.label}
          extraOptions={filterOptions}
          extraSelected={itemFilter}
          onExtraChange={setItemFilter}
          showExtra={filterOptions.length > 0 && type !== 'district' && type !== 'date-wise'}

          onClearAll={() => {
            setItemFilter([]); setDistrictFilter([]);
            setSourceFilter([]); setComplaintTypeFilter([]);
            setCustomFrom(''); setCustomTo('');
            setPeriodMode('year'); setSelectedYear(CY);
          }}
        />

        {/* ── Report Tabs ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px',
          marginBottom: '14px',
          padding: '5px',
          background: 'rgba(19,32,53,0.4)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {TABS.map(t => (
            <Link
              key={t.id}
              to={`?type=${t.id}`}
              style={{
                padding: '5px 13px',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '12px' }}>
              <SummaryCard label="Total Complaints" value={total.toLocaleString()} color="#6366f1" sub={`Period: ${periodLabel}`} />
              <SummaryCard label="Pending"   value={pend.toLocaleString()}  color="#f59e0b" sub={`${pendRate}% of total`} />
              <SummaryCard label="Disposed"  value={disp.toLocaleString()}  color="#10b981" sub={`${dispRate}% of total`} />
              <SummaryCard label="Categories" value={String(raw.length)}   color="#818cf8" />
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
            <div style={{ marginBottom: '12px' }}>
              <ChartCard
                title={`${tab.label} — ${periodLabel}`}
                option={primaryOption as any}
                alternativeOptions={altOptions as any}
                defaultType={defaultChartType as any}
                sortOptions={REPORTS_SORT_OPTIONS}
                currentSort={chartSort}
                onSortChange={setChartSort}
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
              maxHeight="calc(100vh - 500px)"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportsPage;