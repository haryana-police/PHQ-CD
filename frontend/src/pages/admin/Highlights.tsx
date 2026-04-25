import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getPieOptions, getStackedBarOptions } from '@/components/charts/Charts';

const CY = new Date().getFullYear();
const PREVIEW_COUNT = 8;

export const HighlightsPage = () => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllNature, setShowAllNature] = useState(false);
  const [year, setYear] = useState(CY - 1);
  const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

  const { data: hd, isLoading: hl } = useQuery({
    queryKey: ['reports', 'highlights', year],
    queryFn: async () => {
      const r = await fetch(`/api/reports/highlights?year=${year}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const { data: nd, isLoading: nl } = useQuery({
    queryKey: ['reports', 'nature', year],
    queryFn: async () => {
      const r = await fetch(`/api/reports/nature-incident?year=${year}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const highlights = (hd?.data?.rows ?? hd?.data ?? []) as Record<string, unknown>[];
  const natures    = (nd?.data?.rows ?? nd?.data ?? []) as Record<string, unknown>[];

  const allTopRows = highlights.map((r, i) => ({
    rank: i + 1,
    name: String(r.category || `Item ${i + 1}`),
    count: Number(r.count || 0),
  }));

  const allNatureRows = natures.map((r, i) => {
    const tot = Number(r.total || 0);
    const p = Number(r.pending || 0);
    const d = Number(r.disposed || 0);
    return {
      name: String(r.natureOfIncident || `Item ${i + 1}`),
      total: tot,
      pending: p,
      disposed: d,
      pendPct: tot > 0 ? Math.round((p / tot) * 100) + '%' : '0%',
      dispPct: tot > 0 ? Math.round((d / tot) * 100) + '%' : '0%',
    };
  });

  const topRows = showAllCategories ? allTopRows : allTopRows.slice(0, PREVIEW_COUNT);
  const natureRows = showAllNature ? allNatureRows : allNatureRows.slice(0, PREVIEW_COUNT);

  const catCols: Column<typeof allTopRows[0]>[] = [
    { key: 'rank', label: '#', width: '50px', align: 'center' },
    { key: 'name', label: 'Category', sortable: true },
    { key: 'count', label: 'Total Count', sortable: true, align: 'right' },
  ];

  const natureCols: Column<typeof allNatureRows[0]>[] = [
    { key: 'name', label: 'Incident Type', sortable: true },
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
    { key: 'pending', label: 'Pending', sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'right' },
    { key: 'pendPct', label: 'Pending %', sortable: true, align: 'center' },
    { key: 'dispPct', label: 'Disposed %', sortable: true, align: 'center' },
  ];

  return (
    <Layout>
      <div className="page-content">
        {/* Header with year filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Highlights</h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>Top categories and incident type breakdown</p>
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ appearance: 'none', padding: '7px 30px 7px 14px', borderRadius: '8px', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', border: '1px solid rgba(99,102,241,0.25)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <svg style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#6366f1' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
          {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <ChartCard title={`Top Categories · ${year}`} isLoading={hl}
            option={getPieOptions(allTopRows.slice(0, 10).map(r => ({ name: r.name, value: r.count })))}
            height="280px" />
          <ChartCard title={`Nature of Incidents · ${year}`} isLoading={nl}
            option={getStackedBarOptions(allNatureRows.slice(0, 10).map(r => ({ category: r.name, total: r.total, pending: r.pending, disposed: r.disposed })))}
            height="280px" />
        </div>

            {/* Side-by-side adaptive table grid */}
            <div className="highlights-tables-grid">

              {/* LEFT: Top Categories (narrow — 3 columns) */}
              <div className="highlights-section">
                <div className="highlights-section-header">
                  <div>
                    <h3 className="highlights-section-title">Top Categories</h3>
                    <span className="highlights-section-meta">
                      {topRows.length} of {allTopRows.length} shown
                    </span>
                  </div>
                  {allTopRows.length > PREVIEW_COUNT && (
                    <button
                      className={`show-all-btn ${showAllCategories ? 'expanded' : ''}`}
                      onClick={() => setShowAllCategories(!showAllCategories)}
                    >
                      <span>{showAllCategories ? 'Less' : `All ${allTopRows.length}`}</span>
                      <svg
                        width="14" height="14" fill="none" viewBox="0 0 24 24"
                        style={{ transition: 'transform 0.3s ease', transform: showAllCategories ? 'rotate(180deg)' : 'none' }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div
                  className="highlights-table-wrapper"
                  style={{
                    maxHeight: showAllCategories ? '620px' : `${PREVIEW_COUNT * 52 + 48}px`,
                    transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowY: showAllCategories ? 'auto' : 'hidden',
                  }}
                >
                  <DataTable
                    title="Top Complaint Categories"
                    data={topRows}
                    columns={catCols.map(c => ({
                      ...c,
                      render: (row: any) => {
                        if (c.key === 'rank') return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '26px', height: '26px', borderRadius: '50%',
                            background: row.rank <= 3 ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.05)',
                            color: row.rank <= 3 ? '#fff' : 'var(--text-secondary)',
                            fontSize: '11px', fontWeight: 700,
                          }}>{row.rank}</span>
                        );
                        if (c.key === 'name') return <span style={{ fontWeight: 500, fontSize: '13px' }}>{String(row.name)}</span>;
                        if (c.key === 'count') return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <div style={{ height: '5px', width: '60px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                width: `${allTopRows[0]?.count > 0 ? (row.count / allTopRows[0].count) * 100 : 0}%`,
                                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                              }} />
                            </div>
                            <span style={{ fontWeight: 600, minWidth: '36px', textAlign: 'right', fontSize: '13px' }}>{row.count.toLocaleString()}</span>
                          </div>
                        );
                        return String(row[c.key as keyof typeof row] ?? '-');
                      },
                    }))}
                    maxHeight="none"
                  />
                </div>
              </div>

              {/* RIGHT: Nature of Incidents (wide — 6 columns) */}
              <div className="highlights-section">
                <div className="highlights-section-header">
                  <div>
                    <h3 className="highlights-section-title">Nature of Incidents</h3>
                    <span className="highlights-section-meta">
                      {natureRows.length} of {allNatureRows.length} shown
                    </span>
                  </div>
                  {allNatureRows.length > PREVIEW_COUNT && (
                    <button
                      className={`show-all-btn ${showAllNature ? 'expanded' : ''}`}
                      onClick={() => setShowAllNature(!showAllNature)}
                    >
                      <span>{showAllNature ? 'Less' : `All ${allNatureRows.length}`}</span>
                      <svg
                        width="14" height="14" fill="none" viewBox="0 0 24 24"
                        style={{ transition: 'transform 0.3s ease', transform: showAllNature ? 'rotate(180deg)' : 'none' }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div
                  className="highlights-table-wrapper"
                  style={{
                    maxHeight: showAllNature ? '620px' : `${PREVIEW_COUNT * 52 + 48}px`,
                    transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowY: showAllNature ? 'auto' : 'hidden',
                  }}
                >
                  <DataTable
                    title="Nature of Incidents"
                    data={natureRows}
                    columns={natureCols.map(c => ({
                      ...c,
                      render: (row: any) => {
                        if (c.key === 'name') return <span style={{ fontWeight: 500, fontSize: '13px' }}>{String(row.name)}</span>;
                        if (c.key === 'total') return <span style={{ fontWeight: 600 }}>{row.total.toLocaleString()}</span>;
                        if (c.key === 'pending') return <span style={{ color: '#fbbf24', fontWeight: 500 }}>{row.pending.toLocaleString()}</span>;
                        if (c.key === 'disposed') return <span style={{ color: '#34d399', fontWeight: 500 }}>{row.disposed.toLocaleString()}</span>;
                        if (c.key === 'pendPct') return <span className="status-badge pending">{String(row.pendPct)}</span>;
                        if (c.key === 'dispPct') return <span className="status-badge disposed">{String(row.dispPct)}</span>;
                        return String(row[c.key as keyof typeof row] ?? '-');
                      },
                    }))}
                    maxHeight="none"
                  />
                </div>
              </div>
            </div>

      </div>
    </Layout>
  );
};

export default HighlightsPage;