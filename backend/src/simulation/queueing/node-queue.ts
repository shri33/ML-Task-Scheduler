/**
 * Per-Node Task Queue with Queueing Dynamics
 * ===========================================
 * Implements a task queue for each simulation node with pluggable
 * queue disciplines and analytical delay estimation.
 *
 * ## Queue Disciplines
 * - **FCFS** (First Come First Served): Standard FIFO ordering.
 * - **PRIORITY**: Strict priority ordering (highest priority value first).
 *   Tasks with equal priority maintain FIFO order (stable sort).
 * - **EDF** (Earliest Deadline First): Tasks with the nearest deadline
 *   are served first — optimal for minimizing deadline violations.
 * - **WFQ** (Weighted Fair Queueing): Tasks are grouped by priority
 *   weight. Each weight class gets a proportional share of service.
 *   Within each class, tasks are served FIFO. Implementation uses
 *   virtual finish time tracking per class.
 *
 * ## Arrival Rate Estimation
 * Uses a sliding window of arrival timestamps (configurable, default
 * 60 simulated seconds) to compute an instantaneous arrival rate λ.
 * This feeds into the M/M/1 or M/G/1 model for expected wait time
 * predictions that the scheduler uses for placement decisions.
 *
 * ## Utilization History
 * Maintains a bounded ring buffer of utilization samples for
 * visualization and post-hoc analysis.
 */

import {
  type SimTask,
  type QueueState,
  QueueDiscipline,
  QueueModel,
} from '../types';
import { mm1WaitTime, mg1WaitTime } from './models';

// ---------------------------------------------------------------------------
// Configuration Constants
// ---------------------------------------------------------------------------

/** Default sliding window duration for arrival rate estimation (seconds). */
const DEFAULT_WINDOW_SIZE = 60;

/** Maximum number of utilization history samples to retain. */
const MAX_UTILIZATION_HISTORY = 2000;

/**
 * Minimum λ floor to avoid division-by-zero when the queue has tasks
 * but no recent arrivals (e.g., a burst followed by silence).
 */
const MIN_LAMBDA = 1e-9;

// ---------------------------------------------------------------------------
// WFQ Virtual Time Tracker
// ---------------------------------------------------------------------------

/**
 * Tracks WFQ (Weighted Fair Queueing) state per priority class.
 * Each class maintains a virtual finish time that determines the
 * next class to be served. Lower virtual finish time = served first.
 */
interface WfqClassState {
  /** Queue of tasks in this priority class (FIFO within class). */
  tasks: SimTask[];
  /** Weight for this class (= priority value). */
  weight: number;
  /** Virtual finish time — incremented by 1/weight on each dequeue. */
  virtualFinishTime: number;
}

// ---------------------------------------------------------------------------
// NodeQueue Class
// ---------------------------------------------------------------------------

/**
 * Per-node task queue that combines a concrete task buffer with
 * analytical queueing theory models for delay prediction.
 *
 * The queue is the bridge between the scheduler (which makes placement
 * decisions based on predicted delays) and the event engine (which
 * actually processes tasks). Accurate delay prediction is critical for
 * scheduler quality — an M/M/1 model that correctly diverges near
 * saturation naturally load-balances traffic away from hot nodes.
 */
export class NodeQueue {
  /** Node this queue belongs to. */
  public readonly nodeId: string;

  /** Active queue discipline. */
  public readonly discipline: QueueDiscipline;

  /** Service rate μ (tasks/second) — inverse of mean service time. */
  public readonly serviceRate: number;

  /** Queueing model used for delay estimation. */
  public readonly model: QueueModel;

  // -- Internal storage -----------------------------------------------------

  /**
   * Primary task buffer for FCFS, PRIORITY, and EDF disciplines.
   * For WFQ, tasks are stored in wfqClasses instead.
   */
  private tasks: SimTask[] = [];

  /** WFQ class states, keyed by priority value (1–5). */
  private wfqClasses: Map<number, WfqClassState> = new Map();

  // -- Arrival/departure tracking -------------------------------------------

  /** Sliding window of arrival timestamps (simulation time). */
  private arrivalTimestamps: number[] = [];

  /** Sliding window of departure timestamps (simulation time). */
  private departureTimestamps: number[] = [];

  /** Service time observations for M/G/1 variance estimation. */
  private serviceTimeObservations: number[] = [];

  /** Sliding window duration in simulation seconds. */
  private readonly windowSize: number;

  // -- Metrics --------------------------------------------------------------

  /** Total tasks enqueued since creation. */
  private totalArrivals: number = 0;

  /** Total tasks dequeued since creation. */
  private totalDepartures: number = 0;

  /** Time-weighted sum for average queue length computation. */
  private weightedLengthSum: number = 0;

  /** Last time the queue length changed (for time-weighted average). */
  private lastLengthChangeTime: number = 0;

  /** Utilization history ring buffer. */
  private utilizationHistory: Array<{ time: number; utilization: number }> = [];

  /**
   * @param nodeId      Unique identifier of the owning node.
   * @param discipline  Queue ordering discipline (FCFS, PRIORITY, EDF, WFQ).
   * @param serviceRate Service rate μ in tasks/second. Must be > 0.
   * @param model       Analytical model for delay estimation (MM1 or MG1).
   * @param windowSize  Sliding window duration for λ estimation (seconds).
   *                    Defaults to 60.
   */
  constructor(
    nodeId: string,
    discipline: QueueDiscipline,
    serviceRate: number,
    model: QueueModel,
    windowSize: number = DEFAULT_WINDOW_SIZE,
  ) {
    if (serviceRate <= 0) {
      throw new RangeError(`Service rate μ must be > 0, got ${serviceRate}`);
    }

    this.nodeId = nodeId;
    this.discipline = discipline;
    this.serviceRate = serviceRate;
    this.model = model;
    this.windowSize = windowSize;

    // Initialize WFQ classes for priorities 1–5
    if (discipline === QueueDiscipline.WFQ) {
      for (let p = 1; p <= 5; p++) {
        this.wfqClasses.set(p, {
          tasks: [],
          weight: p,
          virtualFinishTime: 0,
        });
      }
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Number of tasks currently in the queue.
   * For WFQ, this is the sum across all priority classes.
   */
  get length(): number {
    if (this.discipline === QueueDiscipline.WFQ) {
      let total = 0;
      for (const cls of this.wfqClasses.values()) {
        total += cls.tasks.length;
      }
      return total;
    }
    return this.tasks.length;
  }

  /**
   * Current utilization ρ = λ/μ.
   * Returns 0 if no arrivals have been observed.
   */
  get utilization(): number {
    const lambda = this.computeArrivalRate();
    return lambda / this.serviceRate;
  }

  /**
   * Enqueues a task into the queue.
   * The task is inserted according to the active discipline:
   * - FCFS: appended to the end.
   * - PRIORITY: inserted in descending priority order (stable).
   * - EDF: inserted in ascending deadline order (stable).
   * - WFQ: appended to the appropriate priority class queue.
   *
   * @param task The simulation task to enqueue.
   */
  public enqueue(task: SimTask): void {
    const prevLength = this.length;

    switch (this.discipline) {
      case QueueDiscipline.FCFS:
        this.tasks.push(task);
        break;

      case QueueDiscipline.PRIORITY:
        this.insertByPriority(task);
        break;

      case QueueDiscipline.EDF:
        this.insertByDeadline(task);
        break;

      case QueueDiscipline.WFQ:
        this.insertWfq(task);
        break;
    }

    this.totalArrivals++;
    this.updateWeightedLength(prevLength, task.submitTime);
  }

  /**
   * Removes and returns the next task to be served.
   * Returns null if the queue is empty.
   *
   * @returns The next task according to the active discipline, or null.
   */
  public dequeue(): SimTask | null {
    const prevLength = this.length;

    let task: SimTask | null = null;

    switch (this.discipline) {
      case QueueDiscipline.FCFS:
      case QueueDiscipline.PRIORITY:
      case QueueDiscipline.EDF:
        task = this.tasks.shift() ?? null;
        break;

      case QueueDiscipline.WFQ:
        task = this.dequeueWfq();
        break;
    }

    if (task !== null) {
      this.totalDepartures++;
      // Use the task's start time or current time for the weighted length update.
      // We use the submit time as an approximation; the caller should also
      // call recordDeparture() with the actual simulation time.
      this.updateWeightedLength(prevLength, task.submitTime);
    }

    return task;
  }

  /**
   * Peeks at the next task without removing it.
   *
   * @returns The next task that would be dequeued, or null if empty.
   */
  public peek(): SimTask | null {
    switch (this.discipline) {
      case QueueDiscipline.FCFS:
      case QueueDiscipline.PRIORITY:
      case QueueDiscipline.EDF:
        return this.tasks.length > 0 ? this.tasks[0] : null;

      case QueueDiscipline.WFQ:
        return this.peekWfq();
    }
  }

  /**
   * Computes the expected wait time using the configured analytical model.
   * This is the scheduler's primary signal for load-aware placement.
   *
   * @returns Expected sojourn time W (queue wait + service) in seconds.
   */
  public getExpectedWaitTime(): number {
    const lambda = this.computeArrivalRate();

    if (lambda <= 0) {
      // No arrivals observed → no queueing delay, just service time
      return 1 / this.serviceRate;
    }

    switch (this.model) {
      case QueueModel.MM1: {
        const result = mm1WaitTime(lambda, this.serviceRate);
        return result.waitTime;
      }

      case QueueModel.MG1: {
        const meanServiceTime = 1 / this.serviceRate;
        const variance = this.computeServiceTimeVariance(meanServiceTime);
        const result = mg1WaitTime(lambda, meanServiceTime, variance);
        return result.waitTime;
      }

      default: {
        const _exhaustive: never = this.model;
        throw new Error(`Unknown queue model: ${_exhaustive}`);
      }
    }
  }

  /**
   * Returns the current queue state snapshot for monitoring and visualization.
   */
  public getState(): QueueState {
    const lambda = this.computeArrivalRate();
    const rho = lambda / this.serviceRate;

    return {
      length: this.length,
      arrivalRate: lambda,
      serviceRate: this.serviceRate,
      utilization: rho,
      expectedWaitTime: this.getExpectedWaitTime(),
      avgLength: this.computeAverageLength(),
      utilizationHistory: [...this.utilizationHistory],
    };
  }

  /**
   * Records an arrival event for the sliding-window λ estimator.
   * Should be called by the simulation engine when a task arrives at this node.
   *
   * @param time Current simulation time in seconds.
   */
  public recordArrival(time: number): void {
    this.arrivalTimestamps.push(time);
    this.pruneWindow(this.arrivalTimestamps, time);
    this.recordUtilization(time);
  }

  /**
   * Records a departure event and optionally a service time observation.
   * Should be called by the simulation engine when a task finishes service.
   *
   * @param time        Current simulation time in seconds.
   * @param serviceTime Actual service time of the departed task (optional).
   *                    If provided, used to update M/G/1 variance estimates.
   */
  public recordDeparture(time: number, serviceTime?: number): void {
    this.departureTimestamps.push(time);
    this.pruneWindow(this.departureTimestamps, time);

    if (serviceTime !== undefined && serviceTime > 0) {
      this.serviceTimeObservations.push(serviceTime);
      // Keep bounded — retain last 500 observations for variance estimation
      if (this.serviceTimeObservations.length > 500) {
        this.serviceTimeObservations.splice(
          0,
          this.serviceTimeObservations.length - 500,
        );
      }
    }

    this.recordUtilization(time);
  }

  // =========================================================================
  // Queue Discipline Implementations
  // =========================================================================

  /**
   * Inserts a task in descending priority order (highest priority first).
   * Ties are broken by insertion order (FIFO) for stability.
   */
  private insertByPriority(task: SimTask): void {
    // Find the first position where the existing task has lower priority
    let insertIdx = this.tasks.length;
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].priority < task.priority) {
        insertIdx = i;
        break;
      }
    }
    this.tasks.splice(insertIdx, 0, task);
  }

  /**
   * Inserts a task in ascending deadline order (earliest deadline first).
   * Ties are broken by insertion order (FIFO) for stability.
   */
  private insertByDeadline(task: SimTask): void {
    let insertIdx = this.tasks.length;
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].deadline > task.deadline) {
        insertIdx = i;
        break;
      }
    }
    this.tasks.splice(insertIdx, 0, task);
  }

  /**
   * Inserts a task into the appropriate WFQ priority class.
   * Tasks with priority values outside 1–5 are clamped.
   */
  private insertWfq(task: SimTask): void {
    const priority = Math.max(1, Math.min(5, task.priority));
    const cls = this.wfqClasses.get(priority);
    if (cls) {
      cls.tasks.push(task);
    } else {
      // Defensive: create class on the fly if somehow missing
      this.wfqClasses.set(priority, {
        tasks: [task],
        weight: priority,
        virtualFinishTime: 0,
      });
    }
  }

  /**
   * Dequeues from WFQ using virtual finish time scheduling.
   *
   * Algorithm: Among all non-empty classes, select the one with the
   * smallest virtual finish time. Dequeue the head of that class's
   * FIFO queue, then advance that class's virtual finish time by
   * 1/weight (higher weight = smaller increment = more service share).
   */
  private dequeueWfq(): SimTask | null {
    let bestClass: WfqClassState | null = null;
    let bestVFT = Infinity;

    for (const cls of this.wfqClasses.values()) {
      if (cls.tasks.length > 0 && cls.virtualFinishTime < bestVFT) {
        bestVFT = cls.virtualFinishTime;
        bestClass = cls;
      }
    }

    if (bestClass === null) {
      return null;
    }

    const task = bestClass.tasks.shift()!;
    // Advance virtual finish time: inverse of weight so higher-priority
    // classes get proportionally more service
    bestClass.virtualFinishTime += 1 / bestClass.weight;

    return task;
  }

  /**
   * Peeks at the WFQ task that would be dequeued next.
   */
  private peekWfq(): SimTask | null {
    let bestClass: WfqClassState | null = null;
    let bestVFT = Infinity;

    for (const cls of this.wfqClasses.values()) {
      if (cls.tasks.length > 0 && cls.virtualFinishTime < bestVFT) {
        bestVFT = cls.virtualFinishTime;
        bestClass = cls;
      }
    }

    if (bestClass === null || bestClass.tasks.length === 0) {
      return null;
    }

    return bestClass.tasks[0];
  }

  // =========================================================================
  // Arrival Rate Estimation
  // =========================================================================

  /**
   * Computes the instantaneous arrival rate λ using a sliding window.
   *
   * Method: Count arrivals in the last `windowSize` seconds of
   * simulation time. λ = count / windowSize.
   *
   * If the window contains fewer than 2 events, we fall back to the
   * total arrival count divided by the elapsed time span of all
   * observations. This handles the cold-start case.
   */
  private computeArrivalRate(): number {
    if (this.arrivalTimestamps.length === 0) {
      return 0;
    }

    if (this.arrivalTimestamps.length < 2) {
      // Single arrival — use MIN_LAMBDA to avoid zero
      return Math.max(MIN_LAMBDA, 1 / this.windowSize);
    }

    // The window has already been pruned to contain only recent events
    const count = this.arrivalTimestamps.length;

    // Compute the time span within the window
    const oldest = this.arrivalTimestamps[0];
    const newest = this.arrivalTimestamps[count - 1];
    const span = newest - oldest;

    if (span <= 0) {
      // All arrivals at the same instant — burst behavior
      // Estimate λ as count/windowSize (conservative)
      return count / this.windowSize;
    }

    // Rate = number of inter-arrival intervals / time span
    // There are (count - 1) intervals in count arrivals
    return (count - 1) / span;
  }

  /**
   * Computes the sample variance of observed service times.
   * Falls back to the exponential assumption Var[S] = E[S]² if
   * insufficient observations are available.
   *
   * @param meanServiceTime The theoretical mean service time 1/μ.
   */
  private computeServiceTimeVariance(meanServiceTime: number): number {
    const obs = this.serviceTimeObservations;

    if (obs.length < 2) {
      // Insufficient data — assume exponential (Var[S] = E[S]²)
      return meanServiceTime * meanServiceTime;
    }

    // Compute sample mean
    let sum = 0;
    for (let i = 0; i < obs.length; i++) {
      sum += obs[i];
    }
    const sampleMean = sum / obs.length;

    // Compute sample variance (Bessel's correction: n-1)
    let sumSqDiff = 0;
    for (let i = 0; i < obs.length; i++) {
      const diff = obs[i] - sampleMean;
      sumSqDiff += diff * diff;
    }

    return sumSqDiff / (obs.length - 1);
  }

  // =========================================================================
  // Sliding Window Maintenance
  // =========================================================================

  /**
   * Removes timestamps older than `currentTime - windowSize` from an
   * array. The array is assumed to be in ascending time order.
   */
  private pruneWindow(timestamps: number[], currentTime: number): void {
    const cutoff = currentTime - this.windowSize;
    let removeCount = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] < cutoff) {
        removeCount++;
      } else {
        break;
      }
    }
    if (removeCount > 0) {
      timestamps.splice(0, removeCount);
    }
  }

  // =========================================================================
  // Metrics
  // =========================================================================

  /**
   * Updates the time-weighted queue length sum.
   * Called on every enqueue/dequeue event.
   */
  private updateWeightedLength(prevLength: number, currentTime: number): void {
    const elapsed = currentTime - this.lastLengthChangeTime;
    if (elapsed > 0) {
      this.weightedLengthSum += prevLength * elapsed;
    }
    this.lastLengthChangeTime = currentTime;
  }

  /**
   * Computes the time-weighted average queue length.
   * Returns 0 if no time has elapsed.
   */
  private computeAverageLength(): number {
    if (this.lastLengthChangeTime <= 0) {
      return this.length;
    }
    return this.weightedLengthSum / this.lastLengthChangeTime;
  }

  /**
   * Records a utilization sample in the history ring buffer.
   */
  private recordUtilization(time: number): void {
    const rho = this.utilization;
    this.utilizationHistory.push({ time, utilization: rho });

    // Enforce ring buffer size limit
    if (this.utilizationHistory.length > MAX_UTILIZATION_HISTORY) {
      this.utilizationHistory.splice(
        0,
        this.utilizationHistory.length - MAX_UTILIZATION_HISTORY,
      );
    }
  }
}
