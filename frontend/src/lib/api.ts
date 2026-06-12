import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Task,
  CreateTaskInput,
  Resource,
  ScheduleResult,
  Metrics,
  ApiResponse,
  User,
  Notification
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

export interface FogAlgorithmMetrics {
  hh: number;
  ipso: number;
  iaco: number;
  fcfs: number;
  rr: number;
  minMin: number;
}

export interface FogMetrics {
  taskCount: number;
  completionTime: FogAlgorithmMetrics;
  energyConsumption: FogAlgorithmMetrics;
  reliability: FogAlgorithmMetrics;
}

export interface AlgorithmResult {
  totalDelay: number;
  totalEnergy: number;
  reliability: number;
  executionTimeMs: number;
}

export interface AlgorithmComparison {
  testParameters: {
    taskCount: number;
    fogNodeCount: number;
    deviceCount: number;
  };
  results: {
    hybridHeuristic: AlgorithmResult;
    ipso: AlgorithmResult;
    iaco: AlgorithmResult;
    fcfs: AlgorithmResult;
    roundRobin: AlgorithmResult;
    minMin: AlgorithmResult;
  };
  improvements: {
    hhVsRoundRobin: { delayReduction: string; energyReduction: string; reliabilityGain: string };
    hhVsFCFS: { delayReduction: string; energyReduction: string; reliabilityGain: string };
    hhVsMinMin: { delayReduction: string; energyReduction: string; reliabilityGain: string };
    hhVsIPSO: { delayReduction: string; reliabilityGain: string };
    hhVsIACO: { delayReduction: string; reliabilityGain: string };
  };
  totalComparisonTimeMs: number;
}

export interface FogInfo {
  description: string;
  algorithm: string;
  reference: string;
  capabilities: {
    algorithms: string[];
    metrics: string[];
    features: string[];
  };
  currentState: {
    fogNodes: number;
    terminalDevices: number;
    pendingTasks: number;
  };
}

export interface FogTerminalDevice {
  id: string;
  name: string;
  transmissionPower: number;
  idlePower: number;
  isMobile: boolean;
  delayWeight: number;
  energyWeight: number;
  residualEnergy: number | null;
}

export interface FogTask {
  id: string;
  name: string;
  dataSize: number;
  dataSizeMb?: string;
  computationIntensity: number;
  maxToleranceTime: number;
  maxToleranceTimeSec?: string;
  terminalDeviceId: string;
  priority: number;
}

export interface ToleranceReliabilityMetric {
  maxToleranceTime: number;
  reliability: {
    hh: number;
    ipso: number;
    iaco: number;
    rr: number;
  };
}

export interface FogScheduleResult {
  algorithm: string;
  executionTimeMs: number;
  metrics: {
    totalDelay: number;
    totalEnergy: number;
    fitness: number;
    reliability: number;
  };
  allocations: Record<string, string>;
  summary: {
    tasksScheduled: number;
    fogNodesUsed: number;
    avgDelayPerTask: number;
    avgEnergyPerTask: number;
  };
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

const DEMO_MODE_KEY_V1 = 'ml-scheduler-demo-mode';
const DEMO_MODE_KEY_V2 = 'ml-scheduler-demo-mode-v2';
const isDemoMode = () => !!localStorage.getItem(DEMO_MODE_KEY_V2) || !!localStorage.getItem(DEMO_MODE_KEY_V1);

// Token management
let isRefreshing = false;
let refreshFailedAt = 0;
const REFRESH_RETRY_COOLDOWN_MS = 30_000;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

// Client-side logout and redirect callback registry
let logoutCallback: (() => void) | null = null;
let redirectCallback: ((path: string) => void) | null = null;

export const registerLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

export const registerRedirectCallback = (cb: (path: string) => void) => {
  redirectCallback = cb;
};

export const triggerLogout = () => {
  if (logoutCallback) {
    logoutCallback();
  }
  if (redirectCallback) {
    redirectCallback('/login');
  } else {
    const isAuthPage = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/not-logged-in') || window.location.pathname.startsWith('/register');
    if (!isAuthPage && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
  }
};

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
      const now = Date.now();
      if (refreshFailedAt && now - refreshFailedAt < REFRESH_RETRY_COOLDOWN_MS) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await axios.post('/v1/auth/refresh', {}, { baseURL: api.defaults.baseURL, withCredentials: true, timeout: 5000 });
        refreshFailedAt = 0;
        processQueue(null, '');
        return api(originalRequest);
      } catch (refreshError) {
        refreshFailedAt = Date.now();
        processQueue(refreshError as Error, null);
        
        // Trigger client-side logout to clear AuthContext state and transition routes cleanly
        triggerLogout();
        
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
    const response = await api.get<ApiResponse<AuthUser>>(`/v1/auth/me?t=${Date.now()}`);
    return (response.data.data as any)?.user ?? response.data.data;
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
  getComments: (id: string) => Promise<any[]>;
  addComment: (id: string, content: string) => Promise<any>;
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
    const response = await api.put<ApiResponse<Task>>(`/v1/tasks/${id}`, data);
    return response.data.data;
  },
  getComments: async (id: string): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>(`/v1/tasks/${id}/comments`);
    return response.data.data;
  },
  addComment: async (id: string, content: string): Promise<any> => {
    const response = await api.post<ApiResponse<any>>(`/v1/tasks/${id}/comments`, { content });
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

const FOG_LONG_TIMEOUT = 120_000;

export const fogApi = {
  getInfo: async (): Promise<FogInfo> => {
    const response = await api.get<ApiResponse<FogInfo>>('/v1/fog/info');
    return response.data.data;
  },
  getNodes: async (): Promise<FogNode[]> => {
    const response = await api.get<ApiResponse<FogNode[]>>('/v1/fog/nodes');
    return response.data.data;
  },
  getDevices: async (): Promise<FogTerminalDevice[]> => {
    const response = await api.get<ApiResponse<FogTerminalDevice[]>>('/v1/fog/devices');
    return response.data.data;
  },
  getTasks: async (): Promise<FogTask[]> => {
    const response = await api.get<ApiResponse<FogTask[]>>('/v1/fog/tasks');
    return response.data.data;
  },
  createTask: async (data: Partial<FogTask>): Promise<FogTask> => {
    const response = await api.post<ApiResponse<FogTask>>('/v1/fog/tasks', data);
    return response.data.data;
  },
  addBulkTasks: async (tasks: Partial<FogTask>[]): Promise<unknown> => {
    const response = await api.post<ApiResponse<unknown>>('/v1/fog/tasks/bulk', { tasks });
    return response.data.data;
  },
  schedule: async (algorithm?: string): Promise<FogScheduleResult> => {
    const response = await api.post<ApiResponse<FogScheduleResult>>('/v1/fog/schedule', { algorithm }, { timeout: FOG_LONG_TIMEOUT });
    return response.data.data;
  },
  compare: async (taskCount: number): Promise<AlgorithmComparison> => {
    const response = await api.post<ApiResponse<AlgorithmComparison>>('/v1/fog/compare', { taskCount }, { timeout: FOG_LONG_TIMEOUT });
    return response.data.data;
  },
  getMetrics: async (): Promise<{ metrics: FogMetrics[]; chartData?: Record<string, unknown[]> }> => {
    const response = await api.get<ApiResponse<{ metrics: FogMetrics[]; chartData?: Record<string, unknown[]> }>>('/v1/fog/metrics', { timeout: FOG_LONG_TIMEOUT });
    return response.data.data;
  },
  getToleranceReliability: async (): Promise<{ metrics: ToleranceReliabilityMetric[]; chartData?: unknown[] }> => {
    const response = await api.get<ApiResponse<{ metrics: ToleranceReliabilityMetric[]; chartData?: unknown[] }>>('/v1/fog/tolerance-reliability', { timeout: FOG_LONG_TIMEOUT });
    return response.data.data;
  },
  reset: async (taskCount?: number): Promise<void> => {
    await api.post('/v1/fog/reset', { taskCount });
  },
  exportCsv: async (): Promise<Blob> => {
    const response = await api.get('/v1/fog/export/csv', { responseType: 'blob', timeout: FOG_LONG_TIMEOUT });
    return response.data;
  },
  exportJson: async (): Promise<Record<string, unknown>> => {
    const response = await api.get<Record<string, unknown>>('/v1/fog/export/json', { timeout: FOG_LONG_TIMEOUT });
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

export const userApi = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get<ApiResponse<User[]>>('/v1/users');
    return response.data.data;
  },
  getById: async (id: string): Promise<User> => {
    const response = await api.get<ApiResponse<User>>(`/v1/users/${id}`);
    return response.data.data;
  },
  create: async (data: { email: string; name: string; password: string; role?: string }): Promise<User> => {
    const response = await api.post<ApiResponse<User>>('/v1/users', data);
    return response.data.data;
  },
  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await api.patch<ApiResponse<User>>(`/v1/users/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/users/${id}`);
  }
};

export const notificationApi = {
  getAll: async (): Promise<Notification[]> => {
    const response = await api.get<ApiResponse<Notification[]>>('/v1/users/notifications');
    return response.data.data;
  }
};

export const mlApi = {
  getModels: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/ml/models');
    return response.data.data;
  },
  getConfig: async (): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/v1/ml/config');
    return response.data.data;
  },
  updateConfig: async (data: any): Promise<any> => {
    const response = await api.patch<ApiResponse<any>>('/v1/ml/config', data);
    return response.data.data;
  },
  runRetrain: async (reason?: string): Promise<{ jobId: string, message: string }> => {
    const response = await api.post<ApiResponse<{ jobId: string, message: string }>>('/v1/ml/retrain', { reason });
    return response.data.data;
  },
  getTrainingJobs: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/ml/training-jobs');
    return response.data.data;
  },
  getInfo: async (): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/v1/ml/info');
    return response.data.data;
  }
};

export const chatApi = {
  getRooms: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/chat/rooms');
    return response.data.data;
  },
  getMessages: async (roomId: string, limit?: number, cursor?: string): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>(`/v1/chat/rooms/${roomId}/messages`, { params: { limit, cursor } });
    return response.data.data;
  },
  sendMessage: async (roomId: string, content: string, type?: string): Promise<any> => {
    const response = await api.post<ApiResponse<any>>(`/v1/chat/rooms/${roomId}/messages`, { content, type });
    return response.data.data;
  },
  createRoom: async (memberIds: string[], name?: string, type?: string): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/chat/rooms', { memberIds, name, type });
    return response.data.data;
  }
};

export const mailApi = {
  getInbox: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/mail/inbox');
    return response.data.data;
  },
  getSent: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/mail/sent');
    return response.data.data;
  },
  getDrafts: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/mail/drafts');
    return response.data.data;
  },
  send: async (data: { recipients: string[]; subject: string; content: string }): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/mail/send', data);
    return response.data.data;
  },
  markRead: async (id: string, isRead: boolean): Promise<any> => {
    const response = await api.patch<ApiResponse<any>>(`/v1/mail/${id}/read`, { isRead });
    return response.data.data;
  }
};

export const chaosApi = {
  getExperiments: async (): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/v1/chaos/experiments');
    return response.data.data;
  },
  startExperiment: async (params: { service: string; type: string; value: number }): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/chaos/start', params);
    return response.data.data;
  },
  stopExperiment: async (params: { service: string; type: string }): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/chaos/stop', params);
    return response.data.data;
  },
  stopAll: async (): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/chaos/stop-all');
    return response.data.data;
  }
};

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  type: 'task';
  meta?: {
    status: string;
    priority: number;
    taskType: string;
    resource?: string;
  };
}

export const calendarApi = {
  getEvents: async (start?: string, end?: string): Promise<CalendarEvent[]> => {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const response = await api.get<ApiResponse<CalendarEvent[]>>('/v1/calendar/events', { params });
    return response.data.data;
  },
  createEvent: async (data: { title: string; startDate: string; description?: string; taskId?: string }): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/v1/calendar/events', data);
    return response.data.data;
  },
  updateEvent: async (id: string, data: { startDate?: string; endDate?: string }): Promise<any> => {
    const response = await api.patch<ApiResponse<any>>(`/v1/calendar/events/${id}`, data);
    return response.data.data;
  },
  deleteEvent: async (id: string): Promise<void> => {
    await api.delete(`/v1/calendar/events/${id}`);
  }
};

export const settingsApi = {
  get: async (): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/v1/users/settings');
    return response.data.data;
  },
  update: async (data: any): Promise<any> => {
    const response = await api.patch<ApiResponse<any>>('/v1/users/settings', data);
    return response.data.data;
  }
};

export default api;
