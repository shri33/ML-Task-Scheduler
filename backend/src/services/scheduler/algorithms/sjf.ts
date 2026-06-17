import { Task, Resource, ScheduleResult } from '../scheduler.types';
import { schedulerRepository } from '../scheduler.repository';
import { schedulerMLIntegration, sizeMap, typeMap } from '../scheduler.ml';

export async function scheduleSJF(
  tasks: Task[],
  resources: Resource[]
): Promise<ScheduleResult[]> {
  // Get ML predictions to estimate job durations (use first resource load as proxy)
  const batchItems = tasks.flatMap(task =>
    resources.filter(r => r.currentLoad < 100).slice(0, 1).map(resource => ({
      taskId: task.id,
      taskSize: sizeMap[task.size] || 2,
      taskType: typeMap[task.type] || 1,
      priority: task.priority,
      resourceLoad: resource.currentLoad,
      startupOverhead: 1,
    }))
  );
  const predictions = await schedulerMLIntegration.getBatchPredictions(batchItems);

  // Sort tasks by predicted execution time (shortest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const predA = predictions.get(a.id)?.predictedTime ?? 999;
    const predB = predictions.get(b.id)?.predictedTime ?? 999;
    return predA - predB;
  });

  // Re-fetch full predictions for all (task, resource) pairs
  const fullBatch = sortedTasks.flatMap(task =>
    resources.filter(r => r.currentLoad < 100).map(resource => ({
      taskId: `${task.id}::${resource.id}`,
      taskSize: sizeMap[task.size] || 2,
      taskType: typeMap[task.type] || 1,
      priority: task.priority,
      resourceLoad: resource.currentLoad,
      startupOverhead: 1,
    }))
  );
  const fullPredictions = await schedulerMLIntegration.getBatchPredictions(fullBatch);

  const results: ScheduleResult[] = [];
  const resourceLoads = new Map(resources.map(r => [r.id, r.currentLoad]));

  for (const task of sortedTasks) {
    let bestResource = resources[0];
    let bestPredTime = Infinity;
    let bestConfidence = 0.5;

    for (const r of resources) {
      const load = resourceLoads.get(r.id) ?? r.currentLoad;
      if (load >= 100) continue;
      const key = `${task.id}::${r.id}`;
      const pred = fullPredictions.get(key);
      if (pred && pred.predictedTime < bestPredTime) {
        bestPredTime = pred.predictedTime;
        bestConfidence = pred.confidence;
        bestResource = r;
      }
    }

    const currentLoad = resourceLoads.get(bestResource.id) ?? bestResource.currentLoad;
    const score = 0.5 * (1 - bestPredTime / 20) + 0.3 * (task.priority / 5) + 0.2 * ((100 - currentLoad) / 100);

    await schedulerRepository.assignToResource(task.id, bestResource.id, bestPredTime);
    const newLoad = Math.min(100, currentLoad + 15);
    await schedulerRepository.updateLoad(bestResource.id, newLoad);
    resourceLoads.set(bestResource.id, newLoad);

    const explanation = `SJF: Predicted execution ${bestPredTime.toFixed(1)}s — scheduled for fastest completion.`;

    await schedulerRepository.recordHistory(
      task.id,
      bestResource.id,
      'SJF',
      true,
      bestPredTime,
      score,
      `SJF: "${task.name}" predicted ${bestPredTime.toFixed(1)}s (shortest available).`
    );

    results.push({
      taskId: task.id,
      taskName: task.name,
      resourceId: bestResource.id,
      resourceName: bestResource.name,
      predictedTime: bestPredTime,
      confidence: bestConfidence,
      score,
      explanation,
      algorithm: 'sjf',
    });
  }

  return results;
}
export default scheduleSJF;
