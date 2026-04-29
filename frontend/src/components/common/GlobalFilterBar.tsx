/**
 * GlobalFilterBar — unified filter bar used across ALL dashboard modules.
 * Fetches real, distinct values from /api/complaints/filter-options (30-min cache).
 * Renders: Date Range | Source | District | Complaint Type | [optional extra filter] | Clear All
 */
import { useQuery } from '@tanstack/react-query';
import { MultiSelectFilter } from './MultiSelectFilter';

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'rgba(15,23,42,0.9)',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: '12.5px',
  outline: 'none',
  cursor: 'pointer',
  colorScheme: 'dark' as any,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: '#64748b',
  marginBottom: '4px',
  display: 'block',
};

export interface GlobalFilterBarProps {
  // Filter state (pass [] / '' if unused)
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (v: string) => void;
  onToDateChange?: (v: string) => void;

  districtFilter?: string[];
  onDistrictChange?: (v: string[]) => void;

  sourceFilter?: string[];
  onSourceChange?: (v: string[]) => void;

  complaintTypeFilter?: string[];
  onComplaintTypeChange?: (v: string[]) => void;

  // Optional extra filter (e.g. "District" tab item in Reports, "Category" in CCTNS)
  extraLabel?: string;
  extraOptions?: { value: string; label: string }[];
  extraSelected?: string[];
  onExtraChange?: (v: string[]) => void;

  // Which filters to show (all shown by default)
  showDate?: boolean;
  showSource?: boolean;
  showDistrict?: boolean;
  showComplaintType?: boolean;
  showExtra?: boolean;

  onClearAll?: () => void;
}

export const GlobalFilterBar = ({
  fromDate = '', toDate = '',
  onFromDateChange, onToDateChange,
  districtFilter = [], onDistrictChange,
  sourceFilter = [], onSourceChange,
  complaintTypeFilter = [], onComplaintTypeChange,
  extraLabel, extraOptions = [], extraSelected = [], onExtraChange,
  showDate = true,
  showSource = true,
  showDistrict = true,
  showComplaintType = true,
  showExtra = false,
  onClearAll,
}: GlobalFilterBarProps) => {
  // Fetch dynamic options once — shared across all usages (same key → same cache)
  const { data: filterOpts } = useQuery({
    queryKey: ['global-filter-options'],
    queryFn: async () => {
      const r = await fetch('/api/complaints/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const districtOptions = (filterOpts?.data?.districts ?? []).map((v: string) => ({ value: v, label: v }));
  const sourceOptions   = (filterOpts?.data?.sources   ?? []).map((v: string) => ({ value: v, label: v }));
  const typeOptions     = (filterOpts?.data?.types     ?? []).map((v: string) => ({ value: v, label: v }));

  const hasAnyFilter =
    (fromDate && onFromDateChange) || (toDate && onToDateChange) ||
    districtFilter.length > 0 || sourceFilter.length > 0 ||
    complaintTypeFilter.length > 0 || extraSelected.length > 0;

  return (
    <div style={{
      background: 'rgba(14,26,46,0.75)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px',
      padding: '14px 18px',
      marginBottom: '16px',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '18px',
      alignItems: 'flex-end',
      position: 'relative',
      zIndex: 1000,
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    }}>

      {/* Date Range */}
      {showDate && onFromDateChange && onToDateChange && (
        <div>
          <span style={LABEL_STYLE}>Date Range</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="date" value={fromDate} onChange={e => onFromDateChange(e.target.value)} style={INPUT_STYLE} />
            <span style={{ color: '#334155', fontSize: '14px' }}>→</span>
            <input type="date" value={toDate} onChange={e => onToDateChange(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
      )}

      {/* Source */}
      {showSource && onSourceChange && (
        <MultiSelectFilter
          label="Source"
          options={sourceOptions}
          selected={sourceFilter}
          onChange={onSourceChange}
          placeholder="All Sources"
          minWidth="160px"
        />
      )}

      {/* District */}
      {showDistrict && onDistrictChange && (
        <MultiSelectFilter
          label="District"
          options={districtOptions}
          selected={districtFilter}
          onChange={onDistrictChange}
          placeholder="All Districts"
          minWidth="160px"
        />
      )}

      {/* Complaint Type */}
      {showComplaintType && onComplaintTypeChange && (
        <MultiSelectFilter
          label="Complaint Type"
          options={typeOptions}
          selected={complaintTypeFilter}
          onChange={onComplaintTypeChange}
          placeholder="All Types"
          minWidth="160px"
        />
      )}

      {/* Extra (e.g. tab-specific item filter) */}
      {showExtra && onExtraChange && extraOptions.length > 0 && (
        <MultiSelectFilter
          label={extraLabel ?? 'Filter'}
          options={extraOptions}
          selected={extraSelected}
          onChange={onExtraChange}
          placeholder={`All ${extraLabel ?? ''}s`}
          minWidth="180px"
        />
      )}

      {/* Clear All */}
      {hasAnyFilter && onClearAll && (
        <button
          onClick={onClearAll}
          style={{
            padding: '6px 14px',
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
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
        >
          ✕ Clear All
        </button>
      )}
    </div>
  );
};
