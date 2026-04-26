import { createContext, useContext, useState, ReactNode } from 'react';

export interface DashboardFilters {
  source: string;
  districtName: string;
  complaintType: string;
  fromDate: string;
  toDate: string;
}

interface FilterContextType {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  resetFilters: () => void;
}

const defaultFilters: DashboardFilters = {
  source: '',
  districtName: '',
  complaintType: '',
  fromDate: '',
  toDate: '',
};

const FilterContext = createContext<FilterContextType>({
  filters: defaultFilters,
  setFilter: () => {},
  resetFilters: () => {},
});

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const setFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(defaultFilters);

  return (
    <FilterContext.Provider value={{ filters, setFilter, resetFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => useContext(FilterContext);
