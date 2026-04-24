import { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  maxHeight?: string;
  onRowClick?: (row: T) => void;
  title?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  maxHeight = 'calc(100vh - 220px)',
  onRowClick,
  title = 'Data View',
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir]);

  const renderTable = (isExpanded: boolean) => (
    <div style={{ overflowY: 'auto', flex: 1, maxHeight: isExpanded ? 'calc(100vh - 120px)' : maxHeight }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width, cursor: col.sortable ? 'pointer' : 'default', textAlign: col.align }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  {col.label}
                  {col.sortable && (
                    <span style={{ fontSize: '9px', opacity: sortKey === col.key ? 1 : 0.3 }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align }}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (expanded) {
    return (
      <div className="chart-overlay" style={{ zIndex: 1000 }}>
        <div className="chart-overlay-header">
          <span className="chart-overlay-title">{title}</span>
          <button className="chart-overlay-close" onClick={() => setExpanded(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
        <div className="chart-overlay-body" style={{ display: 'flex', flexDirection: 'column', padding: '0 20px 20px 20px' }}>
          {renderTable(true)}
        </div>
      </div>
    );
  }

  return (
    <div className="card data-table-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button 
        onClick={() => setExpanded(true)}
        className="table-expand-btn"
        title="Expand Table"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
      {renderTable(false)}
    </div>
  );
}