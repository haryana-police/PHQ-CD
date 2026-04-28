import { useState, useRef, useEffect } from 'react';
import { useFilters } from '../../contexts/FilterContext';
import { useQuery } from '@tanstack/react-query';
import { referenceApi } from '../../services/api';

// Reusable multi-select dropdown component
const MultiSelectDropdown = ({ 
  isOpen, toggle, allLabel, allChecked, onAllClick, items, selectedItems, onToggleItem 
}: {
  isOpen: boolean;
  toggle: () => void;
  allLabel: string;
  allChecked: boolean;
  onAllClick: () => void;
  items: string[];
  selectedItems: string[];
  onToggleItem: (item: string) => void;
}) => {
  const displayText = selectedItems.length === 0
    ? allLabel
    : selectedItems.length === 1
      ? selectedItems[0]
      : `${selectedItems.length} Selected`;

  return (
    <>
      <select
        className="filter-input"
        value="__custom__"
        onClick={(e) => { e.preventDefault(); toggle(); }}
        onMouseDown={(e) => e.preventDefault()}
        onChange={() => {}}
        style={{ cursor: 'pointer', minWidth: '140px' }}
      >
        <option value="__custom__">{displayText}</option>
      </select>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '2px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          maxHeight: '280px',
          overflowY: 'auto',
          minWidth: '180px',
        }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', cursor: 'pointer', fontSize: '13px',
            color: '#e2e8f0', borderBottom: '1px solid #1e293b',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <input type="checkbox" checked={allChecked} onChange={onAllClick} style={{ accentColor: '#3b82f6' }} />
            {allLabel}
          </label>
          {items.map((item) => (
            <label
              key={item}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 10px', cursor: 'pointer', fontSize: '13px', color: '#e2e8f0',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(item)}
                onChange={() => onToggleItem(item)}
                style={{ accentColor: '#3b82f6' }}
              />
              {item}
            </label>
          ))}
        </div>
      )}
    </>
  );
};

export const GlobalFilterBar = () => {
  const { filters, setFilter, resetFilters } = useFilters();
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const districtRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (districtRef.current && !districtRef.current.contains(event.target as Node)) {
        setDistrictDropdownOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDistricts = filters.districtName ? filters.districtName.split(',').filter(Boolean) : [];
  const selectedTypes = filters.complaintType ? filters.complaintType.split(',').filter(Boolean) : [];

  const toggleDistrict = (district: string) => {
    const newSelection = selectedDistricts.includes(district)
      ? selectedDistricts.filter(d => d !== district)
      : [...selectedDistricts, district];
    setFilter('districtName', newSelection.join(','));
  };

  const toggleType = (type: string) => {
    const newSelection = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setFilter('complaintType', newSelection.join(','));
  };

  // Fetch unique districts and categories for dropdowns
  const { data: districts } = useQuery({
    queryKey: ['filter-districts'],
    queryFn: () => referenceApi.districts(),
    staleTime: 5 * 60 * 1000
  });

  const { data: categories } = useQuery({
    queryKey: ['filter-categories'],
    queryFn: () => referenceApi.complaintType(),
    staleTime: 5 * 60 * 1000
  });

  return (
    <div className="global-filter-bar">
      <div className="filter-group">
        <label>Date Range</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="date" 
            value={filters.fromDate}
            onChange={(e) => setFilter('fromDate', e.target.value)}
            onClick={(e) => 'showPicker' in HTMLInputElement.prototype && e.currentTarget.showPicker()}
            className="filter-input"
            style={{ cursor: 'pointer' }}
          />
          <span style={{color: '#94a3b8'}}>-</span>
          <input 
            type="date" 
            value={filters.toDate}
            onChange={(e) => setFilter('toDate', e.target.value)}
            onClick={(e) => 'showPicker' in HTMLInputElement.prototype && e.currentTarget.showPicker()}
            className="filter-input"
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>

      <div className="filter-group">
        <label>Source</label>
        <select 
          value={filters.source} 
          onChange={(e) => setFilter('source', e.target.value)}
          className="filter-input"
        >
          <option value="">All Sources</option>
          <option value="complaint">General Complaints</option>
          <option value="women_safety">Women Safety</option>
          <option value="cctns">CCTNS / FIR</option>
        </select>
      </div>

      {/* District multi-select */}
      <div className="filter-group" ref={districtRef} style={{ position: 'relative' }}>
        <label>District</label>
        <MultiSelectDropdown
          isOpen={districtDropdownOpen}
          toggle={() => { setDistrictDropdownOpen(!districtDropdownOpen); setCategoryDropdownOpen(false); }}
          allLabel="All Districts"
          allChecked={selectedDistricts.length === 0}
          onAllClick={() => setFilter('districtName', '')}
          items={(districts?.data || []).map((d: any) => d.name).filter(Boolean)}
          selectedItems={selectedDistricts}
          onToggleItem={toggleDistrict}
        />
      </div>

      {/* Complaint Type multi-select */}
      <div className="filter-group" ref={categoryRef} style={{ position: 'relative' }}>
        <label>Complaint Type</label>
        <MultiSelectDropdown
          isOpen={categoryDropdownOpen}
          toggle={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setDistrictDropdownOpen(false); }}
          allLabel="All Types"
          allChecked={selectedTypes.length === 0}
          onAllClick={() => setFilter('complaintType', '')}
          items={(categories?.data || []).filter(Boolean)}
          selectedItems={selectedTypes}
          onToggleItem={toggleType}
        />
      </div>

      <div className="filter-actions">
        <button className="btn-reset" onClick={resetFilters}>Reset</button>
      </div>
    </div>
  );
};
