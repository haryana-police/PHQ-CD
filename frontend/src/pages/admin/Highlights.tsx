import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getPieOptions, getStackedBarOptions } from '@/components/charts/Charts';

export const HighlightsPage = () => {
  const { data: hd, isLoading: hl } = useQuery({
    queryKey: ['reports', 'highlights'],
    queryFn: async () => {
      const r = await fetch('/api/reports/highlights', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const { data: nd, isLoading: nl } = useQuery({
    queryKey: ['reports', 'nature'],
    queryFn: async () => {
      const r = await fetch('/api/reports/nature-incident', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return r.json();
    },
  });

  const highlights = (hd?.data || []) as Record<string, unknown>[];
  const natures = (nd?.data || []) as Record<string, unknown>[];

  const topRows = highlights.slice(0, 10).map((r, i) => ({ name: String(r.category || `Item ${i + 1}`), count: Number(r.count || 0) }));

  const natureRows = natures.slice(0, 15).map((r, i) => {
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

  const natureCols: Column<typeof natureRows[0]>[] = [
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
        {hl || nl ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <ChartCard
                title="Top Categories"
                option={getPieOptions(topRows.map(r => ({ name: r.name, value: r.count })))}
                height="260px"
              />
              <ChartCard
                title="Nature of Incidents"
                option={getStackedBarOptions(natureRows.map(r => ({ category: r.name, total: r.total, pending: r.pending, disposed: r.disposed })))}
                height="260px"
              />
            </div>

            <DataTable
              data={natureRows}
              columns={natureCols.map(c => ({
                ...c,
                render: (row) => {
                  if (c.key === 'name') return <span style={{ fontWeight: 500 }}>{String(row.name)}</span>;
                  if (c.key === 'total') return <span style={{ fontWeight: 600 }}>{row.total}</span>;
                  if (c.key === 'pending') return <span style={{ color: '#fbbf24' }}>{row.pending}</span>;
                  if (c.key === 'disposed') return <span style={{ color: '#34d399' }}>{row.disposed}</span>;
                  if (c.key === 'pendPct') return <span style={{ color: '#fbbf24' }}>{String(row.pendPct)}</span>;
                  if (c.key === 'dispPct') return <span style={{ color: '#34d399' }}>{String(row.dispPct)}</span>;
                  return String(row[c.key as keyof typeof row] ?? '-');
                },
              }))}
              maxHeight="calc(100vh - 460px)"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default HighlightsPage;