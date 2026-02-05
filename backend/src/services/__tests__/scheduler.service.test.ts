/**
 * Unit Tests for Scheduler Service
 * Tests ML-enhanced scheduling and score calculation
 */

import { SchedulerService } from '../scheduler.service';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: jest.fn(),
    },
    scheduleHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../task.service', () => ({
  taskService: {
    findPending: jest.fn(),
    assignToResource: jest.fn(),
  },
}));

jest.mock('../resource.service', () => ({
  resourceService: {
    findAvailable: jest.fn(),
    updateLoad: jest.fn(),
  },
}));

jest.mock('../ml.service', () => ({
  mlService: {
    getPrediction: jest.fn(),
    savePrediction: jest.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { taskService } from '../task.service';
import { resourceService } from '../resource.service';
import { mlService } from '../ml.service';

describe('Scheduler Service', () => {
  let schedulerService: SchedulerService;

  const mockTasks = [
    {
      id: 'task-1',
      name: 'Test Task 1',
      type: 'CPU',
      size: 'MEDIUM',
      priority: 3,
      status: 'PENDING',
      predictedTime: null,
      actualTime: null,
      resourceId: null,
      createdAt: new Date(),
      scheduledAt: null,
      completedAt: null,
    },
    {
      id: 'task-2',
      name: 'Test Task 2',
      type: 'IO',
      size: 'LARGE',
      priority: 5,
      status: 'PENDING',
      predictedTime: null,
      actualTime: null,
      resourceId: null,
      createdAt: new Date(),
      scheduledAt: null,
      completedAt: null,
    },
  ];

  const mockResources = [
    {
      id: 'resource-1',
      name: 'Server 1',
      capacity: 100,
      currentLoad: 25,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'resource-2',
      name: 'Server 2',
      capacity: 100,
      currentLoad: 75,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    schedulerService = new SchedulerService();
  });

  describe('schedule', () => {
    test('should schedule pending tasks to available resources', async () => {
      (taskService.findPending as jest.Mock).mockResolvedValue(mockTasks);
      (resourceService.findAvailable as jest.Mock).mockResolvedValue(mockResources);
      (mlService.getPrediction as jest.Mock).mockResolvedValue({
        predictedTime: 5.0,
        confidence: 0.9,
        modelVersion: 'v1',
      });
      (mlService.savePrediction as jest.Mock).mockResolvedValue({});
      (taskService.assignToResource as jest.Mock).mockResolvedValue({});
      (resourceService.updateLoad as jest.Mock).mockResolvedValue({});
      (prisma.scheduleHistory.create as jest.Mock).mockResolvedValue({});

      const results = await schedulerService.schedule();

      expect(results).toHaveLength(2);
      expect(taskService.findPending).toHaveBeenCalled();
      expect(resourceService.findAvailable).toHaveBeenCalled();
    });

    test('should throw error when no resources available', async () => {
      (taskService.findPending as jest.Mock).mockResolvedValue(mockTasks);
      (resourceService.findAvailable as jest.Mock).mockResolvedValue([]);

      await expect(schedulerService.schedule()).rejects.toThrow(
        'No available resources for scheduling'
      );
    });

    test('should return empty array when no pending tasks', async () => {
      (taskService.findPending as jest.Mock).mockResolvedValue([]);

      const results = await schedulerService.schedule();

      expect(results).toHaveLength(0);
    });

    test('should prefer resources with lower load', async () => {
      (taskService.findPending as jest.Mock).mockResolvedValue([mockTasks[0]]);
      (resourceService.findAvailable as jest.Mock).mockResolvedValue(mockResources);
      (mlService.getPrediction as jest.Mock).mockResolvedValue({
        predictedTime: 5.0,
        confidence: 0.9,
        modelVersion: 'v1',
      });
      (mlService.savePrediction as jest.Mock).mockResolvedValue({});
      (taskService.assignToResource as jest.Mock).mockResolvedValue({});
      (resourceService.updateLoad as jest.Mock).mockResolvedValue({});
      (prisma.scheduleHistory.create as jest.Mock).mockResolvedValue({});

      const results = await schedulerService.schedule();

      // Should assign to resource-1 (lower load)
      expect(results[0].resourceId).toBe('resource-1');
    });
  });

  describe('calculateScore', () => {
    test('should return higher score for lower resource load', () => {
      const task = mockTasks[0];
      const lowLoadResource = { ...mockResources[0], currentLoad: 10 };
      const highLoadResource = { ...mockResources[1], currentLoad: 90 };
      const predictedTime = 5;

      const lowLoadScore = (schedulerService as any).calculateScore(task, lowLoadResource, predictedTime);
      const highLoadScore = (schedulerService as any).calculateScore(task, highLoadResource, predictedTime);

      expect(lowLoadScore).toBeGreaterThan(highLoadScore);
    });

    test('should return higher score for lower predicted time', () => {
      const task = mockTasks[0];
      const resource = mockResources[0];

      const lowTimeScore = (schedulerService as any).calculateScore(task, resource, 2);
      const highTimeScore = (schedulerService as any).calculateScore(task, resource, 15);

      expect(lowTimeScore).toBeGreaterThan(highTimeScore);
    });

    test('should return higher score for higher priority tasks', () => {
      const lowPriorityTask = { ...mockTasks[0], priority: 1 };
      const highPriorityTask = { ...mockTasks[0], priority: 5 };
      const resource = mockResources[0];
      const predictedTime = 5;

      const lowPriorityScore = (schedulerService as any).calculateScore(lowPriorityTask, resource, predictedTime);
      const highPriorityScore = (schedulerService as any).calculateScore(highPriorityTask, resource, predictedTime);

      expect(highPriorityScore).toBeGreaterThan(lowPriorityScore);
    });

    test('should return score between 0 and 1', () => {
      const task = mockTasks[0];
      const resource = mockResources[0];

      const score = (schedulerService as any).calculateScore(task, resource, 5);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('generateExplanation', () => {
    test('should include task and resource names', () => {
      const task = mockTasks[0];
      const best = {
        resource: mockResources[0],
        score: 0.8,
        predictedTime: 5,
        confidence: 0.9,
      };

      const explanation = (schedulerService as any).generateExplanation(task, best);

      expect(explanation).toContain(task.name);
      expect(explanation).toContain(best.resource.name);
    });

    test('should mention high priority for priority >= 4', () => {
      const task = { ...mockTasks[0], priority: 5 };
      const best = {
        resource: mockResources[0],
        score: 0.8,
        predictedTime: 5,
        confidence: 0.9,
      };

      const explanation = (schedulerService as any).generateExplanation(task, best);

      expect(explanation).toContain('HIGH priority');
    });

    test('should include ML prediction details', () => {
      const task = mockTasks[0];
      const best = {
        resource: mockResources[0],
        score: 0.8,
        predictedTime: 5,
        confidence: 0.9,
      };

      const explanation = (schedulerService as any).generateExplanation(task, best);

      expect(explanation).toContain('5s');
      expect(explanation).toContain('90%');
    });
  });

  describe('getComparison', () => {
    test('should calculate statistics for ML and non-ML scheduling', async () => {
      const mockHistory = [
        { mlEnabled: true, predictedTime: 5, actualTime: 5.2 },
        { mlEnabled: true, predictedTime: 3, actualTime: 3.5 },
        { mlEnabled: false, predictedTime: 5, actualTime: 7 },
        { mlEnabled: false, predictedTime: 3, actualTime: 5 },
      ];

      (prisma.scheduleHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const comparison = await schedulerService.getComparison();

      expect(comparison.withML.count).toBe(2);
      expect(comparison.withoutML.count).toBe(2);
      expect(comparison.withML.avgError).toBeLessThan(comparison.withoutML.avgError);
    });

    test('should handle empty history', async () => {
      (prisma.scheduleHistory.findMany as jest.Mock).mockResolvedValue([]);

      const comparison = await schedulerService.getComparison();

      expect(comparison.withML.count).toBe(0);
      expect(comparison.withoutML.count).toBe(0);
    });
  });
});
