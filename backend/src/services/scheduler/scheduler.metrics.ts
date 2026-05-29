import { Counter, Histogram } from 'prom-client';

export const schedulingRunsTotal = new Counter({
  name: 'scheduling_runs_total',
  help: 'Total number of scheduler runs',
  labelNames: ['algorithm', 'status']
});

export const schedulingDuration = new Histogram({
  name: 'scheduling_duration_seconds',
  help: 'Time spent in scheduling operations',
  labelNames: ['algorithm'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]
});

export const tasksScheduledTotal = new Counter({
  name: 'tasks_scheduled_total',
  help: 'Total tasks successfully scheduled',
  labelNames: ['algorithm']
});
