import { useState, useRef, useEffect } from 'react';
import { BaseChart } from './Charts';
import type { EChartsOption } from 'echarts';

type ChartType = 'grouped' | 'horizontal' | 'line';

interface ChartControl {
  id: ChartType;
  icon: string;
  label: string;
}

interface ChartCardProps {
  title: string;
  /** Primary chart option shown for current selection */
  option: EChartsOption;
  /** Alternative options keyed by ChartType — only keys provided appear as controls */
  alternativeOptions?: Partial<Record<ChartType, EChartsOption>>;
  height?: string;
  expandedHeight?: string;
  isLoading?: boolean;
  defaultType?: ChartType;
  sortOptions?: { label: string; value: string }[];
  currentSort?: string;
  onSortChange?: (value: string) => void;
}

const CONTROLS: ChartControl[] = [
  { id: 'grouped',    icon: '⊞',  label: 'Comparison' },
  { id: 'horizontal', icon: '≡',  label: 'Horizontal' },
  { id: 'line',       icon: '∿',  label: 'Line Trend' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 9px',
  borderRadius: '5px',
  fontSize: '11px',
  fontWeight: active ? 700 : 400,
  border: active ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
  background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
  color: active ? '#a5b4fc' : '#64748b',
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap' as const,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const ChartCard = ({
  title,
  option,
  alternativeOptions = {},
  height = '300px',
  expandedHeight = 'calc(100vh - 100px)',
  isLoading = false,
  defaultType = 'horizontal',
  sortOptions,
  currentSort,
  onSortChange,
}: ChartCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available controls = current type + whatever alternatives provided
  const availableControls = CONTROLS.filter(
    c => c.id === defaultType || alternativeOptions[c.id] !== undefined
  );

  const activeOption =
    chartType === defaultType
      ? option
      : (alternativeOptions[chartType] ?? option);

  const renderControls = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            style={{
              padding: '3px 9px',
              borderRadius: '5px',
              fontSize: '11px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: sortOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
            title="Sort By"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Sort By
          </button>
          {sortOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0,
              background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 50, minWidth: '180px', overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              {sortOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                  style={{
                    padding: '8px 12px', fontSize: '12px',
                    color: opt.value === currentSort ? '#818cf8' : '#cbd5e1',
                    background: opt.value === currentSort ? 'rgba(99,102,241,0.1)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (opt.value !== currentSort) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (opt.value !== currentSort) e.currentTarget.style.background = 'transparent'; }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {availableControls.length > 1 && availableControls.map(c => (
        <button
          key={c.id}
          style={btnStyle(chartType === c.id)}
          onClick={() => setChartType(c.id)}
          title={c.label}
        >
          <span style={{ fontSize: '13px' }}>{c.icon}</span>
          <span>{c.label}</span>
        </button>
      ))}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          marginLeft: '4px',
          padding: '3px 9px',
          borderRadius: '5px',
          fontSize: '11px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}
        title="Fullscreen"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {expanded
            ? <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></>
            : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
          }
        </svg>
        {expanded ? 'Collapse' : 'Expand'}
      </button>
    </div>
  );

  const renderBody = (h: string) => (
    isLoading ? (
      <div style={{
        height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#475569', fontSize: '0.82rem', gap: '10px', flexDirection: 'column',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Loading chart…
      </div>
    ) : (
      <BaseChart option={activeOption} height={h} />
    )
  );

  if (expanded) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(9,14,23,0.97)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(19,32,53,0.9)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '3px', height: '18px', background: '#6366f1', borderRadius: '2px' }} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>{title}</span>
          </div>
          {renderControls()}
        </div>
        <div style={{ flex: 1, padding: '20px 24px' }}>
          {renderBody(expandedHeight)}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="chart-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', background: '#6366f1', borderRadius: '2px' }} />
          <span className="chart-card-title">{title}</span>
        </div>
        {renderControls()}
      </div>
      <div className="chart-card-body" style={{ flex: 1 }}>
        {renderBody(height)}
      </div>
    </div>
  );
};