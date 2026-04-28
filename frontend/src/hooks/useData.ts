import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';

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

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Not authenticated');
      return response.json();
    },
    retry: false,
  });

  return { login, logout, user, isLoading };
};

export const useComplaints = (params?: Record<string, string>) => {
  return useQuery({
    queryKey: ['complaints', params],
    queryFn: async () => {
      const response = await fetch(`/api/complaints?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
  });
};

export const useDashboardSummary = (year?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/dashboard/summary${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDistrictChart = (year?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'district', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/dashboard/district-wise${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDurationChart = (year?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'duration', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/dashboard/duration-wise${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useMonthWiseData = (year?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'month-wise', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/dashboard/month-wise${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useReports = (type: string) => {
  return useQuery({
    queryKey: ['reports', type],
    queryFn: async () => {
      const response = await fetch(`/api/reports/${type}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 0,
  });
};

export const usePending = (type = 'all') => {
  return useQuery({
    queryKey: ['pending', type],
    queryFn: async () => {
      const typeMap: Record<string, string> = {
        all: '/api/pending/all',
        '15-30': '/api/pending/15-30-days',
        '30-60': '/api/pending/30-60-days',
        'over-60': '/api/pending/over-60-days',
      };
      const response = await fetch(typeMap[type] || typeMap.all, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useReference = (type: string) => {
  return useQuery({
    queryKey: ['reference', type],
    queryFn: async () => {
      const response = await fetch(`/api/${type}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const useGovDistricts = () => {
  return useQuery({
    queryKey: ['gov', 'districts'],
    queryFn: async () => {
      const response = await fetch('/api/gov/districts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await response.json();
      return json.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
  });
};

export const useGovPoliceStations = (districtId: string | null) => {
  return useQuery({
    queryKey: ['gov', 'police-stations', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const response = await fetch(`/api/gov/police-stations?districtId=${districtId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!districtId,
    staleTime: 60 * 60 * 1000,
  });
};

export const useGovOffices = () => {
  return useQuery({
    queryKey: ['gov', 'offices'],
    queryFn: async () => {
      const response = await fetch('/api/gov/offices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await response.json();
      return json.data || [];
    },
    staleTime: 60 * 60 * 1000,
  });
};

export const useWomenSafety = () => {
  return useQuery({
    queryKey: ['women-safety'],
    queryFn: async () => {
      const response = await fetch('/api/women-safety', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCctns = () => {
  return useQuery({
    queryKey: ['cctns'],
    queryFn: async () => {
      const response = await fetch('/api/cctns', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const usePendencyMatrix = (year?: number) => {
  return useQuery({
    queryKey: ['matrix', 'pendency', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/matrix/pendency${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDisposalMatrix = (year?: number) => {
  return useQuery({
    queryKey: ['matrix', 'disposal', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`/api/matrix/disposal${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};