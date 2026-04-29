import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from '@/components/layout/Layout';
import { usePendencyMatrix, useDisposalMatrix } from '@/hooks/useData';
import { GlobalFilterBar } from '@/components/common/GlobalFilterBar';
import { Select } from '@/components/common/Select';


const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n: number) => n.toLocaleString('en-IN');

function HeatCell({ value, max, color }: { value: number; max: number; color: string }) {
  const intensity = max > 0 ? Math.min(value / max, 1) : 0;
  const alpha = 0.08 + intensity * 0.55;
  return (
    <td style={{
      padding: '9px 14px', textAlign: 'right', fontSize: '12.5px',
      fontWeight: value > 0 ? 600 : 400,
      color: value > 0 ? '#f1f5f9' : '#334155',
      background: value > 0 ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition: 'background 0.2s',
    }}>
      {value > 0 ? fmtNum(value) : '—'}
    </td>
  );
}

function SummaryKpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      borderRadius: '10px', padding: '14px 18px',
      background: `linear-gradient(135deg, ${color})`,
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.75)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{typeof value === 'number' ? fmtNum(value) : value}</div>
      {sub && <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.6)', marginTop: '3px' }}>{sub}</div>}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%)', pointerEvents: 'none' }} />
    </div>
  );
}

// ── Tab toggle ─────────────────────────────────────────────────────────────
type Tab = 'pendency' | 'disposal';
type SortCol = 'district' | 'within7' | 'within15' | 'within30' | 'over30' | 'totalPending' | 'totalDisposed' | 'avgDisposalDays' | 'totalReceived';

// ── Skeleton table ─────────────────────────────────────────────────────────
function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '10px 14px' }}>
              <div style={{
                height: '12px', borderRadius: '6px', width: j === 0 ? '65%' : '45%',
                background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export const PendencyDisposalMatrixPage = () => {
  const [year, setYear] = useState(CY);
  const [tab, setTab] = useState<Tab>('pendency');
  const [expanded, setExpanded] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('district');
  const [sortDesc, setSortDesc] = useState(false);

  // All filters — all passed to API
  const [districtFilter,      setDistrictFilter]      = useState<string[]>([]);
  const [sourceFilter,        setSourceFilter]        = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const matrixFilters = {
    year:          fromDate ? undefined : year,
    fromDate:      fromDate || undefined,
    toDate:        toDate   || undefined,
    district:      districtFilter.length      > 0 ? districtFilter      : undefined,
    source:        sourceFilter.length        > 0 ? sourceFilter        : undefined,
    complaintType: complaintTypeFilter.length > 0 ? complaintTypeFilter : undefined,
  };

  const { data: pData, isLoading: pLoading } = usePendencyMatrix(matrixFilters);
  const { data: dData, isLoading: dLoading } = useDisposalMatrix(matrixFilters);

  // No client-side filtering — server applies all filters
  const pRows: any[] = pData?.data?.rows ?? [];
  const dRows: any[] = dData?.data?.rows ?? [];


  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(col !== 'district'); // default numeric to desc
    }
  };

  const sortFn = (a: any, b: any) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : 1;
    return sortDesc ? -cmp : cmp;
  };

  const sortedPRows = [...pRows].sort(sortFn);
  const sortedDRows = [...dRows].sort(sortFn);

  const pTotals = pData?.data?.totals ?? {};
  const dTotals = dData?.data?.totals ?? {};

  // heat-map maxima
  const pMax7  = Math.max(...pRows.map((r: any) => r.within7  || 0), 1);
  const pMax15 = Math.max(...pRows.map((r: any) => r.within15 || 0), 1);
  const pMax30 = Math.max(...pRows.map((r: any) => r.within30 || 0), 1);
  const pMaxO  = Math.max(...pRows.map((r: any) => r.over30   || 0), 1);
  const dMax7  = Math.max(...dRows.map((r: any) => r.within7  || 0), 1);
  const dMax15 = Math.max(...dRows.map((r: any) => r.within15 || 0), 1);
  const dMax30 = Math.max(...dRows.map((r: any) => r.within30 || 0), 1);
  const dMaxO  = Math.max(...dRows.map((r: any) => r.over30   || 0), 1);

  const isLoading = tab === 'pendency' ? pLoading : dLoading;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 22px', borderRadius: '8px', fontSize: '13px',
    fontWeight: active ? 700 : 400, cursor: 'pointer', border: 'none',
    color: active ? '#a5b4fc' : '#64748b',
    background: active
      ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.1))'
      : 'rgba(255,255,255,0.03)',
    outline: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.15s',
  });

  const SortTh = ({ col, label, style = {} }: { col: SortCol, label: string, style?: React.CSSProperties }) => (
    <th 
      style={{ ...thS(style), cursor: 'pointer', userSelect: 'none' }}
      onClick={() => handleSort(col)}
      title={`Sort by ${label}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: style.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {label}
          <span style={{ fontSize: '9px', opacity: sortCol === col ? 1 : 0.3, color: sortCol === col ? '#818cf8' : '#64748b' }}>
            {sortCol === col ? (sortDesc ? '▼' : '▲') : '⇅'}
          </span>
        </span>
      </div>
    </th>
  );

  return (
    <Layout>
      <div className="page-content">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Pendency &amp; Disposal Matrix</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>District-wise aging analysis · Haryana Police</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>Year:</span>
            <Select
              value={year}
              onChange={v => setYear(Number(v))}
              options={YEARS.map(y => ({ value: y, label: y }))}
              width="90px"
            />
          </div>

        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{
            display: 'flex', gap: '6px',
            background: 'rgba(19,32,53,0.5)', borderRadius: '10px',
            padding: '6px', width: 'fit-content',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button style={tabStyle(tab === 'pendency')} onClick={() => setTab('pendency')}>
              ⏳ Pendency Matrix
            </button>
            <button style={tabStyle(tab === 'disposal')} onClick={() => setTab('disposal')}>
              ✅ Disposal Matrix
            </button>
          </div>
        </div>

        {/* ── Global Filter Bar — ALL filters to API ── */}
        <GlobalFilterBar
          fromDate={fromDate} toDate={toDate}
          onFromDateChange={setFromDate} onToDateChange={setToDate}
          districtFilter={districtFilter}      onDistrictChange={setDistrictFilter}
          sourceFilter={sourceFilter}          onSourceChange={setSourceFilter}
          complaintTypeFilter={complaintTypeFilter} onComplaintTypeChange={setComplaintTypeFilter}
          onClearAll={() => {
            setDistrictFilter([]); setSourceFilter([]); setComplaintTypeFilter([]);
            setFromDate(''); setToDate('');
          }}
        />

        {/* ── KPI summary cards ───────────────────────────────────────── */}
        {tab === 'pendency' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '18px' }}>
            <SummaryKpi label="Total Received" value={pTotals.totalReceived ?? 0} color="#6a11cb,#2575fc" />
            <SummaryKpi label="Total Pending" value={pTotals.totalPending ?? 0} color="#ff416c,#ff4b2b"
              sub={pTotals.totalReceived ? `${((pTotals.totalPending / pTotals.totalReceived) * 100).toFixed(1)}% of received` : ''} />
            <SummaryKpi label="≤7 Days" value={pTotals.within7 ?? 0} color="#11998e,#38ef7d" />
            <SummaryKpi label="8–15 Days" value={pTotals.within15 ?? 0} color="#f7971e,#ffd200" />
            <SummaryKpi label="16–30 Days" value={pTotals.within30 ?? 0} color="#ee0979,#ff6a00" />
            <SummaryKpi label=">30 Days" value={pTotals.over30 ?? 0} color="#283c86,#45a247" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '18px' }}>
            <SummaryKpi label="Total Received" value={dTotals.totalReceived ?? 0} color="#6a11cb,#2575fc" />
            <SummaryKpi label="Total Disposed" value={dTotals.totalDisposed ?? 0} color="#11998e,#38ef7d"
              sub={dTotals.totalReceived ? `${((dTotals.totalDisposed / dTotals.totalReceived) * 100).toFixed(1)}% disposal rate` : ''} />
            <SummaryKpi label="≤7 Days" value={dTotals.within7 ?? 0} color="#11998e,#38ef7d" />
            <SummaryKpi label="8–15 Days" value={dTotals.within15 ?? 0} color="#f7971e,#ffd200" />
            <SummaryKpi label="16–30 Days" value={dTotals.within30 ?? 0} color="#ee0979,#ff6a00" />
            <SummaryKpi label=">30 Days" value={dTotals.over30 ?? 0} color="#283c86,#45a247" />
            <SummaryKpi
              label="Avg Disposal Time"
              value={dTotals.avgDisposalDays != null ? `${dTotals.avgDisposalDays} days` : '—'}
              color="#667eea,#764ba2"
              sub="across all disposed"
            />
          </div>
        )}

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#475569' }}>Heat intensity:</span>
          {[
            { label: 'Low', bg: 'rgba(99,102,241,0.15)' },
            { label: 'Med', bg: 'rgba(99,102,241,0.40)' },
            { label: 'High', bg: 'rgba(99,102,241,0.65)' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.bg, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>

        {/* ── Matrix Table ─────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(13,20,38,0.7)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px', overflow: 'hidden', backdropFilter: 'blur(12px)',
        }}>
          {/* Table header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(15,23,42,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: '#6366f1', borderRadius: '2px' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                {tab === 'pendency' ? 'District-wise Pendency Aging' : 'District-wise Disposal Speed'} · {year}
              </span>
              {!isLoading && (
                <span style={{ fontSize: '11px', color: '#334155', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px' }}>
                  {tab === 'pendency' ? pRows.length : dRows.length} districts
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: '#334155' }}>Haryana Police · PHQ</span>
              <button
                onClick={() => setExpanded(true)}
                style={{ padding: '6px', borderRadius: '7px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Fullscreen"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr>
                  <SortTh col="district" label="District" style={{ textAlign: 'left', width: '180px' }} />
                  <SortTh col="within7" label="≤7 Days" style={{ textAlign: 'right' }} />
                  <SortTh col="within15" label="8–15 Days" style={{ textAlign: 'right' }} />
                  <SortTh col="within30" label="16–30 Days" style={{ textAlign: 'right' }} />
                  <SortTh col="over30" label=">30 Days" style={{ textAlign: 'right' }} />
                  {tab === 'pendency'
                    ? <SortTh col="totalPending" label="Total Pending" style={{ textAlign: 'right', color: '#f87171' }} />
                    : <>
                        <SortTh col="totalDisposed" label="Total Disposed" style={{ textAlign: 'right', color: '#34d399' }} />
                        <SortTh col="avgDisposalDays" label="Avg Days" style={{ textAlign: 'right', color: '#a78bfa' }} />
                      </>
                  }
                  <SortTh col="totalReceived" label="Total Received" style={{ textAlign: 'right', color: '#94a3b8' }} />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton cols={tab === 'pendency' ? 6 : 7} />
                ) : tab === 'pendency' ? (
                  <>
                    {sortedPRows.map((r: any, i: number) => (
                      <tr key={i}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                      >
                        <td style={{ padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                          {r.district}
                        </td>
                        <HeatCell value={r.within7}  max={pMax7}  color="#10b981" />
                        <HeatCell value={r.within15} max={pMax15} color="#f59e0b" />
                        <HeatCell value={r.within30} max={pMax30} color="#f97316" />
                        <HeatCell value={r.over30}   max={pMaxO}  color="#ef4444" />
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: '#f87171', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {fmtNum(r.totalPending)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {fmtNum(r.totalReceived)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {pRows.length > 0 && (
                      <tr style={{ background: 'rgba(99,102,241,0.08)', borderTop: '2px solid rgba(99,102,241,0.25)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 700, color: '#a5b4fc' }}>TOTAL</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#34d399' }}>{fmtNum(pTotals.within7 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fbbf24' }}>{fmtNum(pTotals.within15 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fb923c' }}>{fmtNum(pTotals.within30 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#f87171' }}>{fmtNum(pTotals.over30 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#f87171' }}>{fmtNum(pTotals.totalPending ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#94a3b8' }}>{fmtNum(pTotals.totalReceived ?? 0)}</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <>
                    {sortedDRows.map((r: any, i: number) => (
                      <tr key={i}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                      >
                        <td style={{ padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                          {r.district}
                        </td>
                        <HeatCell value={r.within7}  max={dMax7}  color="#10b981" />
                        <HeatCell value={r.within15} max={dMax15} color="#f59e0b" />
                        <HeatCell value={r.within30} max={dMax30} color="#f97316" />
                        <HeatCell value={r.over30}   max={dMaxO}  color="#ef4444" />
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: '#34d399', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {fmtNum(r.totalDisposed)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#a78bfa', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {r.avgDisposalDays != null ? `${r.avgDisposalDays}d` : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {fmtNum(r.totalReceived)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {dRows.length > 0 && (
                      <tr style={{ background: 'rgba(99,102,241,0.08)', borderTop: '2px solid rgba(99,102,241,0.25)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 700, color: '#a5b4fc' }}>TOTAL</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#34d399' }}>{fmtNum(dTotals.within7 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fbbf24' }}>{fmtNum(dTotals.within15 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fb923c' }}>{fmtNum(dTotals.within30 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#f87171' }}>{fmtNum(dTotals.over30 ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#34d399' }}>{fmtNum(dTotals.totalDisposed ?? 0)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#a78bfa' }}>
                          {dTotals.avgDisposalDays != null ? `${dTotals.avgDisposalDays}d` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#94a3b8' }}>{fmtNum(dTotals.totalReceived ?? 0)}</td>
                      </tr>
                    )}
                  </>
                )}

                {/* Empty state */}
                {!isLoading && (tab === 'pendency' ? pRows.length : dRows.length) === 0 && (
                  <tr>
                    <td colSpan={tab === 'pendency' ? 6 : 7} style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span style={{ fontSize: '13px' }}>No data for {year}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p style={{ marginTop: '12px', fontSize: '11px', color: '#334155', textAlign: 'right' }}>
          * Age buckets are calculated from registration date to today (pendency) or to disposal date (disposal). Only Haryana's 22 districts shown.
        </p>
      </div>

      {/* ── Fullscreen Overlay ─────────────────────────────────────── */}
      {expanded && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(6,13,26,0.98)',
          backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(13,20,38,0.9)', flexWrap: 'wrap', gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '3px', height: '18px', background: '#6366f1', borderRadius: '2px' }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                {tab === 'pendency' ? 'District-wise Pendency Aging' : 'District-wise Disposal Speed'} · {year}
              </span>
              {!isLoading && (
                <span style={{ fontSize: '12px', color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '4px' }}>
                  {tab === 'pendency' ? pRows.length : dRows.length} districts
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setExpanded(false)}
                style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close Fullscreen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '24px' }}>
            <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr>
                    <SortTh col="district" label="District" style={{ textAlign: 'left', width: '180px' }} />
                    <SortTh col="within7" label="≤7 Days" style={{ textAlign: 'right' }} />
                    <SortTh col="within15" label="8–15 Days" style={{ textAlign: 'right' }} />
                    <SortTh col="within30" label="16–30 Days" style={{ textAlign: 'right' }} />
                    <SortTh col="over30" label=">30 Days" style={{ textAlign: 'right' }} />
                    {tab === 'pendency'
                      ? <SortTh col="totalPending" label="Total Pending" style={{ textAlign: 'right', color: '#f87171' }} />
                      : <>
                          <SortTh col="totalDisposed" label="Total Disposed" style={{ textAlign: 'right', color: '#34d399' }} />
                          <SortTh col="avgDisposalDays" label="Avg Days" style={{ textAlign: 'right', color: '#a78bfa' }} />
                        </>
                    }
                    <SortTh col="totalReceived" label="Total Received" style={{ textAlign: 'right', color: '#94a3b8' }} />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton cols={tab === 'pendency' ? 6 : 7} />
                  ) : tab === 'pendency' ? (
                    <>
                      {sortedPRows.map((r: any, i: number) => (
                        <tr key={i}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                        >
                          <td style={{ padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                            {r.district}
                          </td>
                          <HeatCell value={r.within7}  max={pMax7}  color="#10b981" />
                          <HeatCell value={r.within15} max={pMax15} color="#f59e0b" />
                          <HeatCell value={r.within30} max={pMax30} color="#f97316" />
                          <HeatCell value={r.over30}   max={pMaxO}  color="#ef4444" />
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: '#f87171', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {fmtNum(r.totalPending)}
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {fmtNum(r.totalReceived)}
                          </td>
                        </tr>
                      ))}
                      {pRows.length > 0 && (
                        <tr style={{ background: 'rgba(99,102,241,0.08)', borderTop: '2px solid rgba(99,102,241,0.25)' }}>
                          <td style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 700, color: '#a5b4fc' }}>TOTAL</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#34d399' }}>{fmtNum(pTotals.within7 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fbbf24' }}>{fmtNum(pTotals.within15 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fb923c' }}>{fmtNum(pTotals.within30 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#f87171' }}>{fmtNum(pTotals.over30 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#f87171' }}>{fmtNum(pTotals.totalPending ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#94a3b8' }}>{fmtNum(pTotals.totalReceived ?? 0)}</td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <>
                      {sortedDRows.map((r: any, i: number) => (
                        <tr key={i}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                        >
                          <td style={{ padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>
                            {r.district}
                          </td>
                          <HeatCell value={r.within7}  max={dMax7}  color="#10b981" />
                          <HeatCell value={r.within15} max={dMax15} color="#f59e0b" />
                          <HeatCell value={r.within30} max={dMax30} color="#f97316" />
                          <HeatCell value={r.over30}   max={dMaxO}  color="#ef4444" />
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: '#34d399', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {fmtNum(r.totalDisposed)}
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#a78bfa', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {r.avgDisposalDays != null ? `${r.avgDisposalDays}d` : '—'}
                          </td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: '12.5px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {fmtNum(r.totalReceived)}
                          </td>
                        </tr>
                      ))}
                      {dRows.length > 0 && (
                        <tr style={{ background: 'rgba(99,102,241,0.08)', borderTop: '2px solid rgba(99,102,241,0.25)' }}>
                          <td style={{ padding: '10px 14px', fontSize: '12.5px', fontWeight: 700, color: '#a5b4fc' }}>TOTAL</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#34d399' }}>{fmtNum(dTotals.within7 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fbbf24' }}>{fmtNum(dTotals.within15 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#fb923c' }}>{fmtNum(dTotals.within30 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#f87171' }}>{fmtNum(dTotals.over30 ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#34d399' }}>{fmtNum(dTotals.totalDisposed ?? 0)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#a78bfa' }}>
                            {dTotals.avgDisposalDays != null ? `${dTotals.avgDisposalDays}d` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: '#94a3b8' }}>{fmtNum(dTotals.totalReceived ?? 0)}</td>
                        </tr>
                      )}
                    </>
                  )}
                  {!isLoading && (tab === 'pendency' ? pRows.length : dRows.length) === 0 && (
                    <tr>
                      <td colSpan={tab === 'pendency' ? 6 : 7} style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <span style={{ fontSize: '13px' }}>No data for {year}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
};

// shared th style helper
function thS(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 14px',
    fontSize: '11px', fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#0f172a',
    whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
    userSelect: 'none',
    ...extra,
  };
}

export default PendencyDisposalMatrixPage;
