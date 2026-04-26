import { useFilters } from '../../contexts/FilterContext';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../services/api';

export const GlobalFilterBar = () => {
  const { filters, setFilter, resetFilters } = useFilters();

  // Fetch unique districts and categories for dropdowns
  const { data: districts } = useQuery({
    queryKey: ['filter-districts'],
    queryFn: () => dashboardApi.getDistrictWise(), // Temporary way to get districts until a dedicated master route is added
    staleTime: 5 * 60 * 1000
  });

  const { data: categories } = useQuery({
    queryKey: ['filter-categories'],
    queryFn: () => dashboardApi.getCategoryWise(),
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

      <div className="filter-group">
        <label>District</label>
        <select 
          value={filters.districtName} 
          onChange={(e) => setFilter('districtName', e.target.value)}
          className="filter-input"
        >
          <option value="">All Districts</option>
          {districts?.data?.map((d: any) => (
            <option key={d.district} value={d.district}>{d.district}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Complaint Type</label>
        <select 
          value={filters.complaintType} 
          onChange={(e) => setFilter('complaintType', e.target.value)}
          className="filter-input"
        >
          <option value="">All Types</option>
          {categories?.data?.map((c: any) => (
            <option key={c.category} value={c.category}>{c.category}</option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        <button className="btn-reset" onClick={resetFilters}>Reset</button>
      </div>
    </div>
  );
};
