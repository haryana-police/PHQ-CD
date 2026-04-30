/**
 * GlobalFilterBar — unified, single-row filter bar used across ALL dashboard modules.
 * Supports: Period selector (year presets + custom date range) | District | Source | Complaint Type | Extra filter | Clear All
 * Design: compact single line with collapsible date range to minimize vertical footprint.
 */
import { useState } from 'react';
import { useFilterOptions } from '@/hooks/useData';
import { MultiSelectFilter } from './MultiSelectFilter';

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'rgba(15,23,42,0.9)',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: '12px',
  outline: 'none',
  cursor: 'pointer',
  colorScheme: 'dark' as any,
  height: '32px',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: '#475569',
  marginBottom: '4px',
  display: 'block',
};

const DIVIDER: React.CSSProperties = {
  width: '1px',
  height: '32px',
  background: 'rgba(255,255,255,0.07)',
  alignSelf: 'flex-end',
  marginBottom: '0px',
};

export type PeriodMode = 'year' | 'custom';

export interface GlobalFilterBarProps {
  // Period / date
  showPeriod?: boolean;
  periodMode?: PeriodMode;
  onPeriodModeChange?: (m: PeriodMode) => void;
  selectedYear?: number;
  onYearChange?: (y: number) => void;
  availableYears?: number[];

  // Simple date range (used when showPeriod=false)
  showDate?: boolean;
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (v: string) => void;
  onToDateChange?: (v: string) => void;

  // Standard filters
  districtFilter?: string[];
  onDistrictChange?: (v: string[]) => void;
  sourceFilter?: string[];
  onSourceChange?: (v: string[]) => void;
  complaintTypeFilter?: string[];
  onComplaintTypeChange?: (v: string[]) => void;

  // Optional tab-specific extra filter
  extraLabel?: string;
  extraOptions?: { value: string; label: string }[];
  extraSelected?: string[];
  onExtraChange?: (v: string[]) => void;
  showExtra?: boolean;

  // Visibility toggles
  showSource?: boolean;
  showDistrict?: boolean;
  showComplaintType?: boolean;

  onClearAll?: () => void;
}

const CY = new Date().getFullYear();

export const GlobalFilterBar = ({
  showPeriod = false,
  periodMode = 'year',
  onPeriodModeChange,
  selectedYear = CY,
  onYearChange,
  availableYears,

  showDate = true,
  fromDate = '', toDate = '',
  onFromDateChange, onToDateChange,

  districtFilter = [], onDistrictChange,
  sourceFilter = [], onSourceChange,
  complaintTypeFilter = [], onComplaintTypeChange,

  extraLabel, extraOptions = [], extraSelected = [], onExtraChange,
  showExtra = false,
  showSource = true,
  showDistrict = true,
  showComplaintType = true,

  onClearAll,
}: GlobalFilterBarProps) => {
  const filterOpts = useFilterOptions();
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const districtOptions = (filterOpts.data?.districts ?? []).map((v: string) => ({ value: v, label: v }));
  const sourceOptions   = (filterOpts.data?.sources   ?? []).map((v: string) => ({ value: v, label: v }));
  const typeOptions     = (filterOpts.data?.types     ?? []).map((v: string) => ({ value: v, label: v }));
  const yearOptions     = (availableYears ?? filterOpts.data?.years ?? [CY, CY - 1, CY - 2]).slice(0, 8);

  const hasAnyFilter =
    districtFilter.length > 0 || sourceFilter.length > 0 ||
    complaintTypeFilter.length > 0 || extraSelected.length > 0 ||
    !!fromDate || !!toDate || (periodMode === 'custom' && (!!customFrom || !!customTo));

  const periodLabel = periodMode === 'custom' && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : `${selectedYear}`;

  // When custom dates change, propagate them up
  const handleCustomFrom = (v: string) => {
    setCustomFrom(v);
    onFromDateChange?.(v);
  };
  const handleCustomTo = (v: string) => {
    setCustomTo(v);
    onToDateChange?.(v);
  };

  return (
    <div style={{
      background: 'rgba(10,20,40,0.8)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '10px 14px',
      marginBottom: '14px',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      alignItems: 'flex-end',
      position: 'relative',
      zIndex: 1000,
      boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
    }}>

      {/* ── Period Selector (for Reports/Highlights) ─────────── */}
      {showPeriod && (
        <>
          <div>
            <span style={LABEL_STYLE}>Period</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '32px' }}>
              {/* Year quick pills */}
              {[CY, CY - 1, CY - 2].map(y => (
                <button
                  key={y}
                  onClick={() => { onPeriodModeChange?.('year'); onYearChange?.(y); }}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: periodMode === 'year' && selectedYear === y ? 700 : 400,
                    border: periodMode === 'year' && selectedYear === y
                      ? '1px solid rgba(99,102,241,0.6)'
                      : '1px solid rgba(255,255,255,0.06)',
                    background: periodMode === 'year' && selectedYear === y
                      ? 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(99,102,241,0.15))'
                      : 'rgba(255,255,255,0.03)',
                    color: periodMode === 'year' && selectedYear === y ? '#a5b4fc' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >{y}</button>
              ))}

              {/* Year dropdown for older years */}
              <select
                value={periodMode === 'year' ? selectedYear : ''}
                onChange={e => { onPeriodModeChange?.('year'); onYearChange?.(Number(e.target.value)); }}
                style={{
                  ...INPUT_STYLE,
                  padding: '0 8px',
                  minWidth: '72px',
                  background: 'rgba(15,23,42,0.9)',
                  appearance: 'auto',
                }}
              >
                {yearOptions.filter((y: number) => y < CY - 2).map((y: number) => (
                  <option key={y} value={y}>{y}</option>
                ))}
                {yearOptions.filter((y: number) => y >= CY - 2).length === yearOptions.length && (
                  <option value="" disabled>Older ▾</option>
                )}
              </select>

              <div style={DIVIDER} />

              {/* Custom range toggle */}
              <button
                onClick={() => onPeriodModeChange?.(periodMode === 'custom' ? 'year' : 'custom')}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: periodMode === 'custom' ? 700 : 400,
                  border: periodMode === 'custom'
                    ? '1px solid rgba(99,102,241,0.6)'
                    : '1px solid rgba(255,255,255,0.06)',
                  background: periodMode === 'custom'
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(99,102,241,0.15))'
                    : 'rgba(255,255,255,0.03)',
                  color: periodMode === 'custom' ? '#a5b4fc' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Custom
              </button>
            </div>
          </div>

          {/* Custom date inputs — only shown when custom mode active */}
          {periodMode === 'custom' && (
            <div>
              <span style={LABEL_STYLE}>Date Range</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}>
                <input type="date" value={customFrom} onChange={e => handleCustomFrom(e.target.value)} style={INPUT_STYLE} />
                <span style={{ color: '#334155' }}>→</span>
                <input type="date" value={customTo} onChange={e => handleCustomTo(e.target.value)} style={INPUT_STYLE} />
              </div>
            </div>
          )}

          {/* Active period badge */}
          <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 600,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.2)',
              padding: '4px 10px', borderRadius: '20px',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              whiteSpace: 'nowrap',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {periodLabel}
            </span>
          </div>

          <div style={DIVIDER} />
        </>
      )}

      {/* ── Simple Date Range (for Pending / non-period pages) ── */}
      {showDate && !showPeriod && onFromDateChange && onToDateChange && (
        <div>
          <span style={LABEL_STYLE}>Date Range</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}>
            <input type="date" value={fromDate} onChange={e => onFromDateChange(e.target.value)} style={INPUT_STYLE} />
            <span style={{ color: '#334155' }}>→</span>
            <input type="date" value={toDate} onChange={e => onToDateChange(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
      )}

      {/* ── District ───────────────────────────────────────────── */}
      {showDistrict && onDistrictChange && (
        <MultiSelectFilter
          label="District"
          options={districtOptions}
          selected={districtFilter}
          onChange={onDistrictChange}
          placeholder="All Districts"
          minWidth="150px"
        />
      )}

      {/* ── Source ─────────────────────────────────────────────── */}
      {showSource && onSourceChange && (
        <MultiSelectFilter
          label="Source"
          options={sourceOptions}
          selected={sourceFilter}
          onChange={onSourceChange}
          placeholder="All Sources"
          minWidth="140px"
        />
      )}

      {/* ── Complaint Type ──────────────────────────────────────── */}
      {showComplaintType && onComplaintTypeChange && (
        <MultiSelectFilter
          label="Complaint Type"
          options={typeOptions}
          selected={complaintTypeFilter}
          onChange={onComplaintTypeChange}
          placeholder="All Types"
          minWidth="150px"
        />
      )}

      {/* ── Extra (tab-specific row filter) ────────────────────── */}
      {showExtra && onExtraChange && extraOptions.length > 0 && (
        <MultiSelectFilter
          label={extraLabel ?? 'Filter'}
          options={extraOptions}
          selected={extraSelected}
          onChange={onExtraChange}
          placeholder={`All ${extraLabel ?? ''}s`}
          minWidth="160px"
        />
      )}

      {/* ── Clear All ──────────────────────────────────────────── */}
      {hasAnyFilter && onClearAll && (
        <button
          onClick={onClearAll}
          style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '8px',
            fontSize: '11.5px',
            fontWeight: 600,
            background: 'rgba(239,68,68,0.1)',
            color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.25)',
            cursor: 'pointer',
            alignSelf: 'flex-end',
            transition: 'background 0.15s',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
};
