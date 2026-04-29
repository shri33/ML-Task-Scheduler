// Task Types
export interface Task {
  id: string;
  name: string;
  type: 'CPU' | 'IO' | 'MIXED';
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  priority: number;
  status: 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  dueDate: string | null;
  predictedTime: number | null;
  actualTime: number | null;
  resourceId: string | null;
  resource?: Resource;
  createdAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CreateTaskInput {
  name: string;
  type: 'CPU' | 'IO' | 'MIXED';
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  priority: number;
  dueDate?: string | null;
}

// Resource Types
export interface Resource {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  layer: 'FOG' | 'CLOUD' | 'TERMINAL';
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
}

export interface CreateResourceInput {
  name: string;
  capacity: number;
}

export interface UpdateResourceInput {
  name?: string;
  capacity?: number;
  currentLoad?: number;
  status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
}

// Schedule Types
export interface ScheduleResult {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  predictedTime: number;
  confidence: number;
  score: number;
  explanation: string;
}

export interface ScheduleHistory {
  id: string;
  taskId: string;
  task: Pick<Task, 'id' | 'name' | 'type' | 'size' | 'priority'>;
  resourceId: string;
  resource: Pick<Resource, 'id' | 'name'>;
  algorithm: string;
  mlEnabled: boolean;
  predictedTime: number | null;
  actualTime: number | null;
  score: number | null;
  explanation: string | null;
  createdAt: string;
}

// Metrics Types
export interface TaskStats {
  total: number;
  pending: number;
  scheduled: number;
  running: number;
  completed: number;
  failed: number;
}

export interface ResourceStats {
  total: number;
  available: number;
  busy: number;
  offline: number;
  avgLoad: number;
  distribution: {
    FOG: number;
    CLOUD: number;
    TERMINAL: number;
  };
}

export interface Metrics {
  tasks: TaskStats;
  resources: ResourceStats;
  performance: {
    avgExecutionTime: number;
    mlAccuracy: number;
    totalScheduled: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'TASK' | 'SYSTEM' | 'ALERT';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
