/**
 * End-to-End Integration Test: Full Scheduling Pipeline
 *
 * Verifies the complete flow:
 *   task exists → schedulerService.schedule() → ML prediction →
 *   task status = SCHEDULED → prediction persisted → resource assigned
 *
 * Design:
 * - Mirrors the existing scheduler.service.test.ts pattern: uses jest.doMock()
 *   inside each test body + jest.resetModules() in beforeEach. This is the
 *   correct approach when other tests in the suite use the same pattern.
 * - All external I/O is mocked at module boundary — zero real DB/Redis/HTTP.
 * - Each it() block is fully self-contained and deterministic.
 */

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TASK_ID = 'task-e2e-001';
const RESOURCE_ID = 'resource-e2e-001';

const MOCK_TASK = () => ({
  id: TASK_ID,
  name: 'Integration Test Task',
  type: 'CPU',
  size: 'MEDIUM',
  priority: 4,
  status: 'PENDING',
  predictedTime: null,
  actualTime: null,
  resourceId: null,
  dueDate: new Date(Date.now() + 3_600_000),
  createdAt: new Date(),
  scheduledAt: null,
  completedAt: null,
  deletedAt: null,
});

const MOCK_RESOURCE = () => ({
  id: RESOURCE_ID,
  name: 'Test Server Alpha',
  capacity: 4,
  currentLoad: 20,
  status: 'AVAILABLE',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const PREDICTED_TIME = 7.5;
const PREDICTED_CONF = 0.88;

// ---------------------------------------------------------------------------
// Helper: register doMock calls + return a fresh SchedulerService
// ---------------------------------------------------------------------------
type SideEffects = {
  taskUpdates: Array<{ id: string; data: Record<string, unknown> }>;
  predictions: Array<Record<string, unknown>>;
  historyRecords: Array<Record<string, unknown>>;
  resourceUpdates: Array<{ id: string; load: number }>;
};

function setupMocksAndRequire(overrides: {
  pendingTasks?: unknown[];
  availableResources?: unknown[];
  rlResponse?: unknown;
} = {}): { scheduler: any; effects: SideEffects } {
  const effects: SideEffects = {
    taskUpdates: [],
    predictions: [],
    historyRecords: [],
    resourceUpdates: [],
  };

  const pending = overrides.pendingTasks ?? [MOCK_TASK()];
  const available = overrides.availableResources ?? [MOCK_RESOURCE()];
  const rlResp = overrides.rlResponse ?? null;

  jest.doMock('../lib/prisma', () => ({
    __esModule: true,
    default: {
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          effects.taskUpdates.push({ id: where.id, data });
          return Promise.resolve({ ...MOCK_TASK(), ...data });
        }),
      },
      scheduleHistory: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          effects.historyRecords.push(data);
          return Promise.resolve({ id: 'hist-001', ...data });
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      prediction: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          effects.predictions.push(data);
          return Promise.resolve({ id: 'pred-001', ...data });
        }),
      },
    },
  }));

  jest.doMock('../lib/logger', () => ({
    __esModule: true,
    default: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }));


  jest.doMock('../lib/redis', () => ({
    __esModule: true,
    default: {
      getJSON: jest.fn().mockResolvedValue(null),
      setJSON: jest.fn().mockResolvedValue(true),
      getClient: jest.fn().mockReturnValue(null),
      isAvailable: jest.fn().mockReturnValue(false),
    },
  }));


  jest.doMock('../services/errorRecovery.service', () => ({
    errorRecovery: {
      isServiceAvailable: jest.fn().mockReturnValue(true),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    },
  }));

  jest.doMock('../services/ml.service', () => ({
    mlService: {
      getBatchPredictions: jest.fn().mockImplementation((items: any[]) => {
        const result = new Map<string, { predictedTime: number; confidence: number }>();
        for (const item of items) {
          result.set(item.taskId, { predictedTime: PREDICTED_TIME, confidence: PREDICTED_CONF });
        }
        return Promise.resolve(result);
      }),
      savePrediction: jest.fn().mockImplementation((
        taskId: string, predictedTime: number, confidence: number, features: any, modelVersion: string,
      ) => {
        effects.predictions.push({ taskId, predictedTime, confidence, features, modelVersion });
        return Promise.resolve({ id: 'pred-auto', taskId });
      }),
      clearAllPredictions: jest.fn().mockResolvedValue(undefined),
      getRLSchedulingOrder: jest.fn().mockResolvedValue(rlResp),
    },
  }));

  jest.doMock('../services/resource.service', () => ({
    resourceService: {
      findAvailable: jest.fn().mockResolvedValue(available),
      updateLoad: jest.fn().mockImplementation((id: string, load: number) => {
        effects.resourceUpdates.push({ id, load });
        return Promise.resolve({ ...MOCK_RESOURCE(), currentLoad: load });
      }),
      decrementLoad: jest.fn().mockResolvedValue(undefined),
    },
  }));

  jest.doMock('../services/task.service', () => ({
    taskService: {
      findPending: jest.fn().mockResolvedValue(pending),
      assignToResource: jest.fn().mockImplementation((
        taskId: string, resourceId: string, predictedTime: number,
      ) => {
        effects.taskUpdates.push({ id: taskId, data: { resourceId, predictedTime, status: 'SCHEDULED' } });
        return Promise.resolve({ ...MOCK_TASK(), resourceId, predictedTime, status: 'SCHEDULED' });
      }),
    },
  }));

  jest.doMock('../services/fogComputing.service', () => ({
    useSeed: jest.fn(),
    generateSampleDevices: jest.fn().mockReturnValue([]),
    generateSampleTasks: jest.fn().mockReturnValue([]),
    generateSampleFogNodes: jest.fn().mockReturnValue([]),
    HybridHeuristicScheduler: jest.fn(),
    ipsoOnlySchedule: jest.fn(),
    iacoOnlySchedule: jest.fn(),
    roundRobinSchedule: jest.fn(),
    minMinSchedule: jest.fn(),
    fcfsSchedule: jest.fn(),
    calculateTotalDelay: jest.fn().mockReturnValue(5),
    calculateEnergyConsumption: jest.fn().mockReturnValue(1),
    runAlgorithmComparison: jest.fn(),
  }));

  const { schedulerService } = require('../services/scheduler.service');
  return { scheduler: schedulerService, effects };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E2E: Full Scheduling Pipeline (ml_enhanced)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  // ---------- 1. Returns result ----------------------------------------
  it('returns at least one scheduling result for a pending task', async () => {
    const { scheduler } = setupMocksAndRequire();
    const results = await scheduler.schedule(undefined, 'ml_enhanced');
    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBe(TASK_ID);
  });

  // ---------- 2. Resource assigned ------------------------------------
  it('assigns the task to a resource', async () => {
    const { scheduler } = setupMocksAndRequire();
    const results = await scheduler.schedule(undefined, 'ml_enhanced');
    expect(results[0].resourceId).toBe(RESOURCE_ID);
    expect(results[0].resourceName).toBe(MOCK_RESOURCE().name);
  });

  // ---------- 3. Task status = SCHEDULED ------------------------------
  it('records task assignment with SCHEDULED status', async () => {
    const { scheduler, effects } = setupMocksAndRequire();
    await scheduler.schedule(undefined, 'ml_enhanced');
    const update = effects.taskUpdates.find(u => u.id === TASK_ID);
    expect(update).toBeDefined();
    expect(update!.data.status).toBe('SCHEDULED');
  });

  // ---------- 4. Prediction persisted ---------------------------------
  it('persists an ML prediction for the task', async () => {
    const { scheduler, effects } = setupMocksAndRequire();
    await scheduler.schedule(undefined, 'ml_enhanced');
    expect(effects.predictions.length).toBeGreaterThan(0);
    expect(effects.predictions[0].taskId).toBe(TASK_ID);
    expect(effects.predictions[0].predictedTime).toBe(PREDICTED_TIME);
  });

  // ---------- 5. Predicted time in result -----------------------------
  it('returns the ML-predicted execution time in the result', async () => {
    const { scheduler } = setupMocksAndRequire();
    const results = await scheduler.schedule(undefined, 'ml_enhanced');
    expect(results[0].predictedTime).toBe(PREDICTED_TIME);
    expect(results[0].confidence).toBe(PREDICTED_CONF);
  });

  // ---------- 6. Resource load incremented ----------------------------
  it('increments resource load after scheduling', async () => {
    const { scheduler, effects } = setupMocksAndRequire();
    await scheduler.schedule(undefined, 'ml_enhanced');
    expect(effects.resourceUpdates.length).toBeGreaterThan(0);
    const update = effects.resourceUpdates.find(u => u.id === RESOURCE_ID);
    expect(update).toBeDefined();
    expect(update!.load).toBeGreaterThan(MOCK_RESOURCE().currentLoad);
  });

  // ---------- 7. History recorded -------------------------------------
  it('records a scheduling history entry', async () => {
    const { scheduler, effects } = setupMocksAndRequire();
    await scheduler.schedule(undefined, 'ml_enhanced');
    expect(effects.historyRecords.length).toBeGreaterThan(0);
    expect(effects.historyRecords[0]).toHaveProperty('taskId', TASK_ID);
    expect(effects.historyRecords[0]).toHaveProperty('resourceId', RESOURCE_ID);
  });

  // ---------- 8. Empty task list = empty result -----------------------
  it('returns empty array when no pending tasks exist', async () => {
    const { scheduler } = setupMocksAndRequire({ pendingTasks: [] });
    const results = await scheduler.schedule(undefined, 'ml_enhanced');
    expect(results).toHaveLength(0);
  });

  // ---------- 9. No resources = throws --------------------------------
  it('throws when no available resources', async () => {
    const { scheduler } = setupMocksAndRequire({ availableResources: [] });
    await expect(scheduler.schedule(undefined, 'ml_enhanced'))
      .rejects.toThrow('No available resources');
  });

  // ---------- 10. RL fallback when model absent -----------------------
  it('rl_ppo falls back gracefully when RL service returns null', async () => {
    const { scheduler } = setupMocksAndRequire({ rlResponse: null });
    const results = await scheduler.schedule(undefined, 'rl_ppo');
    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBe(TASK_ID);
    expect(results[0].algorithm).toBe('rl_ppo');
  });
});
