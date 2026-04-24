import { FastifyRequest, FastifyReply } from 'fastify';

export interface PaginatedRequest extends FastifyRequest {
  querystring: {
    page?: string;
    limit?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

export interface DashboardSummary {
  totalReceived: number;
  totalDisposed: number;
  totalPending: number;
  pendingOverFifteenDays: number;
  pendingOverOneMonth: number;
  pendingOverTwoMonths: number;
}

export interface DistrictChartData {
  district: string;
  totalComplaints: number;
  pending: number;
  disposed: number;
}

export interface PendingBreakdown {
  fifteenToThirtyDays: number;
  oneToTwoMonths: number;
  overTwoMonths: number;
}

export interface MonthWiseData {
  month: string;
  year: number;
  total: number;
  pending: number;
}

export interface ReportRow {
  [key: string]: string | number | Date | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}