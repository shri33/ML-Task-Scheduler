export interface TerminalDevice {
  id: string;
  name: string;
  transmissionPower: number;  // pir - transmission power (W)
  idlePower: number;          // pie - idle power (W)
  isMobile: boolean;          // ai - mobile flag
  delayWeight: number;        // wit - delay weight
  energyWeight: number;       // wie - energy weight
  residualEnergy: number;     // Eil - residual energy (J)
}

export interface Task {
  id: string;
  name: string;
  dataSize: number;           // Di - data size (Mb)
  computationIntensity: number; // θi - computation intensity (cycles/bit)
  maxToleranceTime: number;   // Ti,max - maximum tolerate time (s)
  expectedCompletionTime: number; // Ti,exp - expected completion time (s)
  terminalDeviceId: string;
  priority: number;
  memoryRequirement: number; // Mi - memory requirement (MB)
  vramRequirement: number;   // Vi - VRAM requirement (MB)
  startupOverhead: number;   // Si - startup overhead (s)
}

export interface FogNode {
  id: string;
  name: string;
  computingResource: number;  // Cj - computing resource (cycles/s)
  storageCapacity: number;    // Kj - storage capacity (GB)
  networkBandwidth: number;   // Bj - network bandwidth (Mbps)
  currentLoad: number;        // Current utilization (0-1)
  totalMemory: number;        // Total memory (MB)
  totalVram: number;          // Total VRAM (MB)
  baseLatency: number;        // Local network base latency (s)
  egressCostPerMb: number;    // Egress cost per Mb ($)
}

// Cloud Layer - for offloading when fog capacity is exceeded
export interface CloudNode {
  id: string;
  name: string;
  computingResource: number;  // Much higher than fog nodes (cycles/s)
  networkBandwidth: number;   // WAN bandwidth (Mbps)
  latencyPenalty: number;     // Additional latency for cloud (ms)
  costPerUnit: number;        // Cost per computation unit
  baseLatency: number;        // Global network base latency (s)
  egressCostPerMb: number;    // Egress cost per Mb ($)
  available: boolean;
}

// Offloading decision result
export interface OffloadDecision {
  taskId: string;
  offloadTarget: 'fog' | 'cloud' | 'local';
  targetId: string;
  reason: string;
  estimatedDelay: number;
  estimatedEnergy: number;
  estimatedCost: number;
}

export interface SchedulingResult {
  taskId: string;
  fogNodeId: string;
  executionTime: number;      // TEij
  transmissionTime: number;   // TRij
  totalDelay: number;         // Tij
  energyConsumption: number;  // Eij
  fitness: number;
}

export interface SchedulingSolution {
  allocations: Map<string, string>; // taskId -> fogNodeId
  totalDelay: number;
  totalEnergy: number;
  fitness: number;
  reliability: number;
}
