import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getDistrictBarOptions } from '@/components/charts/Charts';





import { Select } from '@/components/common/Select';
import { GlobalFilterBar } from '@/components/common/GlobalFilterBar';

const CY = new Date().getFullYear();
const TOP_PREVIEW_COUNT = 5;
const PREVIEW_COUNT = 8;



export const HighlightsPage = () => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllNature, setShowAllNature] = useState(false);
  const [year, setYear] = useState(CY);
  const [natureChartSort] = useState('Total Reg');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [natureFilter, setNatureFilter] = useState<string[]>([]);
  const YEARS = Array.from({ length: CY - 2014 + 1 }, (_, i) => CY - i);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [complaintTypeFilter, setComplaintTypeFilter] = useState<string[]>([]);

  const filters = useMemo(() => ({
    year,
    fromDate: fromDate || undefined,
    toDate:   toDate   || undefined,
    district: districtFilter.length > 0 ? districtFilter : undefined,
    source:   sourceFilter.length > 0   ? sourceFilter   : undefined,
    complaintType: complaintTypeFilter.length > 0 ? complaintTypeFilter : undefined,
  }), [year, fromDate, toDate, districtFilter, sourceFilter, complaintTypeFilter]);

  const buildQS = () => {
    const p = new URLSearchParams();
    if (fromDate && toDate) {
      p.set('fromDate', fromDate);
      p.set('toDate', toDate);
    } else {
      p.set('year', String(year));
    }
    if (districtFilter.length > 0)      p.set('district',      districtFilter.join(','));
    if (sourceFilter.length > 0)        p.set('source',        sourceFilter.join(','));
    if (complaintTypeFilter.length > 0) p.set('complaintType', complaintTypeFilter.join(','));
    return p.toString();
  };

  const { data: hd, isLoading: hl } = useQuery({
    queryKey: ['reports', 'highlights', filters],
    queryFn: async () => {
      const r = await fetch(`/api/reports/highlights?${buildQS()}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });



  const { data: nd, isLoading: nl } = useQuery({
    queryKey: ['reports', 'nature', filters],
    queryFn: async () => {
      const r = await fetch(`/api/reports/nature-incident?${buildQS()}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });




  const highlights      = (hd?.data?.rows    ?? (Array.isArray(hd?.data)    ? hd?.data    : [])) as Record<string, unknown>[];
  const natures         = (nd?.data?.rows    ?? (Array.isArray(nd?.data)    ? nd?.data    : [])) as Record<string, unknown>[];


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

  const sortedNatureRows = useMemo(() => {
    const arr = [...allNatureRows];
    switch (natureChartSort) {
      case 'Total Pending':
        arr.sort((a, b) => b.pending - a.pending);
        break;
      case 'Total Disposed':
        arr.sort((a, b) => b.disposed - a.disposed);
        break;
      case 'Pending %':
        arr.sort((a, b) => {
          const pA = a.total > 0 ? a.pending / a.total : 0;
          const pB = b.total > 0 ? b.pending / b.total : 0;
          return pB - pA;
        });
        break;
      case 'Disposed %':
        arr.sort((a, b) => {
          const dA = a.total > 0 ? a.disposed / a.total : 0;
          const dB = b.total > 0 ? b.disposed / b.total : 0;
          return dB - dA;
        });
        break;
      case 'Total Reg':
      default:
        arr.sort((a, b) => b.total - a.total);
    }
    return arr;
  }, [allNatureRows, natureChartSort]);

  // Tables show the FILTERED rows (applying categoryFilter/natureFilter client-side on top of server-filtered data)
  const topRows    = (categoryFilter.length > 0
    ? allTopRows.filter(r => categoryFilter.includes(r.name))
    : (showAllCategories ? allTopRows : allTopRows.slice(0, TOP_PREVIEW_COUNT)));

  const natureRows = (natureFilter.length > 0
    ? sortedNatureRows.filter(r => natureFilter.includes(r.name))
    : (showAllNature ? sortedNatureRows : sortedNatureRows.slice(0, PREVIEW_COUNT)));

  const categoryOptions = useMemo(
    () => allTopRows.map(r => ({ value: r.name, label: r.name })),
    [allTopRows]
  );



  const filteredNatureRows = useMemo(() => {
    let rows = [...sortedNatureRows];
    if (natureFilter.length > 0) rows = rows.filter(r => natureFilter.includes(r.name));
    return rows.slice(0, natureFilter.length > 0 ? 50 : 10);
  }, [sortedNatureRows, natureFilter]);

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
          <Select
            value={year}
            onChange={y => setYear(Number(y))}
            options={YEARS.map(y => ({ value: y, label: String(y) }))}
            width="100px"
          />
        </div>
        {/* ── Global Filter Bar — ABOVE charts ── */}
        <GlobalFilterBar
          fromDate={fromDate} toDate={toDate}
          onFromDateChange={setFromDate} onToDateChange={setToDate}
          districtFilter={districtFilter} onDistrictChange={setDistrictFilter}
          sourceFilter={sourceFilter} onSourceChange={setSourceFilter}
          complaintTypeFilter={complaintTypeFilter} onComplaintTypeChange={setComplaintTypeFilter}
          extraLabel="Category"
          extraOptions={categoryOptions}
          extraSelected={categoryFilter}
          onExtraChange={setCategoryFilter}
          showExtra={categoryOptions.length > 0}
          onClearAll={() => {
            setCategoryFilter([]); setNatureFilter([]);
            setSourceFilter([]); setDistrictFilter([]);
            setComplaintTypeFilter([]); setFromDate(''); setToDate('');
          }}
        />
        {/* Top Section: Chart + Top Categories Table */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px', alignItems: 'start' }}>

          <ChartCard
            title={`Top Categories · ${year}`}
            isLoading={hl || nl}
            height="340px"
            defaultType="horizontal"
            option={getDistrictBarOptions(
              filteredNatureRows.map(r => ({
                district: r.name,
                total: r.total,
                pending: r.pending,
                disposed: r.disposed,
              })),
              { horizontal: true }
            )}
          />

          {/* RIGHT: Top Categories (narrow — 3 columns) */}
          <div className="highlights-section" style={{ height: '100%' }}>
                <div className="highlights-section-header">
                  <div>
                    <h3 className="highlights-section-title">Top Categories</h3>
                    <span className="highlights-section-meta">
                      {topRows.length} of {allTopRows.length} shown
                    </span>
                  </div>
                  {allTopRows.length > TOP_PREVIEW_COUNT && (
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
                    maxHeight: showAllCategories ? '620px' : `${TOP_PREVIEW_COUNT * 52 + 48}px`,
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
            </div>

            {/* Bottom Section: Nature of Incidents Table (Full Width) */}
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
    </Layout>
  );
};

export default HighlightsPage;