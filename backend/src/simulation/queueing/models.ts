/**
 * Queueing Theory Models
 * ======================
 * Analytical models for single-server queues used to predict waiting
 * times, queue lengths, and utilization in the fog computing simulation.
 *
 * ## M/M/1 Queue (Kendall notation)
 * - Markovian (Poisson) arrivals, Markovian (exponential) service times,
 *   single server, infinite queue capacity, infinite population, FCFS.
 * - Textbook reference: Kleinrock, "Queueing Systems, Vol. 1", 1975.
 * - Key result: W = 1/(μ−λ) diverges as ρ→1, modeling congestion collapse.
 *
 * ## M/G/1 Queue (Pollaczek–Khinchine formula)
 * - Markovian arrivals, General service time distribution, single server.
 * - Uses only the first two moments of the service time distribution.
 * - Reference: Pollaczek 1930, Khinchine 1932; see also Gross & Harris
 *   "Fundamentals of Queueing Theory", 4th ed.
 *
 * ## Design Decisions
 * - When ρ ≥ 1 the queue is unstable; we return Infinity and flag it.
 * - When 0.95 ≤ ρ < 1 we cap results at a finite maximum (1e6) and set
 *   a `nearSaturation` warning flag — this prevents numerical explosions
 *   from destabilizing the discrete-event simulation loop while still
 *   producing realistic congestion behavior.
 * - All functions are pure (no side effects, no state) for testability.
 */

import { QueueModel } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * When utilization is between NEAR_SATURATION_THRESHOLD and 1.0, we
 * cap computed values at this ceiling. The value 1e6 (≈11.6 days in
 * seconds) is large enough to be "effectively infinite" for any
 * realistic simulation horizon while avoiding IEEE 754 Infinity
 * propagation in downstream arithmetic.
 */
const NEAR_SATURATION_CAP = 1e6;

/** Utilization threshold above which we flag near-saturation. */
const NEAR_SATURATION_THRESHOLD = 0.95;

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

/** Result of an M/M/1 queueing analysis. */
export interface MM1Result {
  /** Expected time in system W = 1/(μ−λ) [seconds]. */
  waitTime: number;
  /** Expected number in system L = ρ/(1−ρ). */
  queueLength: number;
  /** Server utilization ρ = λ/μ. */
  utilization: number;
  /** Whether the queue is stable (ρ < 1). */
  stable: boolean;
  /** Expected queue wait Wq = ρ/(μ−λ) [seconds]. */
  queueWaitTime: number;
  /** Expected queue length Lq = ρ²/(1−ρ). */
  queueLengthOnly: number;
  /** True when ρ ∈ [0.95, 1.0) — results are capped. */
  nearSaturation: boolean;
}

/** Result of an M/G/1 queueing analysis. */
export interface MG1Result {
  /** Expected time in system W = Wq + E[S] [seconds]. */
  waitTime: number;
  /** Expected number in system L = λW (Little's law). */
  queueLength: number;
  /** Server utilization ρ = λ·E[S]. */
  utilization: number;
  /** Whether the queue is stable (ρ < 1). */
  stable: boolean;
  /** Expected queue wait Wq [seconds]. */
  queueWaitTime: number;
  /** True when ρ ∈ [0.95, 1.0) — results are capped. */
  nearSaturation: boolean;
}

// ---------------------------------------------------------------------------
// M/M/1 Queue
// ---------------------------------------------------------------------------

/**
 * Computes steady-state metrics for an M/M/1 queue.
 *
 * @param lambda  Arrival rate λ (tasks/second). Must be ≥ 0.
 * @param mu      Service rate μ (tasks/second). Must be > 0.
 * @returns       Steady-state metrics including wait time, queue length,
 *                utilization, and stability flag.
 *
 * @example
 * ```ts
 * const r = mm1WaitTime(4, 5);
 * // r.utilization ≈ 0.8, r.waitTime ≈ 1.0, r.queueLength ≈ 4.0
 * ```
 */
export function mm1WaitTime(lambda: number, mu: number): MM1Result {
  if (mu <= 0) {
    throw new RangeError(`Service rate μ must be > 0, got ${mu}`);
  }
  if (lambda < 0) {
    throw new RangeError(`Arrival rate λ must be ≥ 0, got ${lambda}`);
  }

  // Trivial case: no arrivals
  if (lambda === 0) {
    return {
      waitTime: 0,
      queueLength: 0,
      utilization: 0,
      stable: true,
      queueWaitTime: 0,
      queueLengthOnly: 0,
      nearSaturation: false,
    };
  }

  const rho = lambda / mu;

  // Unstable queue: ρ ≥ 1
  if (rho >= 1) {
    return {
      waitTime: Infinity,
      queueLength: Infinity,
      utilization: rho,
      stable: false,
      queueWaitTime: Infinity,
      queueLengthOnly: Infinity,
      nearSaturation: false,
    };
  }

  const nearSaturation = rho >= NEAR_SATURATION_THRESHOLD;

  // Steady-state formulas (Kleinrock 1975):
  //   W  = 1 / (μ − λ)          — expected time in system
  //   L  = ρ / (1 − ρ)          — expected number in system (Little: L = λW)
  //   Wq = ρ / (μ − λ)          — expected wait in queue only
  //   Lq = ρ² / (1 − ρ)         — expected number in queue only
  let W = 1 / (mu - lambda);
  let L = rho / (1 - rho);
  let Wq = rho / (mu - lambda);
  let Lq = (rho * rho) / (1 - rho);

  // Cap near-saturation values to prevent numerical explosion
  if (nearSaturation) {
    W = Math.min(W, NEAR_SATURATION_CAP);
    L = Math.min(L, NEAR_SATURATION_CAP);
    Wq = Math.min(Wq, NEAR_SATURATION_CAP);
    Lq = Math.min(Lq, NEAR_SATURATION_CAP);
  }

  return {
    waitTime: W,
    queueLength: L,
    utilization: rho,
    stable: true,
    queueWaitTime: Wq,
    queueLengthOnly: Lq,
    nearSaturation,
  };
}

// ---------------------------------------------------------------------------
// M/G/1 Queue (Pollaczek–Khinchine)
// ---------------------------------------------------------------------------

/**
 * Computes steady-state metrics for an M/G/1 queue using the
 * Pollaczek–Khinchine mean value formula.
 *
 * The M/G/1 model is more general than M/M/1 because it allows
 * arbitrary service time distributions — only the mean E[S] and
 * variance Var[S] are required.
 *
 * Key formula (P-K mean value formula):
 *   Wq = λ(Var[S] + E[S]²) / (2(1 − ρ))
 *   W  = Wq + E[S]
 *   L  = λW   (Little's law)
 *
 * @param lambda              Arrival rate λ (tasks/second). Must be ≥ 0.
 * @param meanServiceTime     E[S] — mean service time (seconds). Must be > 0.
 * @param varianceServiceTime Var[S] — variance of service time. Must be ≥ 0.
 * @returns                   Steady-state metrics.
 *
 * @example
 * ```ts
 * // Exponential service: Var[S] = E[S]² — should match M/M/1
 * const r = mg1WaitTime(4, 0.2, 0.04);
 * ```
 */
export function mg1WaitTime(
  lambda: number,
  meanServiceTime: number,
  varianceServiceTime: number,
): MG1Result {
  if (meanServiceTime <= 0) {
    throw new RangeError(
      `Mean service time E[S] must be > 0, got ${meanServiceTime}`,
    );
  }
  if (varianceServiceTime < 0) {
    throw new RangeError(
      `Variance of service time Var[S] must be ≥ 0, got ${varianceServiceTime}`,
    );
  }
  if (lambda < 0) {
    throw new RangeError(`Arrival rate λ must be ≥ 0, got ${lambda}`);
  }

  // Trivial case: no arrivals
  if (lambda === 0) {
    return {
      waitTime: 0,
      queueLength: 0,
      utilization: 0,
      stable: true,
      queueWaitTime: 0,
      nearSaturation: false,
    };
  }

  const rho = lambda * meanServiceTime;

  // Unstable queue: ρ ≥ 1
  if (rho >= 1) {
    return {
      waitTime: Infinity,
      queueLength: Infinity,
      utilization: rho,
      stable: false,
      queueWaitTime: Infinity,
      nearSaturation: false,
    };
  }

  const nearSaturation = rho >= NEAR_SATURATION_THRESHOLD;

  // Pollaczek–Khinchine mean value formula
  // Second moment of service time: E[S²] = Var[S] + E[S]²
  const secondMoment = varianceServiceTime + meanServiceTime * meanServiceTime;

  // Wq = λ · E[S²] / (2(1 − ρ))
  let Wq = (lambda * secondMoment) / (2 * (1 - rho));

  // W = Wq + E[S]
  let W = Wq + meanServiceTime;

  // L = λW (Little's law)
  let L = lambda * W;

  // Cap near-saturation values
  if (nearSaturation) {
    Wq = Math.min(Wq, NEAR_SATURATION_CAP);
    W = Math.min(W, NEAR_SATURATION_CAP);
    L = Math.min(L, NEAR_SATURATION_CAP);
  }

  return {
    waitTime: W,
    queueLength: L,
    utilization: rho,
    stable: true,
    queueWaitTime: Wq,
    nearSaturation,
  };
}

// ---------------------------------------------------------------------------
// Unified Delay Function
// ---------------------------------------------------------------------------

/**
 * Computes expected queueing delay using the specified model.
 *
 * This is a convenience wrapper that dispatches to mm1WaitTime or
 * mg1WaitTime based on the QueueModel enum. Returns the expected
 * wait time in the system (W), i.e., the total sojourn time including
 * both queueing delay and service time.
 *
 * @param model    Which queueing model to use (MM1 or MG1).
 * @param lambda   Arrival rate λ (tasks/second).
 * @param mu       Service rate μ (tasks/second). For M/G/1, E[S] = 1/μ.
 * @param variance Variance of service time. Required for M/G/1; ignored
 *                 for M/M/1. If omitted for M/G/1, defaults to exponential
 *                 assumption Var[S] = E[S]² (which reduces to M/M/1).
 * @returns        Expected total sojourn time in seconds.
 *
 * @example
 * ```ts
 * // M/M/1 with λ=3, μ=5
 * const delay = queueDelay(QueueModel.MM1, 3, 5);
 * // ≈ 0.5 seconds
 *
 * // M/G/1 with λ=3, μ=5, deterministic service (Var=0)
 * const delay2 = queueDelay(QueueModel.MG1, 3, 5, 0);
 * // < 0.5 seconds (deterministic service has less variability)
 * ```
 */
export function queueDelay(
  model: QueueModel,
  lambda: number,
  mu: number,
  variance?: number,
): number {
  switch (model) {
    case QueueModel.MM1: {
      const result = mm1WaitTime(lambda, mu);
      return result.waitTime;
    }
    case QueueModel.MG1: {
      const meanServiceTime = 1 / mu;
      // If variance is not provided, assume exponential distribution
      // where Var[S] = E[S]² = 1/μ². This makes M/G/1 equivalent to M/M/1.
      const serviceVariance =
        variance !== undefined ? variance : meanServiceTime * meanServiceTime;
      const result = mg1WaitTime(lambda, meanServiceTime, serviceVariance);
      return result.waitTime;
    }
    default: {
      // Exhaustive check — TypeScript will flag if new QueueModel variants
      // are added without handling here.
      const _exhaustive: never = model;
      throw new Error(`Unknown queue model: ${_exhaustive}`);
    }
  }
}
