import { Task, Resource, ScheduleResult, ResourceScore } from '../scheduler.types';
import { schedulerRepository } from '../scheduler.repository';
import { schedulerMLIntegration, sizeMap, typeMap } from '../scheduler.ml';
import logger from '../../../lib/logger';

export async function scheduleMLEnhanced(
  tasks: Task[],
  resources: Resource[]
): Promise<ScheduleResult[]> {
  const batchItems = tasks.flatMap(task =>
    resources
      .filter(r => r.currentLoad < 100)
      .map(resource => ({
        taskId: `${task.id}::${resource.id}`,
        taskSize: sizeMap[task.size] || 2,
        taskType: typeMap[task.type] || 1,
        priority: task.priority,
        resourceLoad: resource.currentLoad,
        startupOverhead: 1
      }))
  );

  logger.info(`Batch predicting ${batchItems.length} (task,resource) pairs`);
  const predictions = await schedulerMLIntegration.getBatchPredictions(batchItems);

  const results: ScheduleResult[] = [];

  for (const task of tasks) {
    const result = await scheduleTask(task, resources, predictions);
    if (result) {
      results.push(result);
      const resourceIndex = resources.findIndex(r => r.id === result.resourceId);
      if (resourceIndex !== -1) {
        resources[resourceIndex].currentLoad = Math.min(100, resources[resourceIndex].currentLoad + 15);
      }
    }
  }

  return results;
}

async function scheduleTask(
  task: Task,
  availableResources: Resource[],
  predictionMap: Map<string, { predictedTime: number; confidence: number; modelVersion: string }>
): Promise<ScheduleResult | null> {
  if (availableResources.length === 0) return null;

  const resourceScores: ResourceScore[] = [];

  for (const resource of availableResources) {
    if (resource.currentLoad >= 100) continue;

    const key = `${task.id}::${resource.id}`;
    const prediction = predictionMap.get(key) || {
      predictedTime: 5,
      confidence: 0.5,
      modelVersion: 'fallback-v1'
    };

    const score = calculateScore(task, resource, prediction.predictedTime);

    resourceScores.push({
      resource,
      score,
      predictedTime: prediction.predictedTime,
      confidence: prediction.confidence
    });

    await schedulerMLIntegration.savePrediction(
      task.id,
      prediction.predictedTime,
      prediction.confidence,
      {
        taskSize: sizeMap[task.size] || 2,
        taskType: typeMap[task.type] || 1,
        priority: task.priority,
        resourceLoad: resource.currentLoad,
        startupOverhead: 1
      },
      prediction.modelVersion
    );
  }

  if (resourceScores.length === 0) return null;

  resourceScores.sort((a, b) => b.score - a.score);
  const best = resourceScores[0];

  const explanation = generateExplanation(task, best);

  await schedulerRepository.assignToResource(task.id, best.resource.id, best.predictedTime);

  const newLoad = Math.min(100, best.resource.currentLoad + 15);
  await schedulerRepository.updateLoad(best.resource.id, newLoad);

  await schedulerRepository.recordHistory(
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
    explanation,
    algorithm: 'ml_enhanced',
  };
}

function calculateScore(task: Task, resource: Resource, predictedTime: number): number {
  const loadScore = (100 - resource.currentLoad) / 100;
  const timeScore = Math.max(0, 1 - (predictedTime / 20));
  const priorityBonus = task.priority / 5;

  const score = (loadScore * 0.4) + (timeScore * 0.3) + (priorityBonus * 0.3);
  return Math.round(score * 1000) / 1000;
}

function generateExplanation(task: Task, best: ResourceScore): string {
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
export default scheduleMLEnhanced;
