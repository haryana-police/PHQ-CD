/**
 * useData.ts — All data-fetching hooks.
 * Every hook that supports filtering accepts a `filters` param object.
 * The filter object is included in the queryKey so React Query re-fetches automatically.
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';

const AUTH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/** Build a URLSearchParams from a filter object, dropping empty/null values */
function buildQS(params: Record<string, string | number | string[] | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length > 0) p.set(k, v.join(',')); }
    else p.set(k, String(v));
  }
  return p.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const login = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const { data } = await api.post('/api/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      if (data?.data?.token) {
        localStorage.setItem('token', data.data.token);
        window.location.href = '/admin/dashboard';
      }
    },
  });

  const logout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const res = await fetch('/api/auth/me', { headers: AUTH() });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  return { login, logout, user, isLoading };
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared filter options — districts (DB), sources, types (DB reference tables)
// Used by GlobalFilterBar and all module filter dropdowns
// ─────────────────────────────────────────────────────────────────────────────
export interface FilterOptions {
  districts: string[];
  sources:   string[];
  types:     string[];
  years:     number[];
}

export const useFilterOptions = () =>
  useQuery<FilterOptions>({
    queryKey: ['global-filter-options'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/filter-options', { headers: AUTH() });
      const json = await r.json();
      return json.data ?? { districts: [], sources: [], types: [], years: [] };
    },
    staleTime: 30 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export interface DashboardFilters {
  year?:           number;
  fromDate?:       string;
  toDate?:         string;
  district?:       string[];
  source?:         string[];
  complaintType?:  string[];
}

export const useDashboardSummary = (filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/dashboard/summary${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useDistrictChart = (filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ['dashboard', 'district', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/dashboard/district-wise${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useMonthWiseData = (filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ['dashboard', 'month-wise', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/dashboard/month-wise${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useDurationChart = (filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ['dashboard', 'duration', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/dashboard/duration-wise${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Complaints
// ─────────────────────────────────────────────────────────────────────────────
export const useComplaints = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['complaints', params],
    queryFn: async () => {
      const r = await fetch(`/api/complaints?${new URLSearchParams(params)}`, { headers: AUTH() });
      return r.json();
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────
export interface ReportFilters {
  year?:          number;
  fromDate?:      string;
  toDate?:        string;
  district?:      string[];
  source?:        string[];
  complaintType?: string[];
}

export const useReport = (type: string, filters: ReportFilters = {}) =>
  useQuery({
    queryKey: ['reports', type, filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/reports/${type}${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!type,
  });

// Legacy alias — kept for backwards compat
export const useReports = useReport;

// ─────────────────────────────────────────────────────────────────────────────
// Highlights
// ─────────────────────────────────────────────────────────────────────────────
export interface HighlightFilters {
  year?:     number;
  district?: string[];
}

export const useHighlights = (filters: HighlightFilters = {}) =>
  useQuery({
    queryKey: ['reports', 'highlights', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/reports/highlights${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useNatureIncident = (filters: ReportFilters = {}) =>
  useQuery({
    queryKey: ['reports', 'nature-incident', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/reports/nature-incident${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Pending
// ─────────────────────────────────────────────────────────────────────────────
export const usePending = (type = 'all') =>
  useQuery({
    queryKey: ['pending', type],
    queryFn: async () => {
      const typeMap: Record<string, string> = {
        all: '/api/pending/all',
        '15-30': '/api/pending/15-30-days',
        '30-60': '/api/pending/30-60-days',
        'over-60': '/api/pending/over-60-days',
      };
      const r = await fetch(typeMap[type] || typeMap.all, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Matrix
// ─────────────────────────────────────────────────────────────────────────────
export interface MatrixFilters {
  year?:      number;
  fromDate?:  string;
  toDate?:    string;
  district?:  string[];
}

export const usePendencyMatrix = (filters: MatrixFilters = {}) =>
  useQuery({
    queryKey: ['matrix', 'pendency', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/matrix/pendency${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useDisposalMatrix = (filters: MatrixFilters = {}) =>
  useQuery({
    queryKey: ['matrix', 'disposal', filters],
    queryFn: async () => {
      const qs = buildQS(filters as any);
      const r = await fetch(`/api/matrix/disposal${qs ? '?' + qs : ''}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Reference / Gov / Other
// ─────────────────────────────────────────────────────────────────────────────
export const useReference = (type: string) =>
  useQuery({
    queryKey: ['reference', type],
    queryFn: async () => {
      const r = await fetch(`/api/${type}`, { headers: AUTH() });
      return r.json();
    },
    staleTime: 10 * 60 * 1000,
  });

export const useGovDistricts = () =>
  useQuery({
    queryKey: ['gov', 'districts'],
    queryFn: async () => {
      const r = await fetch('/api/gov/districts', { headers: AUTH() });
      const json = await r.json();
      return json.data || [];
    },
    staleTime: 60 * 60 * 1000,
  });

export const useGovPoliceStations = (districtId: string | null) =>
  useQuery({
    queryKey: ['gov', 'police-stations', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const r = await fetch(`/api/gov/police-stations?districtId=${districtId}`, { headers: AUTH() });
      const json = await r.json();
      return json.data || [];
    },
    enabled: !!districtId,
    staleTime: 60 * 60 * 1000,
  });

export const useGovOffices = () =>
  useQuery({
    queryKey: ['gov', 'offices'],
    queryFn: async () => {
      const r = await fetch('/api/gov/offices', { headers: AUTH() });
      const json = await r.json();
      return json.data || [];
    },
    staleTime: 60 * 60 * 1000,
  });

export const useWomenSafety = () =>
  useQuery({
    queryKey: ['women-safety'],
    queryFn: async () => {
      const r = await fetch('/api/women-safety', { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCctns = () =>
  useQuery({
    queryKey: ['cctns'],
    queryFn: async () => {
      const r = await fetch('/api/cctns', { headers: AUTH() });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });