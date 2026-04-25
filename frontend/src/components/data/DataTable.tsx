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
  isLoading?: boolean;
  skeletonRows?: number;
}

// ── Skeleton row ────────────────────────────────────────────────────────────
const Skeleton = ({ cols, rows = 6 }: { cols: number; rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} style={{ padding: '12px 14px' }}>
            <div style={{
              height: '12px', borderRadius: '6px',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              width: j === 0 ? '70%' : '50%',
            }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export function DataTable<T extends Record<string, unknown>>({
  data, columns, maxHeight = 'calc(100vh - 220px)',
  onRowClick, title = 'Data View', isLoading = false, skeletonRows = 7,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(row => columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(q)));
  }, [data, columns, search]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      
      const numA = typeof av === 'number' ? av : (typeof av === 'string' && av.endsWith('%') ? parseFloat(av) : NaN);
      const numB = typeof bv === 'number' ? bv : (typeof bv === 'string' && bv.endsWith('%') ? parseFloat(bv) : NaN);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const thStyle = (col: Column<T>): React.CSSProperties => ({
    padding: '10px 14px',
    textAlign: col.align ?? 'left',
    fontSize: '11px', fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(15,23,42,0.8)',
    cursor: col.sortable ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
    userSelect: 'none',
    width: col.width,
  });

  const renderTable = (isFullscreen: boolean) => (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, maxHeight: isFullscreen ? '100%' : maxHeight, minHeight: '300px' }}>
      <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={thStyle(col)} onClick={() => col.sortable && handleSort(col.key)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {col.label}
                  {col.sortable && (
                    <span style={{ fontSize: '9px', opacity: sortKey === col.key ? 1 : 0.3, color: sortKey === col.key ? '#818cf8' : '#64748b' }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <Skeleton cols={columns.length} rows={skeletonRows} />
          ) : sorted.length > 0 ? (
            sorted.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '10px 14px', textAlign: col.align ?? 'left', fontSize: '13px', color: '#cbd5e1', wordBreak: 'break-word', whiteSpace: 'normal', minWidth: col.width || 'auto' }}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px', color: '#334155' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span style={{ fontSize: '13px' }}>No records found</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div style={{
        background: 'rgba(13,20,38,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Table header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(15,23,42,0.6)',
          flexWrap: 'wrap', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#6366f1', borderRadius: '2px' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{title}</span>
            {!isLoading && (
              <span style={{ fontSize: '11px', color: '#334155', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px' }}>
                {sorted.length} records
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '5px 10px 5px 28px',
                  borderRadius: '7px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0', fontSize: '12px',
                  outline: 'none', width: '160px',
                }}
              />
              <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            {/* Expand */}
            <button
              onClick={() => setExpanded(true)}
              style={{ padding: '5px 10px', borderRadius: '7px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              Fullscreen
            </button>
          </div>
        </div>
        {renderTable(false)}
      </div>

      {/* Fullscreen overlay */}
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
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>{title}</span>
              <span style={{ fontSize: '12px', color: '#334155' }}>{sorted.length} records</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" placeholder="Search…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ padding: '7px 12px 7px 32px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '240px' }}
                />
                <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <button
                onClick={() => { setExpanded(false); setSearch(''); }}
                style={{ padding: '7px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Close
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            {renderTable(true)}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}