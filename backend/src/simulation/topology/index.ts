/**
 * Topology Module — Barrel Export
 * ===============================
 * Re-exports all public API from the topology sub-package so consumers
 * can import from a single entry point:
 *
 *   import { TopologyGraph, generateWaxman, ... } from '../topology';
 */

export { TopologyGraph } from './graph';

export {
  mulberry32,
  gaussianRandom,
  generateWaxman,
  generateBarabasiAlbert,
  generateHierarchical,
  loadTopologyFromJSON,
} from './generators';

export type {
  WaxmanConfig,
  BarabasiAlbertConfig,
  HierarchicalConfig,
  HierarchicalNodeInfo,
  HierarchicalResult,
  TopologyJSON,
} from './generators';
