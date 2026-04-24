import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

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
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const lowerQuery = searchQuery.toLowerCase();
    return data.filter(row => 
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(lowerQuery))
    );
  }, [data, columns, searchQuery]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filteredData, sortKey, sortDir]);

  const renderTable = (isExpanded: boolean) => (
    <div style={{ overflowY: 'auto', flex: 1, maxHeight: isExpanded ? 'calc(100vh - 100px)' : maxHeight }}>
      <table className="data-table" style={isExpanded ? { fontSize: '15px' } : undefined}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ 
                  width: col.width, 
                  cursor: col.sortable ? 'pointer' : 'default', 
                  textAlign: col.align,
                  fontSize: isExpanded ? '13px' : undefined,
                  padding: isExpanded ? '18px 24px' : undefined
                }}
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
          {sorted.length > 0 ? (
            sorted.map((row, i) => (
              <tr key={i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map(col => (
                  <td 
                    key={col.key} 
                    style={{ 
                      textAlign: col.align, 
                      padding: isExpanded ? '18px 24px' : undefined 
                    }}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const overlayContent = expanded ? (
    <div className="chart-overlay" style={{ zIndex: 9999 }}>
      <div className="chart-overlay-header" style={{ padding: '16px 40px', gap: '20px' }}>
        <span className="chart-overlay-title" style={{ fontSize: '1.2rem', fontWeight: 600, flexShrink: 0 }}>
          {title}
          <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '12px' }}>
            ({sorted.length} record{sorted.length !== 1 ? 's' : ''})
          </span>
        </span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ width: '280px', position: 'relative' }}>
            <input 
              type="text"
              placeholder="Search in table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px 16px 8px 36px', 
                borderRadius: '6px', 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid var(--border)', 
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary-light)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button className="chart-overlay-close" onClick={() => { setExpanded(false); setSearchQuery(''); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
      </div>
      <div className="chart-overlay-body" style={{ display: 'flex', flexDirection: 'column', padding: '0 40px 20px 40px', maxWidth: '1600px', margin: '0 auto', width: '100%', alignItems: 'stretch' }}>
        {renderTable(true)}
      </div>
    </div>
  ) : null;

  return (
    <>
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
      {expanded && typeof document !== 'undefined' && createPortal(overlayContent, document.body)}
    </>
  );
}