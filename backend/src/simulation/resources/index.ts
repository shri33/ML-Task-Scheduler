/**
 * Resources Subsystem — Barrel Export
 * ====================================
 * Re-exports all public types and classes from the resource management
 * subsystem.
 *
 * Usage:
 * ```ts
 * import { ResourceAllocator } from './resources';
 * import type { AllocationResult, UtilizationSnapshot, ResourceEvent } from './resources';
 * ```
 */

export { ResourceAllocator } from './allocator';
export type {
  AllocationResult,
  UtilizationSnapshot,
  ResourceEvent,
  ResourceEventType,
} from './types';
