import { Task, Resource, ScheduleResult } from '../scheduler.types';
import { schedulerRepository } from '../scheduler.repository';
import { schedulerMLIntegration, sizeMap, typeMap } from '../scheduler.ml';

export async function scheduleEDF(
  tasks: Task[],
  resources: Resource[]
): Promise<ScheduleResult[]> {
  // Sort tasks by deadline urgency (earliest due date first, nulls last)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return b.priority - a.priority;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  // Get ML predictions for time estimates
  const batchItems = sortedTasks.flatMap(task =>
    resources.filter(r => r.currentLoad < 100).map(resource => ({
      taskId: `${task.id}::${resource.id}`,
      taskSize: sizeMap[task.size] || 2,
      taskType: typeMap[task.type] || 1,
      priority: task.priority,
      resourceLoad: resource.currentLoad,
      startupOverhead: 1,
    }))
  );
  const predictions = await schedulerMLIntegration.getBatchPredictions(batchItems);

  const results: ScheduleResult[] = [];
  const resourceLoads = new Map(resources.map(r => [r.id, r.currentLoad]));

  for (const task of sortedTasks) {
    // Find the least-loaded resource
    let bestResource = resources[0];
    let minLoad = Infinity;
    for (const r of resources) {
      const load = resourceLoads.get(r.id) ?? r.currentLoad;
      if (load < minLoad && load < 100) {
        minLoad = load;
        bestResource = r;
      }
    }

    const key = `${task.id}::${bestResource.id}`;
    const prediction = predictions.get(key) || { predictedTime: 5, confidence: 0.5, modelVersion: 'fallback' };

    const deadlineUrgency = task.dueDate
      ? Math.max(0, 1 - ((task.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;
    const score = 0.5 * deadlineUrgency + 0.3 * (task.priority / 5) + 0.2 * ((100 - minLoad) / 100);

    // Persist assignment
    await schedulerRepository.assignToResource(task.id, bestResource.id, prediction.predictedTime);
    const newLoad = Math.min(100, minLoad + 15);
    await schedulerRepository.updateLoad(bestResource.id, newLoad);
    resourceLoads.set(bestResource.id, newLoad);

    const explanation = `EDF: Deadline urgency=${(deadlineUrgency * 100).toFixed(0)}%, priority=${task.priority}/5`;

    await schedulerRepository.recordHistory(
      task.id,
      bestResource.id,
      'EDF',
      true,
      prediction.predictedTime,
      score,
      `EDF: Task "${task.name}" scheduled first due to ${task.dueDate ? 'earliest deadline' : 'high priority'}.`
    );

    results.push({
      taskId: task.id,
      taskName: task.name,
      resourceId: bestResource.id,
      resourceName: bestResource.name,
      predictedTime: prediction.predictedTime,
      confidence: prediction.confidence,
      score,
      explanation,
      algorithm: 'edf',
    });
  }

  return results;
}
export default scheduleEDF;
