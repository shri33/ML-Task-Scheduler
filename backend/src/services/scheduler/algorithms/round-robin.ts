import { Task, Resource, ScheduleResult } from '../scheduler.types';
import { schedulerRepository } from '../scheduler.repository';

export async function scheduleRoundRobin(
  tasks: Task[],
  resources: Resource[]
): Promise<ScheduleResult[]> {
  const results: ScheduleResult[] = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const bestResource = resources[i % resources.length];
    const predictedTime = 5.0; // Default execution estimate
    const score = 1.0;
    
    // Persist assignment in DB
    await schedulerRepository.assignToResource(task.id, bestResource.id, predictedTime);
    const newLoad = Math.min(100, bestResource.currentLoad + 15);
    await schedulerRepository.updateLoad(bestResource.id, newLoad);
    bestResource.currentLoad = newLoad; // Update in-memory state

    const explanation = `Round-Robin: Task "${task.name}" cyclically assigned to "${bestResource.name}".`;

    await schedulerRepository.recordHistory(
      task.id,
      bestResource.id,
      'ROUND_ROBIN',
      false,
      predictedTime,
      score,
      explanation
    );

    results.push({
      taskId: task.id,
      taskName: task.name,
      resourceId: bestResource.id,
      resourceName: bestResource.name,
      predictedTime,
      confidence: 1.0,
      score,
      explanation,
      algorithm: 'round_robin'
    });
  }

  return results;
}
export default scheduleRoundRobin;
