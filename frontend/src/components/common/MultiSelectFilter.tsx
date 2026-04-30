import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

/** Measures the trigger button and returns absolute position for the dropdown */
function getDropdownPos(triggerEl: HTMLElement): { top: number; left: number; width: number; openUp: boolean } {
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const dropH = 300; // approximate max dropdown height
  const openUp = spaceBelow < dropH && rect.top > dropH;
  return {
    top:    openUp ? rect.top + window.scrollY - dropH - 6 : rect.bottom + window.scrollY + 5,
    left:   rect.left + window.scrollX,
    width:  Math.max(rect.width, 200),
    openUp,
  };
}

export const MultiSelectFilter = ({
  label,
  options,
  selected,
  onChange,
  placeholder,
  minWidth = '160px',
  singleSelect = false,
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200, openUp: false });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  // Recompute position on open or scroll/resize
  const updatePos = useCallback(() => {
    if (triggerRef.current) setPos(getDropdownPos(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('resize',  updatePos, { passive: true });
    window.addEventListener('scroll',  updatePos, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize',  updatePos);
      window.removeEventListener('scroll',  updatePos, true);
    };
  }, [open, updatePos]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allSelected = selected.length === options.length && options.length > 0;
  const filtered    = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const isActive    = selected.length > 0 && selected.length < options.length;

  const toggle = (val: string) => {
    if (singleSelect) {
      onChange(selected.includes(val) ? [] : [val]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const displayLabel = () => {
    if (selected.length === 0 || selected.length === options.length)
      return placeholder || `All ${label}s`;
    if (selected.length === 1)
      return options.find(o => o.value === selected[0])?.label ?? selected[0];
    return `${selected.length} ${label}s`;
  };

  const dropdown = open && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'absolute',
        top:  pos.top,
        left: pos.left,
        width: pos.width,
        maxWidth: '280px',
        background: '#1e293b',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        zIndex: 2147483647,          // max possible z-index — above everything
        overflow: 'hidden',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      {/* Search box */}
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
              background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Select All / Unselect All */}
      {!singleSelect && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => onChange(options.map(o => o.value))}
            style={{
              flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600,
              background: allSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: allSelected ? '#818cf8' : '#94a3b8',
              border: 'none', borderRight: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!allSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!allSelected) e.currentTarget.style.background = 'transparent'; }}
          >✓ Select All</button>
          <button
            onClick={() => onChange([])}
            style={{
              flex: 1, padding: '7px 10px', fontSize: '11px', fontWeight: 600,
              background: 'transparent', color: '#94a3b8',
              border: 'none', cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >✕ Clear</button>
        </div>
      )}

      {/* Options */}
      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
            No options found
          </div>
        ) : filtered.map(opt => {
          const sel = selected.includes(opt.value);
          return (
            <div
              key={opt.value}
              onClick={() => toggle(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer',
                color: sel ? '#e2e8f0' : '#64748b',
                background: sel ? 'rgba(99,102,241,0.1)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? 'rgba(99,102,241,0.1)' : 'transparent'; }}
            >
              {!singleSelect && (
                <div style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  border: sel ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.2)',
                  background: sel ? '#6366f1' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {sel && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <polyline points="2 6 5 9 10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: sel ? 600 : 400 }}>
                {opt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.7px', color: '#64748b',
      }}>
        {label}
      </span>

      {/* Trigger button */}
      <div
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px 7px 12px',
          borderRadius: '8px',
          minWidth,
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
          transition: 'all 0.18s ease',
          whiteSpace: 'nowrap',
          gap: '8px',
          userSelect: 'none',
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

      {dropdown}
    </div>
  );
};

export default MultiSelectFilter;
