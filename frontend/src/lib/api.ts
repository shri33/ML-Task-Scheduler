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
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
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
// DEMO MODE — Mock Data for Vercel/Static Deploy
// ============================================
const DEMO_MODE_KEY = 'ml-scheduler-demo-mode';

function isDemoMode(): boolean {
  return !!localStorage.getItem(DEMO_MODE_KEY);
}

const demoTasks: Task[] = [
  { id: '1', name: 'Image Classification', type: 'CPU', size: 'LARGE', priority: 5, status: 'COMPLETED', dueDate: null, predictedTime: 45.2, actualTime: 42.8, resourceId: 'r1', resource: undefined, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), scheduledAt: new Date(Date.now() - 86400000 * 3).toISOString(), completedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: '2', name: 'Data Preprocessing', type: 'IO', size: 'MEDIUM', priority: 3, status: 'RUNNING', dueDate: null, predictedTime: 12.5, actualTime: null, resourceId: 'r2', resource: undefined, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), scheduledAt: new Date(Date.now() - 86400000).toISOString(), completedAt: null },
  { id: '3', name: 'Model Training', type: 'CPU', size: 'LARGE', priority: 5, status: 'SCHEDULED', dueDate: null, predictedTime: 120.0, actualTime: null, resourceId: 'r1', resource: undefined, createdAt: new Date(Date.now() - 86400000).toISOString(), scheduledAt: new Date().toISOString(), completedAt: null },
  { id: '4', name: 'Log Analysis', type: 'IO', size: 'SMALL', priority: 2, status: 'PENDING', dueDate: null, predictedTime: 5.3, actualTime: null, resourceId: null, resource: undefined, createdAt: new Date().toISOString(), scheduledAt: null, completedAt: null },
  { id: '5', name: 'Feature Extraction', type: 'MIXED', size: 'MEDIUM', priority: 4, status: 'COMPLETED', dueDate: null, predictedTime: 30.0, actualTime: 28.5, resourceId: 'r3', resource: undefined, createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), scheduledAt: new Date(Date.now() - 86400000 * 5).toISOString(), completedAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: '6', name: 'Report Generation', type: 'IO', size: 'SMALL', priority: 1, status: 'PENDING', dueDate: null, predictedTime: 3.2, actualTime: null, resourceId: null, resource: undefined, createdAt: new Date().toISOString(), scheduledAt: null, completedAt: null },
];

const demoResources: Resource[] = [
  { id: 'r1', name: 'GPU Server Alpha', capacity: 100, currentLoad: 78, status: 'BUSY', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r2', name: 'CPU Cluster Beta', capacity: 200, currentLoad: 35, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r3', name: 'Edge Node Gamma', capacity: 50, currentLoad: 12, status: 'AVAILABLE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r4', name: 'ML Worker Delta', capacity: 80, currentLoad: 0, status: 'OFFLINE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

/** Generate mock response matching ApiResponse<T> shape */
function mockResponse<T>(data: T): { data: ApiResponse<T> } {
  return { data: { success: true, data } as ApiResponse<T> };
}

/** Map of URL patterns to demo data generators */
function getDemoResponse(url: string, method: string): any {
  // Auth
  if (url.includes('/auth/me')) return mockResponse({ id: 'demo-user-001', email: 'demo@example.com', name: 'Demo User', role: 'ADMIN' });
  if (url.includes('/auth/')) return mockResponse({});

  // Tasks
  if (url.match(/\/v1\/tasks\/stats/)) return mockResponse({ total: 6, pending: 2, scheduled: 1, running: 1, completed: 2, failed: 0 });
  if (url.match(/\/v1\/tasks\/.+/) && method === 'get') return mockResponse(demoTasks[0]);
  if (url.includes('/v1/tasks')) return mockResponse(demoTasks);

  // Resources
  if (url.match(/\/v1\/resources\/stats/)) return mockResponse({ total: 4, available: 2, busy: 1, offline: 1, avgLoad: 31.25 });
  if (url.match(/\/v1\/resources\/.+/) && method === 'get') return mockResponse(demoResources[0]);
  if (url.includes('/v1/resources')) return mockResponse(demoResources);

  // Schedule
  if (url.includes('/v1/schedule/ml-status')) return mockResponse({ mlServiceAvailable: true, fallbackMode: false });
  if (url.includes('/v1/schedule/comparison')) return mockResponse({ withML: { count: 150, avgError: 2.3, avgTime: 45 }, withoutML: { count: 50, avgError: 8.7, avgTime: 120 } });
  if (url.includes('/v1/schedule/history')) return mockResponse([]);
  if (url.includes('/v1/schedule')) return mockResponse({ results: [], count: 0, scheduledAt: new Date().toISOString() });

  // Metrics
  if (url.includes('/v1/metrics/timeline')) return mockResponse([
    { date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0], tasksScheduled: 12, avgExecutionTime: 34, mlAccuracy: 89 },
    { date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], tasksScheduled: 18, avgExecutionTime: 29, mlAccuracy: 91 },
    { date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0], tasksScheduled: 15, avgExecutionTime: 31, mlAccuracy: 90 },
    { date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], tasksScheduled: 22, avgExecutionTime: 27, mlAccuracy: 92 },
    { date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], tasksScheduled: 20, avgExecutionTime: 25, mlAccuracy: 93 },
    { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], tasksScheduled: 25, avgExecutionTime: 24, mlAccuracy: 94 },
    { date: new Date().toISOString().split('T')[0], tasksScheduled: 8, avgExecutionTime: 22, mlAccuracy: 95 },
  ]);
  if (url.includes('/v1/metrics')) return mockResponse({
    tasks: { total: 6, pending: 2, scheduled: 1, running: 1, completed: 2, failed: 0 },
    resources: { total: 4, available: 2, busy: 1, offline: 1, avgLoad: 31.25 },
    performance: { avgExecutionTime: 35.65, mlAccuracy: 91.5, totalScheduled: 120 },
  });

  // Devices
  if (url.includes('/v1/devices/stats')) return mockResponse({ total: 3, active: 2, inactive: 1, error: 0, maintenance: 0, online: 2, offline: 1, byType: { sensor: 1, gateway: 1, edge: 1 } });
  if (url.includes('/v1/devices')) return mockResponse([]);

  // Fog Computing
  if (url.includes('/v1/fog/metrics')) return mockResponse({ metrics: [
    { taskCount: 50, completionTime: { hh: 2140, ipso: 2075, iaco: 2146, rr: 2357, minMin: 2355 }, energyConsumption: { hh: 19.5, ipso: 18.7, iaco: 19.4, rr: 20.7, minMin: 21.1 }, reliability: { hh: 14, ipso: 14, iaco: 16, rr: 14, minMin: 14 } },
    { taskCount: 100, completionTime: { hh: 4196, ipso: 3466, iaco: 3974, rr: 4709, minMin: 4710 }, energyConsumption: { hh: 47.4, ipso: 38.6, iaco: 44.5, rr: 49.5, minMin: 51.3 }, reliability: { hh: 21, ipso: 30, iaco: 25, rr: 23, minMin: 24 } },
    { taskCount: 200, completionTime: { hh: 8094, ipso: 7668, iaco: 7733, rr: 8645, minMin: 8676 }, energyConsumption: { hh: 78.2, ipso: 73.5, iaco: 74.3, rr: 79.8, minMin: 81.3 }, reliability: { hh: 23.5, ipso: 27, iaco: 24.5, rr: 20, minMin: 19 } },
  ] });
  if (url.includes('/v1/fog/tolerance')) return mockResponse({ metrics: [] });
  if (url.includes('/v1/fog/nodes')) return mockResponse([
    { id: 'fn1', name: 'Fog Node 1', computingResourceGHz: '2.4', networkBandwidthMbps: '100', currentLoadPercent: '45' },
    { id: 'fn2', name: 'Fog Node 2', computingResourceGHz: '3.2', networkBandwidthMbps: '200', currentLoadPercent: '30' },
    { id: 'fn3', name: 'Fog Node 3', computingResourceGHz: '1.8', networkBandwidthMbps: '50', currentLoadPercent: '60' },
  ]);
  if (url.includes('/v1/fog/compare') && method === 'post') return mockResponse({
    hybridHeuristic: { totalDelay: 2140, totalEnergy: 19.5, reliability: 14, executionTimeMs: 573 },
    ipso: { totalDelay: 2075, totalEnergy: 18.7, reliability: 14, executionTimeMs: 228 },
    iaco: { totalDelay: 2146, totalEnergy: 19.4, reliability: 16, executionTimeMs: 187 },
    roundRobin: { totalDelay: 2357, totalEnergy: 20.7, reliability: 14, executionTimeMs: 2 },
    minMin: { totalDelay: 2355, totalEnergy: 21.1, reliability: 14, executionTimeMs: 5 },
  });
  if (url.includes('/v1/fog/info')) return mockResponse({ fogNodes: 10, algorithms: ['HH', 'IPSO', 'IACO', 'RR', 'MinMin', 'FCFS'] });
  if (url.includes('/v1/fog')) return mockResponse({});

  // Reports
  if (url.includes('/v1/reports')) return mockResponse({ pdf: ['tasks', 'performance', 'resources'], csv: ['tasks', 'resources', 'schedule-history'] });

  // Experiments
  if (url.includes('/v1/experiments/results')) return mockResponse({ files: [] });
  if (url.includes('/v1/experiments/summary')) return mockResponse({});
  if (url.includes('/v1/experiments')) return mockResponse({});

  // Health
  if (url.includes('/health')) return mockResponse({ status: 'ok', demo: true });

  return null;
}

// Demo mode interceptor — returns mock data when backend is unavailable
api.interceptors.response.use(
  (response) => {
    // On Vercel, SPA rewrite returns 200 OK with HTML for API routes.
    // Detect this and swap in mock data instead of letting HTML propagate.
    const contentType = response.headers?.['content-type'] || '';
    const isHtml = contentType.includes('text/html') || (typeof response.data === 'string' && response.data.trimStart().startsWith('<!'));
    if (isHtml && response.config?.url?.includes('/v1/')) {
      const url = response.config.url || '';
      const method = (response.config.method || 'get').toLowerCase();
      const demoData = getDemoResponse(url, method);
      if (demoData) {
        if (!isDemoMode()) {
          localStorage.setItem(DEMO_MODE_KEY, JSON.stringify({
            id: 'demo-user-001', email: 'demo@example.com', name: 'Demo User', role: 'ADMIN'
          }));
        }
        return demoData;
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    // If in demo mode OR backend returns 405/404/502/503, serve mock data
    const status = error.response?.status;
    const isUnavailable = !error.response || status === 405 || status === 404 || status === 502 || status === 503;

    if (isUnavailable) {
      const url = error.config?.url || '';
      const method = (error.config?.method || 'get').toLowerCase();
      const demoData = getDemoResponse(url, method);

      if (demoData) {
        // If not already in demo mode, activate it
        if (!isDemoMode()) {
          localStorage.setItem(DEMO_MODE_KEY, JSON.stringify({
            id: 'demo-user-001', email: 'demo@example.com', name: 'Demo User', role: 'ADMIN'
          }));
        }
        return demoData;
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
