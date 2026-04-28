import { useState, useRef, useEffect } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  minWidth?: string;
  singleSelect?: boolean;
}

export const MultiSelectFilter = ({
  label,
  options,
  selected,
  onChange,
  minWidth = '160px',
  singleSelect = false,
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = selected.length === 0 || selected.length === options.length;
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (val: string) => {
    if (singleSelect) {
      if (selected.includes(val)) {
        onChange([]);
      } else {
        onChange([val]);
      }
      setOpen(false);
      return;
    }

    if (selected.includes(val)) {
      const next = selected.filter(v => v !== val);
      onChange(next);
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => onChange([]);
  const unselectAll = () => onChange(options.map(o => o.value));

  const displayLabel = () => {
    if (selected.length === 0 || selected.length === options.length)
      return `All ${label}s`;
    if (selected.length === 1)
      return options.find(o => o.value === selected[0])?.label ?? selected[0];
    return `${selected.length} ${label}s selected`;
  };

  const isActive = selected.length > 0 && selected.length < options.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', zIndex: open ? 9999 : 1 }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.7px', color: '#64748b',
      }}>
        {label}
      </span>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth }}>
        {/* Trigger */}
        <div
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px 7px 12px',
            borderRadius: '8px',
            background: 'rgba(15,23,42,0.9)',
            color: isActive ? '#a5b4fc' : '#e2e8f0',
            border: open
              ? '1px solid #6366f1'
              : isActive
              ? '1px solid rgba(99,102,241,0.5)'
              : '1px solid rgba(255,255,255,0.1)',
            fontSize: '12.5px',
            fontWeight: isActive ? 600 : 500,
            cursor: 'pointer',
            boxShadow: open ? '0 0 0 2px rgba(99,102,241,0.15)' : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            gap: '8px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
            {displayLabel()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {isActive && (
              <span style={{
                fontSize: '9px', background: '#6366f1', color: '#fff',
                borderRadius: '10px', padding: '1px 5px', fontWeight: 700,
              }}>
                {selected.length}
              </span>
            )}
            <svg
              style={{ color: '#6366f1', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            zIndex: 10000,
            minWidth: '200px',
            maxWidth: '260px',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}>
            {/* Search */}
            {options.length > 6 && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: '6px',
                    background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Select All / Unselect All */}
            {!singleSelect && (
              <div style={{
                display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <button
                  onClick={selectAll}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600,
                    background: allSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: allSelected ? '#818cf8' : '#94a3b8',
                    border: 'none', borderRight: '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!allSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!allSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  ✓ Select All
                </button>
                <button
                  onClick={unselectAll}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600,
                    background: 'transparent', color: '#94a3b8',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Options list */}
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                  No options found
                </div>
              ) : (
                filtered.map(opt => {
                  const isExplicitlySelected = selected.includes(opt.value);
                  const displayCheck = selected.length === 0 || isExplicitlySelected;

                  return (
                    <div
                      key={opt.value}
                      onClick={() => toggle(opt.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer',
                        color: displayCheck ? '#e2e8f0' : '#64748b',
                        background: isExplicitlySelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => {
                        if (!isExplicitlySelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={e => {
                        if (!isExplicitlySelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Custom checkbox or single select active state */}
                      {!singleSelect ? (
                        <div style={{
                          width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                          border: displayCheck ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.2)',
                          background: displayCheck ? '#6366f1' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {displayCheck && (
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                              <polyline points="2 6 5 9 10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                      ) : null}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isExplicitlySelected ? 600 : 400 }}>
                        {opt.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSelectFilter;
