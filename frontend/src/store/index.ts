import { create } from 'zustand';
import { Task, Resource, Metrics, User, Notification, ChatRoom, ChatMessage, MailMessage } from '../types';
import { taskApi, resourceApi, metricsApi, scheduleApi, userApi, notificationApi, mlApi, chaosApi } from '../lib/api';

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

  // Users
  users: User[];
  usersLoading: boolean;
  fetchUsers: () => Promise<void>;

  // Notifications
  notifications: Notification[];
  notificationsLoading: boolean;
  fetchNotifications: () => Promise<void>;

  // Metrics
  metrics: Metrics | null;
  metricsLoading: boolean;
  fetchMetrics: () => Promise<void>;

  // ML Management
  mlAvailable: boolean;
  mlModels: any[];
  trainingJobs: any[];
  mlConfig: any | null;
  mlDataLoading: boolean;
  checkMlStatus: () => Promise<void>;
  fetchMlData: () => Promise<void>;
  updateMlConfig: (data: any) => Promise<void>;
  runRetrain: (reason?: string) => Promise<void>;

  // Chaos Engineering
  chaosExperiments: any[];
  chaosLoading: boolean;
  fetchChaosData: () => Promise<void>;
  startChaosExperiment: (params: { service: string; type: string; value: number }) => Promise<void>;
  stopChaosExperiment: (params: { service: string; type: string }) => Promise<void>;

  // Chat Module
  chatRooms: ChatRoom[];
  activeRoomId: string | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  fetchChatRooms: () => Promise<void>;
  fetchChatMessages: (roomId: string) => Promise<void>;
  setActiveRoom: (roomId: string | null) => void;
  sendChatMessage: (roomId: string, content: string) => Promise<void>;
  receiveChatMessage: (message: ChatMessage) => void;

  // Mail Module
  mails: MailMessage[];
  mailLoading: boolean;
  fetchMails: (folder?: string) => Promise<void>;
  sendMail: (data: any) => Promise<void>;

  // Scheduling
  scheduling: boolean;
  runScheduler: (taskIds?: string[]) => Promise<void>;

  // Error state
  error: string | null;
  clearError: () => void;
}

export const useStore = create<AppState>()((set, get) => ({
  // Tasks
  tasks: [],
  tasksLoading: false,
  fetchTasks: async (status?: string) => {
    set({ tasksLoading: true, error: null });
    try {
      const tasks = await taskApi.getAll(status);
      set({ tasks, tasksLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
      console.error('Failed to fetch tasks:', error);
      set({ tasksLoading: false, error: message });
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
    set({ resourcesLoading: true, error: null });
    try {
      const resources = await resourceApi.getAll(status);
      set({ resources, resourcesLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch resources';
      console.error('Failed to fetch resources:', error);
      set({ resourcesLoading: false, error: message });
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

  // Users
  users: [],
  usersLoading: false,
  fetchUsers: async () => {
    set({ usersLoading: true, error: null });
    try {
      const users = await userApi.getAll();
      set({ users, usersLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch users';
      set({ usersLoading: false, error: message });
    }
  },

  // Notifications
  notifications: [],
  notificationsLoading: false,
  fetchNotifications: async () => {
    set({ notificationsLoading: true, error: null });
    try {
      const notifications = await notificationApi.getAll();
      set({ notifications, notificationsLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
      set({ notificationsLoading: false, error: message });
    }
  },

  // Metrics
  metrics: null,
  metricsLoading: false,
  fetchMetrics: async () => {
    set({ metricsLoading: true, error: null });
    try {
      const metrics = await metricsApi.get();
      set({ metrics, metricsLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch metrics';
      console.error('Failed to fetch metrics:', error);
      set({ metricsLoading: false, error: message });
    }
  },

  // ML Management
  mlAvailable: false,
  mlModels: [],
  trainingJobs: [],
  mlConfig: null,
  mlDataLoading: false,
  checkMlStatus: async () => {
    try {
      const status = await scheduleApi.getMlStatus();
      set({ mlAvailable: status.mlServiceAvailable });
    } catch (error) {
      set({ mlAvailable: false });
    }
  },
  fetchMlData: async () => {
    set({ mlDataLoading: true, error: null });
    try {
      const [models, jobs, config] = await Promise.all([
        mlApi.getModels(),
        mlApi.getTrainingJobs(),
        mlApi.getConfig()
      ]);
      set({ mlModels: models, trainingJobs: jobs, mlConfig: config, mlDataLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch ML data';
      set({ mlDataLoading: false, error: message });
    }
  },
  updateMlConfig: async (data: any) => {
    try {
      const updated = await mlApi.updateConfig(data);
      set({ mlConfig: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update ML config';
      set({ error: message });
    }
  },
  runRetrain: async (reason?: string) => {
    try {
      await mlApi.runRetrain(reason);
      // Data will be refreshed via socket events
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run retraining';
      set({ error: message });
    }
  },

  // Chaos Engineering
  chaosExperiments: [],
  chaosLoading: false,
  fetchChaosData: async () => {
    set({ chaosLoading: true, error: null });
    try {
      const experiments = await chaosApi.getExperiments();
      set({ chaosExperiments: experiments, chaosLoading: false });
    } catch (error) {
      set({ chaosLoading: false });
    }
  },
  startChaosExperiment: async (params: { service: string; type: string; value: number }) => {
    try {
      await chaosApi.startExperiment(params);
      await get().fetchChaosData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start experiment';
      set({ error: message });
      throw error;
    }
  },
  stopChaosExperiment: async (params: { service: string; type: string }) => {
    try {
      await chaosApi.stopExperiment(params);
      await get().fetchChaosData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop experiment';
      set({ error: message });
      throw error;
    }
  },

  // Chat Module
  chatRooms: [],
  activeRoomId: null,
  chatMessages: [],
  chatLoading: false,
  fetchChatRooms: async () => {
    const { chatApi } = await import('../lib/api');
    set({ chatLoading: true });
    try {
      const rooms = await chatApi.getRooms();
      set({ chatRooms: rooms, chatLoading: false });
    } catch (error) {
      set({ chatLoading: false });
    }
  },
  fetchChatMessages: async (roomId: string) => {
    const { chatApi } = await import('../lib/api');
    set({ chatLoading: true });
    try {
      const messages = await chatApi.getMessages(roomId);
      set({ chatMessages: messages, chatLoading: false });
    } catch (error) {
      set({ chatLoading: false });
    }
  },
  setActiveRoom: (roomId: string | null) => set({ activeRoomId: roomId }),
  sendChatMessage: async (roomId: string, content: string) => {
    const { chatApi } = await import('../lib/api');
    try {
      await chatApi.sendMessage(roomId, content);
      // Room will be updated via socket
    } catch (error) {
      set({ error: 'Failed to send message' });
    }
  },
  receiveChatMessage: (message: ChatMessage) => {
    set((state) => {
      // If message is for active room, append it
      if (state.activeRoomId === message.roomId) {
        return { chatMessages: [message, ...state.chatMessages] };
      }
      return state;
    });
  },

  // Mail Module
  mails: [],
  mailLoading: false,
  fetchMails: async (folder = 'inbox') => {
    const { mailApi } = await import('../lib/api');
    set({ mailLoading: true });
    try {
      let mails = [];
      if (folder === 'sent') mails = await mailApi.getSent();
      else if (folder === 'drafts') mails = await mailApi.getDrafts();
      else mails = await mailApi.getInbox();
      set({ mails, mailLoading: false });
    } catch (error) {
      set({ mailLoading: false });
    }
  },
  sendMail: async (data: any) => {
    const { mailApi } = await import('../lib/api');
    try {
      await mailApi.send(data);
    } catch (error) {
      set({ error: 'Failed to send mail' });
    }
  },

  // Scheduling
  scheduling: false,
  runScheduler: async (taskIds?: string[]) => {
    set({ scheduling: true, error: null });
    try {
      await scheduleApi.run(taskIds);
      // Refresh tasks and resources after scheduling
      await get().fetchTasks();
      await get().fetchResources();
      await get().fetchMetrics();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run scheduler';
      console.error('Failed to run scheduler:', error);
      set({ error: message });
    } finally {
      set({ scheduling: false });
    }
  },

  // Error state
  error: null,
  clearError: () => set({ error: null }),
}));
