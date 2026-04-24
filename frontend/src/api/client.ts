import { taskApi, scheduleApi, metricsApi, fogApi } from '../lib/api';
import { Task, CreateTaskInput } from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  async getTasks(): Promise<Task[]> {
    return taskApi.getAll();
  }

  async createTask(data: CreateTaskInput): Promise<Task> {
    return taskApi.create(data);
  }

  async runScheduler(): Promise<void> {
    await scheduleApi.run();
  }

  async getAnalytics() {
    return metricsApi.get();
  }

  async compareAlgorithms(taskCount: number) {
    return fogApi.compare(taskCount);
  }

  async runFogScheduling(algorithm?: string) {
    return fogApi.schedule(algorithm);
  }

  exportCSV() {
    window.open(`${API_BASE}/api/v1/reports/csv/tasks`, '_blank');
  }

  exportPDF() {
    window.open(`${API_BASE}/api/v1/reports/pdf/tasks`, '_blank');
  }
}

export const api = new ApiClient();
export default api;
