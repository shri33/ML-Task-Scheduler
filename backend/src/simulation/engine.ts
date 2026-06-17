/**
 * Discrete Event Simulation Engine
 * =================================
 * Core event-driven simulation loop for the fog scheduling platform.
 *
 * The engine operates on a priority queue of SimEvents ordered by time.
 * Each tick processes all events at the current time, then advances.
 *
 * Architecture:
 *   1. Initialize topology, nodes, queues, resources
 *   2. Load workload (trace or synthetic) → inject TASK_ARRIVE events
 *   3. Generate failure schedule → inject failure events
 *   4. Run scheduling algorithm at each SCHEDULE_TICK
 *   5. Process task lifecycle: arrive → queue → transfer → execute → complete/fail
 *   6. Collect metrics at each step
 *   7. Export results
 */

import {
  SimNode,
  SimTask,
  SimEvent,
  SimEventType,
  SimulationClock,
  ExperimentConfig,
  RunMetrics,
  TaskState,
  SchedulingDecision,
  SchedulingSolution,
  NodeTier,
  QueueDiscipline,
} from './types';
import {
  mulberry32,
  DEFAULT_RESOURCE_PROFILES,
  DEFAULT_QUEUE_DISCIPLINES,
  generateSeeds,
} from './config';
import {
  generateFailureSchedule,
  applyNodeCrash,
  applyNodeRecovery,
  shouldRetry,
  calculateRetryDelay,
  DEFAULT_RETRY_POLICY,
  FailureSchedule,
  FailureType,
} from './failures/injector';
import { calculateRunMetrics } from './evaluation/metrics';

// ---------------------------------------------------------------------------
// Priority Queue for Events
// ---------------------------------------------------------------------------

class EventQueue {
  private heap: SimEvent[] = [];

  get length(): number {
    return this.heap.length;
  }

  push(event: SimEvent): void {
    this.heap.push(event);
    this.siftUp(this.heap.length - 1);
  }

  pop(): SimEvent | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  peek(): SimEvent | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  private siftUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[parent].time <= this.heap[idx].time) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private siftDown(idx: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left].time < this.heap[smallest].time) smallest = left;
      if (right < n && this.heap[right].time < this.heap[smallest].time) smallest = right;
      if (smallest === idx) break;
      [this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]];
      idx = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduler Interface
// ---------------------------------------------------------------------------

/**
 * All scheduling algorithms must implement this interface.
 * The engine calls `schedule()` at each SCHEDULE_TICK event.
 */
export interface SchedulerPlugin {
  readonly name: string;
  schedule(context: ScheduleContext): SchedulingSolution;
}

export interface ScheduleContext {
  /** Tasks currently waiting for assignment. */
  pendingTasks: SimTask[];
  /** All nodes in the topology. */
  nodes: Map<string, SimNode>;
  /** Current simulation time. */
  currentTime: number;
  /** Seeded PRNG for this run. */
  rng: () => number;
  /** Function to get transfer time between two nodes. */
  getTransferTime: (fromNodeId: string, toNodeId: string, dataSizeMB: number) => number;
  /** Function to get queue wait estimate at a node. */
  getQueueWait: (nodeId: string) => number;
  /** Function to check if a task can fit on a node. */
  canAllocate: (nodeId: string, task: SimTask) => boolean;
}

// ---------------------------------------------------------------------------
// Simulation Engine
// ---------------------------------------------------------------------------

export interface SimulationResult {
  metrics: RunMetrics;
  tasks: SimTask[];
  events: SimEvent[];
  decisions: SchedulingDecision[];
}

export class SimulationEngine {
  private clock: SimulationClock;
  private eventQueue: EventQueue;
  private nodes: Map<string, SimNode>;
  private tasks: Map<string, SimTask>;
  private allTasks: SimTask[];
  private rng: () => number;
  private scheduler: SchedulerPlugin;
  private config: ExperimentConfig;
  private eventLog: SimEvent[];
  private decisions: SchedulingDecision[];
  private failureSchedule: FailureSchedule[];
  private activeTransfers: Map<string, { taskId: string; completionTime: number }>;

  // Pluggable hooks for topology/queue/resource subsystems
  private transferTimeFn: (fromNodeId: string, toNodeId: string, dataSizeMB: number) => number;
  private queueWaitFn: (nodeId: string) => number;
  private canAllocateFn: (nodeId: string, task: SimTask) => boolean;
  private allocateFn: (nodeId: string, taskId: string, task: SimTask) => void;
  private releaseFn: (nodeId: string, taskId: string) => void;
  private enqueueFn: (nodeId: string, task: SimTask) => void;
  private dequeueFn: (nodeId: string) => SimTask | null;

  constructor(
    config: ExperimentConfig,
    scheduler: SchedulerPlugin,
    seed: number,
    hooks: SimulationHooks,
  ) {
    this.config = config;
    this.scheduler = scheduler;
    this.rng = mulberry32(seed);
    this.eventQueue = new EventQueue();
    this.nodes = new Map();
    this.tasks = new Map();
    this.allTasks = [];
    this.eventLog = [];
    this.decisions = [];
    this.failureSchedule = [];
    this.activeTransfers = new Map();

    this.clock = {
      currentTime: 0,
      tickSize: 0.1, // 100ms granularity
      horizon: config.timeHorizon,
    };

    // Bind hooks
    this.transferTimeFn = hooks.getTransferTime;
    this.queueWaitFn = hooks.getQueueWait;
    this.canAllocateFn = hooks.canAllocate;
    this.allocateFn = hooks.allocate;
    this.releaseFn = hooks.release;
    this.enqueueFn = hooks.enqueue;
    this.dequeueFn = hooks.dequeue;
  }

  /**
   * Initialize nodes in the simulation.
   */
  initializeNodes(nodes: SimNode[]): void {
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  /**
   * Load tasks and schedule their arrival events.
   */
  loadTasks(tasks: SimTask[]): void {
    this.allTasks = tasks;
    for (const task of tasks) {
      this.tasks.set(task.id, task);
      this.eventQueue.push({
        type: SimEventType.TASK_ARRIVE,
        time: task.submitTime,
        payload: { taskId: task.id },
      });
    }
  }

  /**
   * Generate and schedule failure events.
   */
  initializeFailures(): void {
    this.failureSchedule = generateFailureSchedule(
      this.config.failureConfig,
      this.nodes,
      this.config.timeHorizon,
      Math.floor(this.rng() * 2147483647),
    );

    for (const failure of this.failureSchedule) {
      if (failure.type === FailureType.NODE_CRASH) {
        this.eventQueue.push({
          type: SimEventType.NODE_FAIL,
          time: failure.time,
          payload: { nodeId: failure.targetId, duration: failure.duration },
        });
      } else if (failure.type === FailureType.NETWORK_PARTITION) {
        this.eventQueue.push({
          type: SimEventType.NETWORK_PARTITION,
          time: failure.time,
          payload: { nodeIds: failure.targetId, duration: failure.duration },
        });
      } else if (failure.type === FailureType.CONGESTION_STORM) {
        this.eventQueue.push({
          type: SimEventType.CONGESTION_SPIKE,
          time: failure.time,
          payload: { nodeId: failure.targetId, duration: failure.duration, severity: failure.params.severity },
        });
      }
    }
  }

  /**
   * Schedule periodic scheduling ticks.
   */
  initializeScheduleTicks(intervalSec: number): void {
    let t = intervalSec;
    while (t < this.config.timeHorizon) {
      this.eventQueue.push({
        type: SimEventType.SCHEDULE_TICK,
        time: t,
        payload: {},
      });
      t += intervalSec;
    }
  }

  /**
   * Run the complete simulation.
   * Returns metrics for this run.
   */
  run(): SimulationResult {
    const startWallTime = performance.now();

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.pop()!;
      if (event.time > this.config.timeHorizon) break;

      this.clock.currentTime = event.time;
      this.processEvent(event);
    }

    const solverTimeMs = performance.now() - startWallTime;

    const metrics = calculateRunMetrics(
      this.allTasks,
      this.nodes,
      solverTimeMs,
      this.config.timeHorizon,
    );

    return {
      metrics,
      tasks: this.allTasks,
      events: this.eventLog,
      decisions: this.decisions,
    };
  }

  // ---------------------------------------------------------------------------
  // Event Processing
  // ---------------------------------------------------------------------------

  private processEvent(event: SimEvent): void {
    this.eventLog.push(event);

    switch (event.type) {
      case SimEventType.TASK_ARRIVE:
        this.handleTaskArrive(event);
        break;
      case SimEventType.SCHEDULE_TICK:
        this.handleScheduleTick(event);
        break;
      case SimEventType.TRANSFER_COMPLETE:
        this.handleTransferComplete(event);
        break;
      case SimEventType.TASK_START:
        this.handleTaskStart(event);
        break;
      case SimEventType.TASK_COMPLETE:
        this.handleTaskComplete(event);
        break;
      case SimEventType.TASK_FAIL:
        this.handleTaskFail(event);
        break;
      case SimEventType.NODE_FAIL:
        this.handleNodeFail(event);
        break;
      case SimEventType.NODE_RECOVER:
        this.handleNodeRecover(event);
        break;
      default:
        break;
    }
  }

  private handleTaskArrive(event: SimEvent): void {
    const taskId = event.payload.taskId as string;
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Check if all dependencies are completed
    const depsCompleted = task.dependencies.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep && dep.state === TaskState.COMPLETED;
    });

    if (depsCompleted) {
      task.state = TaskState.WAITING;
    }
    // If deps not met, task stays in WAITING and will be picked up by scheduler later
  }

  private handleScheduleTick(_event: SimEvent): void {
    // Gather pending tasks (WAITING + deps met)
    const pendingTasks: SimTask[] = [];
    for (const task of this.allTasks) {
      if (task.state !== TaskState.WAITING) continue;

      const depsCompleted = task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.state === TaskState.COMPLETED;
      });
      if (depsCompleted) {
        pendingTasks.push(task);
      }
    }

    if (pendingTasks.length === 0) return;

    // Run scheduler
    const context: ScheduleContext = {
      pendingTasks,
      nodes: this.nodes,
      currentTime: this.clock.currentTime,
      rng: this.rng,
      getTransferTime: this.transferTimeFn,
      getQueueWait: this.queueWaitFn,
      canAllocate: this.canAllocateFn,
    };

    const solution = this.scheduler.schedule(context);
    this.decisions.push(...solution.decisions);

    // Apply scheduling decisions
    for (const decision of solution.decisions) {
      const task = this.tasks.get(decision.taskId);
      const node = this.nodes.get(decision.targetNodeId);
      if (!task || !node || !node.alive) continue;

      // Validate placement
      if (!this.canAllocateFn(decision.targetNodeId, task)) continue;

      task.assignedNodeId = decision.targetNodeId;
      task.state = TaskState.QUEUED;

      // Calculate transfer time
      const transferTime = this.transferTimeFn(task.originNodeId, decision.targetNodeId, task.dataSizeMB);
      task.transferTime = transferTime;

      if (transferTime > 0.001) {
        // Schedule transfer completion
        this.eventQueue.push({
          type: SimEventType.TRANSFER_COMPLETE,
          time: this.clock.currentTime + transferTime,
          payload: { taskId: task.id, nodeId: decision.targetNodeId },
        });
        this.activeTransfers.set(task.id, {
          taskId: task.id,
          completionTime: this.clock.currentTime + transferTime,
        });
      } else {
        // Local execution — no transfer needed
        this.startExecution(task, node);
      }
    }
  }

  private handleTransferComplete(event: SimEvent): void {
    const taskId = event.payload.taskId as string;
    const nodeId = event.payload.nodeId as string;
    const task = this.tasks.get(taskId);
    const node = this.nodes.get(nodeId);

    if (!task || !node) return;
    this.activeTransfers.delete(taskId);

    if (!node.alive) {
      // Node failed during transfer — task fails
      task.state = TaskState.FAILED;
      task.endTime = this.clock.currentTime;
      this.eventLog.push({
        type: SimEventType.TASK_FAIL,
        time: this.clock.currentTime,
        payload: { taskId, reason: 'NODE_FAILED_DURING_TRANSFER' },
      });
      return;
    }

    this.startExecution(task, node);
  }

  private startExecution(task: SimTask, node: SimNode): void {
    // Allocate resources
    this.allocateFn(node.id, task.id, task);

    // Enqueue on node
    this.enqueueFn(node.id, task);

    const queueWait = this.queueWaitFn(node.id);
    task.queueWaitTime = queueWait;
    task.state = TaskState.EXECUTING;
    task.startTime = this.clock.currentTime + queueWait;

    // Schedule completion
    const completionTime = task.startTime + task.actualExecTime;

    // Check deadline
    if (completionTime > task.deadline && task.deadline > 0) {
      // Will miss deadline but still execute
    }

    this.eventQueue.push({
      type: SimEventType.TASK_COMPLETE,
      time: completionTime,
      payload: { taskId: task.id, nodeId: node.id },
    });
  }

  private handleTaskStart(event: SimEvent): void {
    const taskId = event.payload.taskId as string;
    const task = this.tasks.get(taskId);
    if (task) {
      task.state = TaskState.EXECUTING;
    }
  }

  private handleTaskComplete(event: SimEvent): void {
    const taskId = event.payload.taskId as string;
    const nodeId = event.payload.nodeId as string;
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Check if node is still alive
    const node = this.nodes.get(nodeId);
    if (node && !node.alive) {
      this.handleTaskFail({
        ...event,
        type: SimEventType.TASK_FAIL,
        payload: { ...event.payload, reason: 'NODE_FAILED_DURING_EXECUTION' },
      });
      return;
    }

    task.state = TaskState.COMPLETED;
    task.endTime = this.clock.currentTime;

    // Release resources
    this.releaseFn(nodeId, taskId);

    // Dequeue from node
    this.dequeueFn(nodeId);

    // Check if any dependent tasks can now start
    for (const otherTask of this.allTasks) {
      if (otherTask.state !== TaskState.WAITING) continue;
      if (!otherTask.dependencies.includes(taskId)) continue;

      const allDepsMet = otherTask.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.state === TaskState.COMPLETED;
      });

      if (allDepsMet) {
        // Re-inject as arrival so scheduler picks it up
        this.eventQueue.push({
          type: SimEventType.TASK_ARRIVE,
          time: this.clock.currentTime,
          payload: { taskId: otherTask.id },
        });
      }
    }
  }

  private handleTaskFail(event: SimEvent): void {
    const taskId = event.payload.taskId as string;
    const nodeId = event.payload.nodeId as string;
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Release resources
    if (nodeId) {
      this.releaseFn(nodeId, taskId);
    }

    // Retry logic
    if (shouldRetry(task, DEFAULT_RETRY_POLICY)) {
      task.retryCount++;
      const delay = calculateRetryDelay(task.retryCount, DEFAULT_RETRY_POLICY, this.rng);
      task.state = TaskState.WAITING;
      task.assignedNodeId = null;

      this.eventQueue.push({
        type: SimEventType.TASK_ARRIVE,
        time: this.clock.currentTime + delay,
        payload: { taskId: task.id },
      });
    } else {
      task.state = TaskState.FAILED;
      task.endTime = this.clock.currentTime;
    }
  }

  private handleNodeFail(event: SimEvent): void {
    const nodeId = event.payload.nodeId as string;
    const duration = event.payload.duration as number;
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Find all tasks running on this node
    const affectedTasks = this.allTasks.filter(
      (t) => t.assignedNodeId === nodeId && t.state === TaskState.EXECUTING,
    );

    const failEvents = applyNodeCrash(node, affectedTasks, this.clock.currentTime);
    for (const e of failEvents) {
      this.eventLog.push(e);
      if (e.type === SimEventType.TASK_FAIL) {
        this.handleTaskFail(e);
      }
    }

    // Schedule recovery
    this.eventQueue.push({
      type: SimEventType.NODE_RECOVER,
      time: this.clock.currentTime + duration,
      payload: { nodeId },
    });
  }

  private handleNodeRecover(event: SimEvent): void {
    const nodeId = event.payload.nodeId as string;
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const recoverEvent = applyNodeRecovery(node, this.clock.currentTime);
    this.eventLog.push(recoverEvent);
  }
}

// ---------------------------------------------------------------------------
// Simulation Hooks (injected by the orchestrator)
// ---------------------------------------------------------------------------

export interface SimulationHooks {
  getTransferTime: (fromNodeId: string, toNodeId: string, dataSizeMB: number) => number;
  getQueueWait: (nodeId: string) => number;
  canAllocate: (nodeId: string, task: SimTask) => boolean;
  allocate: (nodeId: string, taskId: string, task: SimTask) => void;
  release: (nodeId: string, taskId: string) => void;
  enqueue: (nodeId: string, task: SimTask) => void;
  dequeue: (nodeId: string) => SimTask | null;
}

// ---------------------------------------------------------------------------
// Node Factory
// ---------------------------------------------------------------------------

/**
 * Create a SimNode with defaults for a given tier.
 */
export function createSimNode(
  id: string,
  name: string,
  tier: NodeTier,
  regionId: string,
  overrides?: Partial<SimNode>,
): SimNode {
  const profile = DEFAULT_RESOURCE_PROFILES[tier];
  const discipline = DEFAULT_QUEUE_DISCIPLINES[tier];

  return {
    id,
    name,
    tier,
    regionId,
    capacity: { ...profile },
    usage: {
      cpuCores: 0,
      memoryMB: 0,
      vramMB: 0,
      storageMB: 0,
      activeBandwidthMbps: 0,
    },
    powerIdle: tier === NodeTier.CLOUD ? 200 : tier === NodeTier.FOG ? 80 : tier === NodeTier.EDGE ? 15 : 5,
    powerFull: tier === NodeTier.CLOUD ? 600 : tier === NodeTier.FOG ? 200 : tier === NodeTier.EDGE ? 40 : 10,
    alive: true,
    mttf: tier === NodeTier.CLOUD ? 86400 : tier === NodeTier.FOG ? 7200 : 3600,
    mttr: tier === NodeTier.CLOUD ? 60 : tier === NodeTier.FOG ? 120 : 300,
    upSince: 0,
    costPerCoreSec: tier === NodeTier.CLOUD ? 0.000012 : tier === NodeTier.FOG ? 0.000006 : 0.000001,
    egressCostPerMB: tier === NodeTier.CLOUD ? 0.00009 : 0.00001,
    queueDiscipline: discipline,
    ...overrides,
  };
}
