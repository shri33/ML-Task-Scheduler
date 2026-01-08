import prisma from '../lib/prisma';
import { taskService } from './task.service';
import { resourceService } from './resource.service';
import { mlService } from './ml.service';

interface Task {
  id: string;
  name: string;
  type: string;
  size: string;
  priority: number;
  status: string;
  predictedTime: number | null;
  actualTime: number | null;
  resourceId: string | null;
  createdAt: Date;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

interface Resource {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleResult {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  predictedTime: number;
  confidence: number;
  score: number;
  explanation: string;
}

interface ResourceScore {
  resource: Resource;
  score: number;
  predictedTime: number;
  confidence: number;
}

export class SchedulerService {
  // Main scheduling algorithm
  async schedule(taskIds?: string[]): Promise<ScheduleResult[]> {
    // Get tasks to schedule
    let tasks: Task[];
    if (taskIds && taskIds.length > 0) {
      tasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
          status: 'PENDING'
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
      });
    } else {
      tasks = await taskService.findPending();
    }

    if (tasks.length === 0) {
      return [];
    }

    // Get available resources
    const resources = await resourceService.findAvailable();
    if (resources.length === 0) {
      throw new Error('No available resources for scheduling');
    }

    const results: ScheduleResult[] = [];

    // Schedule each task
    for (const task of tasks) {
      const result = await this.scheduleTask(task, resources);
      if (result) {
        results.push(result);
        // Update resource load in memory for subsequent tasks
        const resourceIndex = resources.findIndex((r: Resource) => r.id === result.resourceId);
        if (resourceIndex !== -1) {
          resources[resourceIndex].currentLoad += 15; // Approximate load increase
        }
      }
    }

    return results;
  }

  // Schedule a single task
  async scheduleTask(task: Task, availableResources: Resource[]): Promise<ScheduleResult | null> {
    if (availableResources.length === 0) return null;

    // Calculate scores for each resource using ML predictions
    const resourceScores: ResourceScore[] = [];

    for (const resource of availableResources) {
      if (resource.currentLoad >= 100) continue;

      // Get ML prediction
      const prediction = await mlService.getPrediction(
        task.size,
        task.type,
        task.priority,
        resource.currentLoad
      );

      // Calculate scheduling score
      const score = this.calculateScore(task, resource, prediction.predictedTime);

      resourceScores.push({
        resource,
        score,
        predictedTime: prediction.predictedTime,
        confidence: prediction.confidence
      });

      // Save prediction to database
      await mlService.savePrediction(
        task.id,
        prediction.predictedTime,
        prediction.confidence,
        {
          taskSize: task.size === 'SMALL' ? 1 : task.size === 'MEDIUM' ? 2 : 3,
          taskType: task.type === 'CPU' ? 1 : task.type === 'IO' ? 2 : 3,
          priority: task.priority,
          resourceLoad: resource.currentLoad
        },
        prediction.modelVersion
      );
    }

    if (resourceScores.length === 0) return null;

    // Select best resource (highest score)
    resourceScores.sort((a, b) => b.score - a.score);
    const best = resourceScores[0];

    // Generate explanation
    const explanation = this.generateExplanation(task, best);

    // Assign task to resource
    await taskService.assignToResource(task.id, best.resource.id, best.predictedTime);

    // Update resource load
    const newLoad = Math.min(100, best.resource.currentLoad + 15);
    await resourceService.updateLoad(best.resource.id, newLoad);

    // Record scheduling history
    await this.recordHistory(
      task.id,
      best.resource.id,
      'ML_ENHANCED_SCHEDULING',
      true,
      best.predictedTime,
      best.score,
      explanation
    );

    return {
      taskId: task.id,
      taskName: task.name,
      resourceId: best.resource.id,
      resourceName: best.resource.name,
      predictedTime: best.predictedTime,
      confidence: best.confidence,
      score: best.score,
      explanation
    };
  }

  // Calculate scheduling score (higher is better)
  private calculateScore(task: Task, resource: Resource, predictedTime: number): number {
    // Factors:
    // 1. Lower resource load is better (weight: 0.4)
    // 2. Lower predicted time is better (weight: 0.3)
    // 3. Higher priority tasks should run faster (weight: 0.3)

    const loadScore = (100 - resource.currentLoad) / 100;
    const timeScore = Math.max(0, 1 - (predictedTime / 20)); // Normalize to 20s max
    const priorityBonus = task.priority / 5;

    const score = (loadScore * 0.4) + (timeScore * 0.3) + (priorityBonus * 0.3);
    
    return Math.round(score * 1000) / 1000;
  }

  // Generate human-readable explanation
  private generateExplanation(task: Task, best: ResourceScore): string {
    const reasons: string[] = [];

    reasons.push(`"${task.name}" was assigned to "${best.resource.name}" because:`);
    
    if (best.resource.currentLoad < 50) {
      reasons.push(`• ${best.resource.name} has low load (${best.resource.currentLoad}%)`);
    } else {
      reasons.push(`• ${best.resource.name} is the best available option (${best.resource.currentLoad}% load)`);
    }

    if (task.priority >= 4) {
      reasons.push(`• Task has HIGH priority (${task.priority}/5), requiring fast processing`);
    }

    reasons.push(`• ML predicted execution time: ${best.predictedTime}s (${Math.round(best.confidence * 100)}% confidence)`);
    reasons.push(`• Scheduling score: ${best.score} (highest among available resources)`);

    return reasons.join('\n');
  }

  // Record scheduling decision
  private async recordHistory(
    taskId: string,
    resourceId: string,
    algorithm: string,
    mlEnabled: boolean,
    predictedTime: number,
    score: number,
    explanation: string
  ) {
    return prisma.scheduleHistory.create({
      data: {
        taskId,
        resourceId,
        algorithm,
        mlEnabled,
        predictedTime,
        score,
        explanation
      }
    });
  }

  // Get scheduling history
  async getHistory(limit: number = 50) {
    return prisma.scheduleHistory.findMany({
      include: {
        task: {
          select: { id: true, name: true, type: true, size: true, priority: true }
        },
        resource: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Compare ML vs non-ML scheduling
  async getComparison() {
    const history = await prisma.scheduleHistory.findMany({
      where: { actualTime: { not: null } },
      select: {
        mlEnabled: true,
        predictedTime: true,
        actualTime: true
      }
    });

    interface HistoryRecord {
      mlEnabled: boolean;
      predictedTime: number | null;
      actualTime: number | null;
    }

    const withML = history.filter((h: HistoryRecord) => h.mlEnabled);
    const withoutML = history.filter((h: HistoryRecord) => !h.mlEnabled);

    const calcStats = (items: HistoryRecord[]) => {
      if (items.length === 0) return { count: 0, avgError: 0, avgTime: 0 };
      
      const avgError = items.reduce((sum: number, h: HistoryRecord) => {
        return sum + Math.abs((h.predictedTime || 0) - (h.actualTime || 0));
      }, 0) / items.length;

      const avgTime = items.reduce((sum: number, h: HistoryRecord) => sum + (h.actualTime || 0), 0) / items.length;

      return {
        count: items.length,
        avgError: Math.round(avgError * 100) / 100,
        avgTime: Math.round(avgTime * 100) / 100
      };
    };

    return {
      withML: calcStats(withML),
      withoutML: calcStats(withoutML)
    };
  }
}

export const schedulerService = new SchedulerService();
