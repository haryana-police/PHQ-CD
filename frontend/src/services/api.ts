import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { ApiResponse, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post<ApiResponse<{ token: string; user: User }>>('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  },
  register: async (username: string, password: string, role = 'admin') => {
    const response = await api.post<ApiResponse<User>>('/api/auth/register', {
      username,
      password,
      role,
    });
    return response.data;
  },
  me: async () => {
    const response = await api.get<ApiResponse<User>>('/api/auth/me');
    return response.data;
  },
};

export const complaintsApi = {
  list: async (params?: Record<string, string>) => {
    const response = await api.get('/api/complaints', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/complaints/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/api/complaints', data);
    return response.data;
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/api/complaints/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/complaints/${id}`);
    return response.data;
  },
};

export const dashboardApi = {
  summary: async () => {
    const response = await api.get('/api/dashboard/summary');
    return response.data;
  },
  districtWise: async () => {
    const response = await api.get('/api/dashboard/district-wise');
    return response.data;
  },
  durationWise: async (year?: number) => {
    const response = await api.get('/api/dashboard/duration-wise', { params: { year } });
    return response.data;
  },
  dateWise: async (fromDate: string, toDate: string) => {
    const response = await api.get('/api/dashboard/date-wise', {
      params: { fromDate, toDate },
    });
    return response.data;
  },
  monthWise: async () => {
    const response = await api.get('/api/dashboard/month-wise');
    return response.data;
  },
};

export const reportsApi = {
  district: async () => {
    const response = await api.get('/api/reports/district');
    return response.data;
  },
  modeReceipt: async () => {
    const response = await api.get('/api/reports/mode-receipt');
    return response.data;
  },
  natureIncident: async () => {
    const response = await api.get('/api/reports/nature-incident');
    return response.data;
  },
  typeAgainst: async () => {
    const response = await api.get('/api/reports/type-against');
    return response.data;
  },
  status: async () => {
    const response = await api.get('/api/reports/status');
    return response.data;
  },
  branchWise: async () => {
    const response = await api.get('/api/reports/branch-wise');
    return response.data;
  },
  highlights: async () => {
    const response = await api.get('/api/reports/highlights');
    return response.data;
  },
};

export const pendingApi = {
  all: async () => {
    const response = await api.get('/api/pending/all');
    return response.data;
  },
  fifteenToThirty: async () => {
    const response = await api.get('/api/pending/15-30-days');
    return response.data;
  },
  thirtyToSixty: async () => {
    const response = await api.get('/api/pending/30-60-days');
    return response.data;
  },
  overSixty: async () => {
    const response = await api.get('/api/pending/over-60-days');
    return response.data;
  },
};

export const referenceApi = {
  districts: async () => {
    const response = await api.get('/api/districts');
    return response.data;
  },
  branches: async () => {
    const response = await api.get('/api/branches');
    return response.data;
  },
  natureCrime: async () => {
    const response = await api.get('/api/reference/nature-crime');
    return response.data;
  },
  receptionMode: async () => {
    const response = await api.get('/api/reference/reception-mode');
    return response.data;
  },
  complaintType: async () => {
    const response = await api.get('/api/reference/complaint-type');
    return response.data;
  },
  status: async () => {
    const response = await api.get('/api/reference/status');
    return response.data;
  },
  respondentCategories: async () => {
    const response = await api.get('/api/reference/respondent-categories');
    return response.data;
  },
};

export const womenSafetyApi = {
  list: async () => {
    const response = await api.get('/api/women-safety');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/women-safety/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/api/women-safety', data);
    return response.data;
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/api/women-safety/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/women-safety/${id}`);
    return response.data;
  },
};

export const cctnsApi = {
  list: async () => {
    const response = await api.get('/api/cctns');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/cctns/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/api/cctns', data);
    return response.data;
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/api/cctns/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/cctns/${id}`);
    return response.data;
  },
  district: async () => {
    const response = await api.get('/api/cctns/district');
    return response.data;
  },
  // Live proxy — fetches from Enquiry API directly, no DB required
  enquiriesLive: async (timeFrom: string, timeTo: string) => {
    const response = await api.get('/api/cctns/enquiries-live', {
      params: { timeFrom, timeTo },
    });
    return response.data;
  },
};

export const importExportApi = {
  importComplaints: async (data: unknown[]) => {
    const response = await api.post('/api/import/complaints', data);
    return response.data;
  },
  exportComplaints: async () => {
    const response = await api.get('/api/export/complaints', {
      responseType: 'blob',
    });
    return response.data;
  },
  importCctns: async (data: unknown[]) => {
    const response = await api.post('/api/import/cctns', data);
    return response.data;
  },
  importWomenSafety: async (data: unknown[]) => {
    const response = await api.post('/api/import/women-safety', data);
    return response.data;
  },
  exportWomenSafety: async () => {
    const response = await api.get('/api/export/women-safety', {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default api;