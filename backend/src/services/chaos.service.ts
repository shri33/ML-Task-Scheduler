import logger from '../lib/logger';
import { emitToAll } from '../lib/socket';
import { errorRecovery } from './errorRecovery.service';

export type FailureType = 'latency' | 'error' | 'outage' | 'load';

export interface ChaosConfig {
  service: string;
  type: FailureType;
  value: number; // ms for latency, % for error, 0/1 for outage
  active: boolean;
  startTime: Date;
}

class ChaosService {
  private activeExperiments: Map<string, ChaosConfig> = new Map();

  /**
   * Start a chaos experiment
   */
  startExperiment(config: ChaosConfig): void {
    const key = `${config.service}:${config.type}`;
    this.activeExperiments.set(key, {
      ...config,
      startTime: new Date()
    });
    
    logger.warn(`Chaos Experiment Started: ${config.service} -> ${config.type} (${config.value})`);
    
    if (config.type === 'outage') {
      // Manually trip the circuit breaker
      errorRecovery.recordFailure(config.service as any, new Error('Chaos: Induced Outage'));
    }

    emitToAll('chaos:experiment_started', config);
  }

  /**
   * Stop a chaos experiment
   */
  stopExperiment(service: string, type: FailureType): void {
    const key = `${service}:${type}`;
    const config = this.activeExperiments.get(key);
    
    if (config) {
      this.activeExperiments.delete(key);
      logger.info(`Chaos Experiment Stopped: ${service} -> ${type}`);
      
      if (type === 'outage') {
        errorRecovery.resetCircuitBreaker(service as any);
      }

      emitToAll('chaos:experiment_stopped', { service, type });
    }
  }

  /**
   * Stop all experiments
   */
  stopAll(): void {
    this.activeExperiments.forEach((config) => {
      this.stopExperiment(config.service, config.type);
    });
  }

  /**
   * Get active experiments
   */
  getExperiments(): ChaosConfig[] {
    return Array.from(this.activeExperiments.values());
  }

  /**
   * Check if chaos should be applied for a specific service call
   */
  async applyChaos(service: string): Promise<void> {
    // 1. Check for outage
    const outage = this.activeExperiments.get(`${service}:outage`);
    if (outage && outage.active) {
      throw new Error(`Chaos: Service ${service} is experiencing an induced outage`);
    }

    // 2. Check for latency
    const latency = this.activeExperiments.get(`${service}:latency`);
    if (latency && latency.active) {
      await new Promise(resolve => setTimeout(resolve, latency.value));
    }

    // 3. Check for errors
    const error = this.activeExperiments.get(`${service}:error`);
    if (error && error.active) {
      if (Math.random() * 100 < error.value) {
        throw new Error(`Chaos: Induced random error for ${service}`);
      }
    }
  }
}

export const chaosService = new ChaosService();
export default chaosService;
