import { create } from 'zustand';
import { Task, Resource, Metrics } from '../types';
import { taskApi, resourceApi, metricsApi, scheduleApi } from '../lib/api';

interface AppState {
  // Tasks
  tasks: Task[];
  tasksLoading: boolean;
  fetchTasks: (status?: string) => Promise<void>;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;

  // Resources
  resources: Resource[];
  resourcesLoading: boolean;
  fetchResources: (status?: string) => Promise<void>;
  addResource: (resource: Resource) => void;
  updateResource: (resource: Resource) => void;
  removeResource: (id: string) => void;

  // Metrics
  metrics: Metrics | null;
  metricsLoading: boolean;
  fetchMetrics: () => Promise<void>;

  // ML Status
  mlAvailable: boolean;
  checkMlStatus: () => Promise<void>;

  // Scheduling
  scheduling: boolean;
  runScheduler: (taskIds?: string[]) => Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  // Tasks
  tasks: [],
  tasksLoading: false,
  fetchTasks: async (status?: string) => {
    set({ tasksLoading: true });
    try {
      const tasks = await taskApi.getAll(status);
      set({ tasks, tasksLoading: false });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      set({ tasksLoading: false });
    }
  },
  addTask: (task: Task) => set((state: AppState) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (task: Task) =>
    set((state: AppState) => ({
      tasks: state.tasks.map((t: Task) => (t.id === task.id ? task : t)),
    })),
  removeTask: (id: string) =>
    set((state: AppState) => ({
      tasks: state.tasks.filter((t: Task) => t.id !== id),
    })),

  // Resources
  resources: [],
  resourcesLoading: false,
  fetchResources: async (status?: string) => {
    set({ resourcesLoading: true });
    try {
      const resources = await resourceApi.getAll(status);
      set({ resources, resourcesLoading: false });
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      set({ resourcesLoading: false });
    }
  },
  addResource: (resource: Resource) =>
    set((state: AppState) => ({ resources: [resource, ...state.resources] })),
  updateResource: (resource: Resource) =>
    set((state: AppState) => ({
      resources: state.resources.map((r: Resource) => (r.id === resource.id ? resource : r)),
    })),
  removeResource: (id: string) =>
    set((state: AppState) => ({
      resources: state.resources.filter((r: Resource) => r.id !== id),
    })),

  // Metrics
  metrics: null,
  metricsLoading: false,
  fetchMetrics: async () => {
    set({ metricsLoading: true });
    try {
      const metrics = await metricsApi.get();
      set({ metrics, metricsLoading: false });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      set({ metricsLoading: false });
    }
  },

  // ML Status
  mlAvailable: false,
  checkMlStatus: async () => {
    try {
      const status = await scheduleApi.getMlStatus();
      set({ mlAvailable: status.mlServiceAvailable });
    } catch (error) {
      set({ mlAvailable: false });
    }
  },

  // Scheduling
  scheduling: false,
  runScheduler: async (taskIds?: string[]) => {
    set({ scheduling: true });
    try {
      await scheduleApi.run(taskIds);
      // Refresh tasks and resources after scheduling
      await get().fetchTasks();
      await get().fetchResources();
      await get().fetchMetrics();
    } catch (error) {
      console.error('Failed to run scheduler:', error);
    } finally {
      set({ scheduling: false });
    }
  },
}));
