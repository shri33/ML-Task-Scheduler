import redisService from '../lib/redis';
import logger from '../lib/logger';

export interface GPUNode {
  id: string;
  host: string;
  gpuType: string;
  vramTotal: number;
  vramUsed: number;
  utilization: number;
  queue: number;
  lastHeartbeat: number;
}

const GPU_NODE_PREFIX = 'gpu:node:';
const HEARTBEAT_TIMEOUT_MS = 30000; // 30 seconds

export class GpuRegistryService {
  /**
   * Register or update a GPU node's telemetry.
   */
  async registerNode(node: GPUNode): Promise<void> {
    const client = redisService.getClient();
    if (!client) {
      logger.error('Redis client not available for GPU registry');
      return;
    }

    const key = `${GPU_NODE_PREFIX}${node.id}`;
    // Store as JSON string, expiring after 60 seconds if no heartbeat is received
    await client.set(key, JSON.stringify(node), 'EX', 60);
    logger.debug(`Registered GPU node ${node.id} (${node.gpuType})`);
  }

  /**
   * Retrieve all currently active GPU nodes.
   */
  async getAllNodes(): Promise<GPUNode[]> {
    const client = redisService.getClient();
    if (!client) {
      logger.error('Redis client not available for GPU registry');
      return [];
    }

    try {
      // Find all keys matching the GPU node prefix
      const keys = await client.keys(`${GPU_NODE_PREFIX}*`);
      if (keys.length === 0) return [];

      // Fetch all nodes in a single transaction (pipeline)
      const pipeline = client.pipeline();
      for (const key of keys) {
        pipeline.get(key);
      }
      
      const results = await pipeline.exec();
      if (!results) return [];

      const nodes: GPUNode[] = [];
      const now = Date.now();

      for (const [err, result] of results) {
        if (err || !result) continue;
        
        try {
          const node = JSON.parse(result as string) as GPUNode;
          // Double check heartbeat
          if (now - node.lastHeartbeat <= HEARTBEAT_TIMEOUT_MS) {
            nodes.push(node);
          }
        } catch (e) {
          logger.error('Failed to parse GPU node data from Redis', e);
        }
      }

      return nodes;
    } catch (error) {
      logger.error('Error fetching GPU nodes from Redis', error);
      return [];
    }
  }

  /**
   * Delete a node from the registry (e.g., graceful shutdown)
   */
  async deregisterNode(nodeId: string): Promise<void> {
    const client = redisService.getClient();
    if (!client) return;

    await client.del(`${GPU_NODE_PREFIX}${nodeId}`);
    logger.info(`Deregistered GPU node ${nodeId}`);
  }
}

export const gpuRegistryService = new GpuRegistryService();