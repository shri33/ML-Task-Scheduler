import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Task,
  CreateTaskInput,
  Resource,
  CreateResourceInput,
  UpdateResourceInput,
  ScheduleResult,
  ScheduleHistory,
  Metrics,
  ApiResponse,
} from '../types';

// Types for Auth
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Device {
  id: string;
  name: string;
  type: 'CAMERA' | 'ROBOT_ARM' | 'IOT_SENSOR' | 'EDGE_SERVER' | 'ACTUATOR';
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';
  ipAddress?: string;
  port?: number;
  location?: string;
  description?: string;
  capabilities?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  lastHeartbeat?: string;
  createdAt: string;
  _count?: {
    deviceLogs: number;
    deviceMetrics: number;
  };
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
  byType: Record<string, number>;
}

export interface FogNode {
  id: string;
  name: string;
  computingResourceGHz: string;
  networkBandwidthMbps: string;
  currentLoadPercent: string;
}

export interface FogMetrics {
  taskCount: number;
  completionTime: { hh: number; ipso: number; iaco: number; rr: number; minMin: number };
  energyConsumption: { hh: number; ipso: number; iaco: number; rr: number; minMin: number };
  reliability: { hh: number; ipso: number; iaco: number; rr: number; minMin: number };
}

export interface AlgorithmComparison {
  hybridHeuristic: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  ipso: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  iaco: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  roundRobin: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  minMin: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // send httpOnly cookies with every request
});

// Token management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Helper to read a cookie by name
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Request interceptor - attach CSRF header (auth handled by httpOnly cookies)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach CSRF token from double-submit cookie
    const csrf = getCookie('csrf-token');
    if (csrf && config.headers) {
      config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and refresh token via httpOnly cookies
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || '';

    // Skip refresh attempt for auth-check endpoints (prevents infinite loop on login page)
    const skipRefreshPaths = ['/v1/auth/me', '/v1/auth/refresh', '/v1/auth/login', '/v1/auth/register'];
    const shouldSkipRefresh = skipRefreshPaths.some(p => requestUrl.includes(p));

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh via httpOnly cookie — server reads refresh token from cookie
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        processQueue(null, '');
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // Only redirect if not already on login page (prevents reload loop)
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<ApiResponse<LoginResponse>>('/v1/auth/login', { email, password });
    return response.data.data;
  },

  register: async (email: string, password: string, name: string): Promise<LoginResponse> => {
    const response = await api.post<ApiResponse<LoginResponse>>('/v1/auth/register', { email, password, name });
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/v1/auth/logout');
  },

  refresh: async (refreshToken: string): Promise<{ token: string }> => {
    const response = await api.post<ApiResponse<{ token: string }>>('/v1/auth/refresh', { refreshToken });
    return response.data.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await api.get<ApiResponse<AuthUser>>('/v1/auth/me');
    return response.data.data;
  },

  updateProfile: async (data: Partial<AuthUser>): Promise<AuthUser> => {
    const response = await api.put<ApiResponse<AuthUser>>('/v1/auth/profile', data);
    return response.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.put('/v1/auth/password', { currentPassword, newPassword });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/v1/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await api.post('/v1/auth/reset-password', { token, newPassword });
  },
};

// Task API
export const taskApi = {
  getAll: async (status?: string): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Task[]>>('/v1/tasks', { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<ApiResponse<Task>>(`/v1/tasks/${id}`);
    return response.data.data;
  },

  create: async (data: CreateTaskInput): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>('/v1/tasks', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<CreateTaskInput>): Promise<Task> => {
    const response = await api.put<ApiResponse<Task>>(`/v1/tasks/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/tasks/${id}`);
  },

  complete: async (id: string, actualTime: number): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>(`/v1/tasks/${id}/complete`, { actualTime });
    return response.data.data;
  },

  getStats: async () => {
    const response = await api.get<ApiResponse<{ total: number; pending: number; scheduled: number; running: number; completed: number; failed: number }>>('/v1/tasks/stats');
    return response.data.data;
  },
};

// Resource API
export const resourceApi = {
  getAll: async (status?: string): Promise<Resource[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Resource[]>>('/v1/resources', { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Resource> => {
    const response = await api.get<ApiResponse<Resource>>(`/v1/resources/${id}`);
    return response.data.data;
  },

  create: async (data: CreateResourceInput): Promise<Resource> => {
    const response = await api.post<ApiResponse<Resource>>('/v1/resources', data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateResourceInput): Promise<Resource> => {
    const response = await api.put<ApiResponse<Resource>>(`/v1/resources/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/resources/${id}`);
  },

  updateLoad: async (id: string, load: number): Promise<Resource> => {
    const response = await api.patch<ApiResponse<Resource>>(`/v1/resources/${id}/load`, { load });
    return response.data.data;
  },

  getStats: async () => {
    const response = await api.get<ApiResponse<{ total: number; available: number; busy: number; offline: number; avgLoad: number }>>('/v1/resources/stats');
    return response.data.data;
  },
};

// Schedule API
export const scheduleApi = {
  run: async (taskIds?: string[]): Promise<{ results: ScheduleResult[]; count: number; scheduledAt: string }> => {
    const response = await api.post<ApiResponse<{ results: ScheduleResult[]; count: number; scheduledAt: string }>>('/v1/schedule', { taskIds });
    return response.data.data;
  },

  getHistory: async (limit?: number): Promise<ScheduleHistory[]> => {
    const params = limit ? { limit } : {};
    const response = await api.get<ApiResponse<ScheduleHistory[]>>('/v1/schedule/history', { params });
    return response.data.data;
  },

  getComparison: async () => {
    const response = await api.get<ApiResponse<{ withML: { count: number; avgError: number; avgTime: number }; withoutML: { count: number; avgError: number; avgTime: number } }>>('/v1/schedule/comparison');
    return response.data.data;
  },

  getMlStatus: async () => {
    const response = await api.get<ApiResponse<{ mlServiceAvailable: boolean; fallbackMode: boolean }>>('/v1/schedule/ml-status');
    return response.data.data;
  },
};

// Metrics API
export const metricsApi = {
  get: async (): Promise<Metrics> => {
    const response = await api.get<ApiResponse<Metrics>>('/v1/metrics');
    return response.data.data;
  },

  getTimeline: async (days?: number) => {
    const params = days ? { days } : {};
    const response = await api.get<ApiResponse<{ date: string; tasksScheduled: number; avgExecutionTime: number; mlAccuracy: number }[]>>('/v1/metrics/timeline', { params });
    return response.data.data;
  },
};

// ============================================
// DEVICE API
// ============================================
export const deviceApi = {
  getAll: async (params?: { type?: string; status?: string; search?: string }): Promise<Device[]> => {
    const response = await api.get<ApiResponse<Device[]>>('/v1/devices', { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Device> => {
    const response = await api.get<ApiResponse<Device>>(`/v1/devices/${id}`);
    return response.data.data;
  },

  create: async (data: Partial<Device>): Promise<Device> => {
    const response = await api.post<ApiResponse<Device>>('/v1/devices', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<Device>): Promise<Device> => {
    const response = await api.put<ApiResponse<Device>>(`/v1/devices/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/devices/${id}`);
  },

  heartbeat: async (id: string, metrics?: Record<string, unknown>): Promise<Device> => {
    const response = await api.post<ApiResponse<Device>>(`/v1/devices/${id}/heartbeat`, { metrics });
    return response.data.data;
  },

  getMetrics: async (id: string, params?: { from?: string; to?: string }): Promise<unknown[]> => {
    const response = await api.get<ApiResponse<unknown[]>>(`/v1/devices/${id}/metrics`, { params });
    return response.data.data;
  },

  getLogs: async (id: string, params?: { level?: string; limit?: number }): Promise<unknown[]> => {
    const response = await api.get<ApiResponse<unknown[]>>(`/v1/devices/${id}/logs`, { params });
    return response.data.data;
  },

  sendCommand: async (id: string, command: string, parameters?: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>(`/v1/devices/${id}/command`, { command, parameters });
    return response.data.data;
  },

  getStats: async (): Promise<DeviceStats> => {
    const response = await api.get<ApiResponse<DeviceStats>>('/v1/devices/stats/overview');
    return response.data.data;
  },
};

// ============================================
// FOG COMPUTING API
// ============================================
export const fogApi = {
  getInfo: async (): Promise<unknown> => {
    const response = await api.get<ApiResponse<unknown>>('/v1/fog/info');
    return response.data.data;
  },

  getNodes: async (): Promise<FogNode[]> => {
    const response = await api.get<ApiResponse<FogNode[]>>('/v1/fog/nodes');
    return response.data.data;
  },

  createNode: async (data: Partial<FogNode>): Promise<FogNode> => {
    const response = await api.post<ApiResponse<FogNode>>('/v1/fog/nodes', data);
    return response.data.data;
  },

  getDevices: async (): Promise<unknown[]> => {
    const response = await api.get<ApiResponse<unknown[]>>('/v1/fog/devices');
    return response.data.data;
  },

  createDevice: async (data: unknown): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>('/v1/fog/devices', data);
    return response.data.data;
  },

  getTasks: async (): Promise<unknown[]> => {
    const response = await api.get<ApiResponse<unknown[]>>('/v1/fog/tasks');
    return response.data.data;
  },

  createTask: async (data: unknown): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>('/v1/fog/tasks', data);
    return response.data.data;
  },

  schedule: async (algorithm?: string): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>('/v1/fog/schedule', { algorithm });
    return response.data.data;
  },

  compare: async (taskCount: number): Promise<AlgorithmComparison> => {
    const response = await api.post<ApiResponse<AlgorithmComparison>>('/v1/fog/compare', { taskCount });
    return response.data.data;
  },

  getMetrics: async (): Promise<{ metrics: FogMetrics[] }> => {
    const response = await api.get<ApiResponse<{ metrics: FogMetrics[] }>>('/v1/fog/metrics');
    return response.data.data;
  },

  getToleranceReliability: async (): Promise<{ metrics: unknown[] }> => {
    const response = await api.get<ApiResponse<{ metrics: unknown[] }>>('/v1/fog/tolerance-reliability');
    return response.data.data;
  },

  reset: async (taskCount?: number): Promise<void> => {
    await api.post('/v1/fog/reset', { taskCount });
  },

  exportCsv: async (): Promise<Blob> => {
    const response = await api.get('/v1/fog/export/csv', { responseType: 'blob' });
    return response.data;
  },

  exportJson: async (): Promise<unknown> => {
    const response = await api.get<ApiResponse<unknown>>('/v1/fog/export/json');
    return response.data.data;
  },
};

// ============================================
// REPORTS API
// ============================================
export const reportsApi = {
  // Get available report types
  getAvailable: async (): Promise<{ pdf: string[]; csv: string[] }> => {
    const response = await api.get<ApiResponse<{ pdf: string[]; csv: string[] }>>('/v1/reports');
    return response.data.data;
  },

  // PDF Reports
  getTasksPdf: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/pdf/tasks', { responseType: 'blob' });
    return response.data;
  },

  getPerformancePdf: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/pdf/performance', { responseType: 'blob' });
    return response.data;
  },

  getResourcesPdf: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/pdf/resources', { responseType: 'blob' });
    return response.data;
  },

  // CSV Reports
  getTasksCsv: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/csv/tasks', { responseType: 'blob' });
    return response.data;
  },

  getResourcesCsv: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/csv/resources', { responseType: 'blob' });
    return response.data;
  },

  getScheduleHistoryCsv: async (): Promise<Blob> => {
    const response = await api.get('/v1/reports/csv/schedule-history', { responseType: 'blob' });
    return response.data;
  },
};

// ============================================
// EXPERIMENTS API
// ============================================
export interface ExperimentResult {
  experiment_type: string;
  runtimeSeconds: number;
  validation: Record<string, boolean>;
  exportedFiles: string[];
  taskCountResults: Array<{
    taskCount: number;
    hh: { delay: number; energy: number; reliability: number; time: number };
    ipso: { delay: number; energy: number; reliability: number; time: number };
    iaco: { delay: number; energy: number; reliability: number; time: number };
    rr: { delay: number; energy: number; reliability: number; time: number };
    minMin: { delay: number; energy: number; reliability: number; time: number };
  }> | null;
  toleranceResults: Array<{
    maxToleranceTime: number;
    hh: number;
    ipso: number;
    iaco: number;
    rr: number;
  }> | null;
  summary: Record<string, unknown>;
}

export const experimentsApi = {
  run: async (experimentType: string, iterations = 3): Promise<ExperimentResult> => {
    const response = await api.post<ApiResponse<ExperimentResult>>('/v1/experiments/run', {
      experiment_type: experimentType,
      iterations,
    });
    return response.data.data;
  },
  getResults: async (): Promise<{ files: string[] }> => {
    const response = await api.get<ApiResponse<{ files: string[] }>>('/v1/experiments/results');
    return response.data.data;
  },
  getSummary: async (): Promise<unknown> => {
    const response = await api.get<ApiResponse<unknown>>('/v1/experiments/summary');
    return response.data.data;
  },
};

export default api;
