import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, Column } from '@/components/data/DataTable';
import { getDistrictBarOptions, getStackedBarOptions } from '@/components/charts/Charts';
import { dashboardApi } from '@/services/api';
import { useFilters } from '@/contexts/FilterContext';

const PREVIEW_COUNT = 5;

export const HotspotsPage = () => {
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const { activeFilters } = useFilters();

  const { data: dd, isLoading: dl } = useQuery({
    queryKey: ['dashboard', 'district', activeFilters],
    queryFn: () => dashboardApi.districtWise(activeFilters),
  });

  const { data: cd, isLoading: cl } = useQuery({
    queryKey: ['dashboard', 'category', activeFilters],
    queryFn: () => dashboardApi.categoryWise(activeFilters),
  });

  const allDistrictRows = ((dd?.data || []) as any[]).map(r => ({
    ...r,
    pendPct: r.total > 0 ? (r.pending / r.total) * 100 : 0
  }));
  const allCategoryRows = ((cd?.data || []) as any[]).map(r => ({
    ...r,
    pendPct: r.total > 0 ? (r.pending / r.total) * 100 : 0
  }));

  const districtRows = showAllDistricts ? allDistrictRows : allDistrictRows.slice(0, PREVIEW_COUNT);
  const categoryRows = showAllCategories ? allCategoryRows : allCategoryRows.slice(0, PREVIEW_COUNT);

  const districtCols: Column<typeof allDistrictRows[0]>[] = [
    { key: 'district', label: 'District', sortable: true },
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
    { key: 'pending', label: 'Pending', sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'right' },
    { key: 'pendPct', label: 'Pending %', sortable: true, align: 'center' },
  ];

  const categoryCols: Column<typeof allCategoryRows[0]>[] = [
    { key: 'category', label: 'Complaint Type', sortable: true },
    { key: 'total', label: 'Total', sortable: true, align: 'right' },
    { key: 'pending', label: 'Pending', sortable: true, align: 'right' },
    { key: 'disposed', label: 'Disposed', sortable: true, align: 'right' },
    { key: 'pendPct', label: 'Pending %', sortable: true, align: 'center' },
  ];

  const renderTableData = (c: any, row: any) => {
    if (c.key === 'district' || c.key === 'category') return <span style={{ fontWeight: 500, fontSize: '13px' }}>{String(row[c.key])}</span>;
    if (c.key === 'total') return <span style={{ fontWeight: 600 }}>{row.total.toLocaleString()}</span>;
    if (c.key === 'pending') return <span style={{ color: '#fbbf24', fontWeight: 500 }}>{row.pending.toLocaleString()}</span>;
    if (c.key === 'disposed') return <span style={{ color: '#34d399', fontWeight: 500 }}>{row.disposed.toLocaleString()}</span>;
    if (c.key === 'pendPct') {
      const pct = row.total > 0 ? Math.round((row.pending / row.total) * 100) + '%' : '0%';
      return <span className="status-badge pending">{pct}</span>;
    }
    return String(row[c.key] ?? '-');
  };

  return (
    <Layout>
      <div className="page-content">
        {dl || cl ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <ChartCard
                title="District-wise Hotspots"
                option={getDistrictBarOptions(allDistrictRows.slice(0, 10))}
                height="320px"
              />
              <ChartCard
                title="Complaint Type Hotspots"
                option={getStackedBarOptions(allCategoryRows.slice(0, 10))}
                height="320px"
              />
            </div>

            {/* Side-by-side adaptive table grid */}
            <div className="highlights-tables-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>

              {/* LEFT: District wise */}
              <div className="highlights-section">
                <div className="highlights-section-header">
                  <div>
                    <h3 className="highlights-section-title">District-wise Hotspots</h3>
                    <span className="highlights-section-meta">
                      {districtRows.length} of {allDistrictRows.length} shown
                    </span>
                  </div>
                  {allDistrictRows.length > PREVIEW_COUNT && (
                    <button
                      className={`show-all-btn ${showAllDistricts ? 'expanded' : ''}`}
                      onClick={() => setShowAllDistricts(!showAllDistricts)}
                    >
                      <span>{showAllDistricts ? 'Less' : `All ${allDistrictRows.length}`}</span>
                      <svg
                        width="14" height="14" fill="none" viewBox="0 0 24 24"
                        style={{ transition: 'transform 0.3s ease', transform: showAllDistricts ? 'rotate(180deg)' : 'none' }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div
                  className="highlights-table-wrapper"
                  style={{
                    maxHeight: showAllDistricts ? '620px' : `${PREVIEW_COUNT * 52 + 48}px`,
                    transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowY: showAllDistricts ? 'auto' : 'hidden',
                  }}
                >
                  <DataTable
                    title="District-wise Hotspots"
                    data={districtRows}
                    columns={districtCols.map(c => ({
                      ...c,
                      render: (row) => renderTableData(c, row),
                    }))}
                    maxHeight="none"
                  />
                </div>
              </div>

              {/* RIGHT: Type of complaint wise */}
              <div className="highlights-section">
                <div className="highlights-section-header">
                  <div>
                    <h3 className="highlights-section-title">Complaint Type Hotspots</h3>
                    <span className="highlights-section-meta">
                      {categoryRows.length} of {allCategoryRows.length} shown
                    </span>
                  </div>
                  {allCategoryRows.length > PREVIEW_COUNT && (
                    <button
                      className={`show-all-btn ${showAllCategories ? 'expanded' : ''}`}
                      onClick={() => setShowAllCategories(!showAllCategories)}
                    >
                      <span>{showAllCategories ? 'Less' : `All ${allCategoryRows.length}`}</span>
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
                    title="Complaint Type Hotspots"
                    data={categoryRows}
                    columns={categoryCols.map(c => ({
                      ...c,
                      render: (row) => renderTableData(c, row),
                    }))}
                    maxHeight="none"
                  />
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default HotspotsPage;