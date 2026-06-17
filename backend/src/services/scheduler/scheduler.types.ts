export type SchedulingAlgorithm =
  | 'ml_enhanced'      // Original weighted scoring + ML predictions
  | 'hybrid_heuristic' // IPSO + IACO hybrid (HH)
  | 'ipso'             // Improved Particle Swarm Optimization
  | 'iaco'             // Improved Ant Colony Optimization
  | 'round_robin'      // Round-Robin baseline
  | 'min_min'          // Min-Min heuristic
  | 'fcfs'             // First-Come-First-Served baseline
  | 'edf'              // Earliest Deadline First
  | 'sjf'              // Shortest Job First (by predicted time)
  | 'rl_ppo';          // PPO reinforcement learning agent

export interface SchedulingContext {
  seed?: number;
  timeBudgetMs?: number;
  userProfile?: {
    avgCompletionRate: number;
    avgLateness: number;
    productivityPattern: string | null;
  };
  predictions?: Map<string, { predictedTime: number; confidence: number; modelVersion: string }>;
}

export interface AlgorithmInfo {
  id: SchedulingAlgorithm;
  name: string;
  category: 'optimization' | 'heuristic' | 'ml' | 'baseline';
  description: string;
  complexity: string;
}

export interface Task {
  id: string;
  name: string;
  type: string;
  size: string;
  priority: number;
  status: string;
  predictedTime: number | null;
  actualTime: number | null;
  resourceId: string | null;
  dueDate: Date | null;
  createdAt: Date;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

export interface Resource {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleResult {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  predictedTime: number;
  confidence: number;
  score: number;
  explanation: string;
  algorithm: SchedulingAlgorithm;
}

export interface ResourceScore {
  resource: Resource;
  score: number;
  predictedTime: number;
  confidence: number;
}

export interface ComparisonResult {
  algorithm: SchedulingAlgorithm;
  algorithmName: string;
  totalDelay: number;
  totalEnergy: number;
  fitness: number;
  reliability: number;
  tasksScheduled: number;
  latencyMs: number;
}

export const LOAD_DELTA_MAP: Record<string, number> = {
  SMALL: 10,
  MEDIUM: 15,
  LARGE: 25,
};

export const ALGORITHM_REGISTRY: AlgorithmInfo[] = [
  {
    id: 'ml_enhanced',
    name: 'ML-Enhanced Scheduling',
    category: 'ml',
    description: 'Weighted scoring using ML-predicted execution times, resource load balancing, and task priority.',
    complexity: 'O(n·m) where n=tasks, m=resources',
  },
  {
    id: 'hybrid_heuristic',
    name: 'Hybrid Heuristic (IPSO+IACO)',
    category: 'optimization',
    description: 'Two-phase meta-heuristic: Improved PSO explores, then Improved ACO refines. Research-grade algorithm from Wang & Li (2019).',
    complexity: 'O(P·K·n·m) where P=particles/ants, K=iterations',
  },
  {
    id: 'ipso',
    name: 'Improved PSO',
    category: 'optimization',
    description: 'Improved Particle Swarm Optimization with adaptive inertia weight and contraction factor.',
    complexity: 'O(P·K·n·m)',
  },
  {
    id: 'iaco',
    name: 'Improved ACO',
    category: 'optimization',
    description: 'Improved Ant Colony Optimization with regulatory factor and improved heuristic information.',
    complexity: 'O(A·K·n·m)',
  },
  {
    id: 'edf',
    name: 'Earliest Deadline First',
    category: 'heuristic',
    description: 'Classic real-time scheduling: tasks sorted by deadline urgency, assigned to least-loaded resource.',
    complexity: 'O(n·log(n))',
  },
  {
    id: 'sjf',
    name: 'Shortest Job First',
    category: 'heuristic',
    description: 'Tasks sorted by ML-predicted execution time (shortest first), minimizes average wait time.',
    complexity: 'O(n·log(n))',
  },
  {
    id: 'round_robin',
    name: 'Round-Robin',
    category: 'baseline',
    description: 'Simple cyclic allocation. Baseline for fairness comparison.',
    complexity: 'O(n)',
  },
  {
    id: 'min_min',
    name: 'Min-Min',
    category: 'heuristic',
    description: 'Selects shortest task first and assigns it to the resource that finishes it soonest.',
    complexity: 'O(n²·m)',
  },
  {
    id: 'fcfs',
    name: 'First-Come-First-Served',
    category: 'baseline',
    description: 'Tasks processed in arrival order. Baseline for comparison.',
    complexity: 'O(n)',
  },
  {
    id: 'rl_ppo',
    name: 'PPO Reinforcement Learning',
    category: 'ml',
    description: 'MaskablePPO agent with attention-based feature extractor. Learns task ordering from quadratic lateness + context-switch rewards. Falls back to priority-EDF if model not loaded.',
    complexity: 'O(n) inference (trained offline)',
  },
];
