import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Task,
  CreateTaskInput,
  Resource,
  ScheduleResult,
  Metrics,
  ApiResponse,
} from '../types';

// Types for Auth
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  picture?: string;
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
  completionTime: { hh: number; ipso: number; iaco: number; rr: number; minMin: number; cuopt: number };
  energyConsumption: { hh: number; ipso: number; iaco: number; rr: number; minMin: number; cuopt: number };
  reliability: { hh: number; ipso: number; iaco: number; rr: number; minMin: number; cuopt: number };
}

export interface AlgorithmComparison {
  hybridHeuristic: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  ipso: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  iaco: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  roundRobin: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  minMin: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
  cuopt: { totalDelay: number; totalEnergy: number; reliability: number; executionTimeMs: number };
}

// In dev mode (Vite dev server), API runs on port 3001
// In production (Docker/nginx), /api/ is proxied — use same origin
const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  return ''; // production: nginx proxies /api/ to backend
};

const api = axios.create({
  baseURL: getApiBase() + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000,
});

const isDemoMode = () => !!localStorage.getItem('ml-scheduler-demo-mode');

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

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const csrf = getCookie('csrf-token');
    if (csrf && config.headers) {
      config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || '';
    const skipRefreshPaths = ['/v1/auth/me', '/v1/auth/refresh', '/v1/auth/login', '/v1/auth/register'];
    const shouldSkipRefresh = skipRefreshPaths.some(p => requestUrl.includes(p));

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh && !isDemoMode()) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await axios.post('/api/v1/auth/refresh', {}, { baseURL: api.defaults.baseURL, withCredentials: true, timeout: 5000 });
        processQueue(null, '');
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        if (!window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
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
  getMe: async (): Promise<AuthUser> => {
    const response = await api.get<ApiResponse<AuthUser>>('/v1/auth/me');
    return response.data.data;
  },
  updateProfile: async (data: Partial<AuthUser>): Promise<AuthUser> => {
    const response = await api.patch<ApiResponse<AuthUser>>('/v1/auth/profile', data);
    return response.data.data;
  },
};

export interface TaskApi {
  getAll: (status?: string) => Promise<Task[]>;
  create: (data: CreateTaskInput) => Promise<Task>;
  delete: (id: string) => Promise<void>;
  complete: (id: string, actualTime: number) => Promise<Task>;
  getStats: () => Promise<any>;
  getById: (id: string) => Promise<Task>;
  update: (id: string, data: Partial<CreateTaskInput>) => Promise<Task>;
}

export const taskApi: TaskApi = {
  getAll: async (status?: string): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Task[]>>('/v1/tasks', { params });
    return response.data.data;
  },
  create: async (data: CreateTaskInput): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>('/v1/tasks', data);
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
    const response = await api.get<ApiResponse<any>>('/v1/tasks/stats');
    return response.data.data;
  },
  getById: async (id: string): Promise<Task> => {
    const response = await api.get<ApiResponse<Task>>(`/v1/tasks/${id}`);
    return response.data.data;
  },
  update: async (id: string, data: Partial<CreateTaskInput>): Promise<Task> => {
    const response = await api.patch<ApiResponse<Task>>(`/v1/tasks/${id}`, data);
    return response.data.data;
  }
};

export interface ResourceApi {
  getAll: (status?: string) => Promise<Resource[]>;
  updateLoad: (id: string, load: number) => Promise<Resource>;
  getStats: () => Promise<any>;
  create: (data: { name: string; capacity: number; layer?: string }) => Promise<Resource>;
  update: (id: string, data: any) => Promise<Resource>;
  delete: (id: string) => Promise<void>;
}

export const resourceApi: ResourceApi = {
  getAll: async (status?: string): Promise<Resource[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Resource[]>>('/v1/resources', { params });
    return response.data.data;
  },
  updateLoad: async (id: string, load: number): Promise<Resource> => {
    const response = await api.patch<ApiResponse<Resource>>(`/v1/resources/${id}/load`, { load });
    return response.data.data;
  },
  getStats: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/resources/stats');
    return response.data.data;
  },
  create: async (data: { name: string; capacity: number; layer?: string }): Promise<Resource> => {
    const response = await api.post<ApiResponse<Resource>>('/v1/resources', data);
    return response.data.data;
  },
  update: async (id: string, data: any): Promise<Resource> => {
    const response = await api.patch<ApiResponse<Resource>>(`/v1/resources/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/resources/${id}`);
  }
};

export const scheduleApi = {
  run: async (taskIds?: string[]): Promise<{ results: ScheduleResult[]; count: number; scheduledAt: string }> => {
    const response = await api.post<ApiResponse<{ results: ScheduleResult[]; count: number; scheduledAt: string }>>('/v1/schedule', { taskIds });
    return response.data.data;
  },
  getComparison: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/schedule/comparison');
    return response.data.data;
  },
  getMlStatus: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/schedule/ml-status');
    return response.data.data;
  }
};

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
  getDashboard: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/metrics/dashboard');
    return response.data.data;
  },
  getAnomalies: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/metrics/anomalies');
    return response.data.data;
  },
};

export const deviceApi = {
  getAll: async (params?: any): Promise<Device[]> => {
    const response = await api.get<ApiResponse<Device[]>>('/v1/devices', { params });
    return response.data.data;
  },
  getStats: async (): Promise<DeviceStats> => {
    const response = await api.get<ApiResponse<DeviceStats>>('/v1/devices/stats/overview');
    return response.data.data;
  },
  create: async (data: any): Promise<Device> => {
    const response = await api.post<ApiResponse<Device>>('/v1/devices', data);
    return response.data.data;
  },
  update: async (id: string, data: any): Promise<Device> => {
    const response = await api.patch<ApiResponse<Device>>(`/v1/devices/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/devices/${id}`);
  }
};

export const fogApi = {
  getInfo: async (): Promise<unknown> => {
    const response = await api.get<ApiResponse<unknown>>('/v1/fog/info');
    return response.data.data;
  },
  getNodes: async (): Promise<FogNode[]> => {
    const response = await api.get<ApiResponse<FogNode[]>>('/v1/fog/nodes');
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
  addBulkTasks: async (tasks: any[]): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>('/v1/fog/tasks/bulk', { tasks });
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
  exportJson: async (): Promise<Blob> => {
    const response = await api.get('/v1/fog/export/json', { responseType: 'blob' });
    return response.data;
  },
};

export const reportsApi = {
  getAvailable: async () => {
    const response = await api.get<ApiResponse<any>>('/v1/reports');
    return response.data.data;
  },
  getTasksPdf: async () => {
    const response = await api.get('/v1/reports/pdf/tasks', { responseType: 'blob' });
    return response.data;
  }
};

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
    cuOpt: { delay: number; energy: number; reliability: number; time: number };
  }> | null;
  toleranceResults: Array<{
    maxToleranceTime: number;
    hh: number;
    ipso: number;
    iaco: number;
    rr: number;
    cuOpt: number;
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
};

export const aiApi = {
  chat: async (message: string, history: { role: 'user' | 'assistant' | 'system', content: string }[] = []): Promise<string> => {
    const response = await api.post<ApiResponse<{ response: string }>>('/v1/ai/chat', { message, history });
    return response.data.data.response;
  },
  generateScenario: async (description: string): Promise<any[]> => {
    const response = await api.post<ApiResponse<any[]>>('/v1/ai/generate-scenario', { description });
    return response.data.data;
  },
};

export default api;
