import axios from 'axios';
import type {
  Task,
  CreateTaskInput,
  Resource,
  CreateResourceInput,
  ScheduleResult,
  ScheduleHistory,
  Metrics,
  ApiResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Task API
export const taskApi = {
  getAll: async (status?: string): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Task[]>>('/tasks', { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  create: async (data: CreateTaskInput): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>('/tasks', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<CreateTaskInput>): Promise<Task> => {
    const response = await api.put<ApiResponse<Task>>(`/tasks/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  complete: async (id: string, actualTime: number): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>(`/tasks/${id}/complete`, { actualTime });
    return response.data.data;
  },

  getStats: async () => {
    const response = await api.get<ApiResponse<{ total: number; pending: number; scheduled: number; running: number; completed: number; failed: number }>>('/tasks/stats');
    return response.data.data;
  },
};

// Resource API
export const resourceApi = {
  getAll: async (status?: string): Promise<Resource[]> => {
    const params = status ? { status } : {};
    const response = await api.get<ApiResponse<Resource[]>>('/resources', { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<Resource> => {
    const response = await api.get<ApiResponse<Resource>>(`/resources/${id}`);
    return response.data.data;
  },

  create: async (data: CreateResourceInput): Promise<Resource> => {
    const response = await api.post<ApiResponse<Resource>>('/resources', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<CreateResourceInput>): Promise<Resource> => {
    const response = await api.put<ApiResponse<Resource>>(`/resources/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/resources/${id}`);
  },

  updateLoad: async (id: string, load: number): Promise<Resource> => {
    const response = await api.patch<ApiResponse<Resource>>(`/resources/${id}/load`, { load });
    return response.data.data;
  },

  getStats: async () => {
    const response = await api.get<ApiResponse<{ total: number; available: number; busy: number; offline: number; avgLoad: number }>>('/resources/stats');
    return response.data.data;
  },
};

// Schedule API
export const scheduleApi = {
  run: async (taskIds?: string[]): Promise<{ results: ScheduleResult[]; count: number; scheduledAt: string }> => {
    const response = await api.post<ApiResponse<{ results: ScheduleResult[]; count: number; scheduledAt: string }>>('/schedule', { taskIds });
    return response.data.data;
  },

  getHistory: async (limit?: number): Promise<ScheduleHistory[]> => {
    const params = limit ? { limit } : {};
    const response = await api.get<ApiResponse<ScheduleHistory[]>>('/schedule/history', { params });
    return response.data.data;
  },

  getComparison: async () => {
    const response = await api.get<ApiResponse<{ withML: { count: number; avgError: number; avgTime: number }; withoutML: { count: number; avgError: number; avgTime: number } }>>('/schedule/comparison');
    return response.data.data;
  },

  getMlStatus: async () => {
    const response = await api.get<ApiResponse<{ mlServiceAvailable: boolean; fallbackMode: boolean }>>('/schedule/ml-status');
    return response.data.data;
  },
};

// Metrics API
export const metricsApi = {
  get: async (): Promise<Metrics> => {
    const response = await api.get<ApiResponse<Metrics>>('/metrics');
    return response.data.data;
  },

  getTimeline: async (days?: number) => {
    const params = days ? { days } : {};
    const response = await api.get<ApiResponse<{ date: string; tasksScheduled: number; avgExecutionTime: number; mlAccuracy: number }[]>>('/metrics/timeline', { params });
    return response.data.data;
  },
};

export default api;
