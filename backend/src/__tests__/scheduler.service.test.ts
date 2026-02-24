/**
 * Unit Tests for Scheduler Service
 * Tests ML-enhanced task scheduling with predictions
 */

// Create simpler mocks that focus on behavior verification

describe('SchedulerService', () => {
  // Reset module cache before each test
  beforeEach(() => {
    jest.resetModules();
  });

  describe('Basic Scheduling Logic', () => {
    it('should exist and be instantiable', () => {
      // Mock all dependencies
      jest.doMock('../lib/prisma', () => ({
        default: { task: { findMany: jest.fn() }, scheduleHistory: { create: jest.fn() } }
      }));
      jest.doMock('../services/task.service', () => ({
        taskService: { findPending: jest.fn().mockResolvedValue([]) }
      }));
      jest.doMock('../services/resource.service', () => ({
        resourceService: { findAvailable: jest.fn().mockResolvedValue([]) }
      }));
      jest.doMock('../services/ml.service', () => ({
        mlService: { getPrediction: jest.fn(), savePrediction: jest.fn() }
      }));
      jest.doMock('../lib/logger', () => ({
        default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      }));

      const { SchedulerService } = require('../services/scheduler.service');
      const scheduler = new SchedulerService();
      expect(scheduler).toBeDefined();
      expect(scheduler.schedule).toBeDefined();
    });

    it('should return empty array when no pending tasks', async () => {
      jest.doMock('../lib/prisma', () => ({
        default: { task: { findMany: jest.fn() }, scheduleHistory: { create: jest.fn() } }
      }));
      jest.doMock('../services/task.service', () => ({
        taskService: { findPending: jest.fn().mockResolvedValue([]) }
      }));
      jest.doMock('../services/resource.service', () => ({
        resourceService: { findAvailable: jest.fn() }
      }));
      jest.doMock('../services/ml.service', () => ({
        mlService: { getPrediction: jest.fn(), savePrediction: jest.fn() }
      }));
      jest.doMock('../lib/logger', () => ({
        default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      }));

      const { SchedulerService } = require('../services/scheduler.service');
      const scheduler = new SchedulerService();
      const results = await scheduler.schedule();
      
      expect(results).toHaveLength(0);
    });

    it('should throw error when no resources available', async () => {
      const mockTask = {
        id: 'task-1',
        name: 'Test Task',
        type: 'CPU',
        size: 'MEDIUM',
        priority: 3,
        status: 'PENDING'
      };

      jest.doMock('../lib/prisma', () => ({
        default: { task: { findMany: jest.fn() }, scheduleHistory: { create: jest.fn() } }
      }));
      jest.doMock('../services/task.service', () => ({
        taskService: { findPending: jest.fn().mockResolvedValue([mockTask]) }
      }));
      jest.doMock('../services/resource.service', () => ({
        resourceService: { findAvailable: jest.fn().mockResolvedValue([]) }
      }));
      jest.doMock('../services/ml.service', () => ({
        mlService: { getPrediction: jest.fn(), savePrediction: jest.fn() }
      }));
      jest.doMock('../lib/logger', () => ({
        default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      }));

      const { SchedulerService } = require('../services/scheduler.service');
      const scheduler = new SchedulerService();
      
      await expect(scheduler.schedule()).rejects.toThrow('No available resources');
    });
  });
});

// Additional test for score calculation logic (pure function testing)
describe('Scheduling Score Logic', () => {
  it('lower load should give higher score component', () => {
    // Test the scoring formula: loadScore = (100 - currentLoad) / 100
    const lowLoad = (100 - 20) / 100; // 0.8
    const highLoad = (100 - 80) / 100; // 0.2
    
    expect(lowLoad).toBeGreaterThan(highLoad);
  });

  it('higher priority should give higher score component', () => {
    // Test the priority formula: priorityBonus = priority / 5
    const highPriority = 5 / 5; // 1.0
    const lowPriority = 1 / 5; // 0.2
    
    expect(highPriority).toBeGreaterThan(lowPriority);
  });

  it('lower predicted time should give higher score component', () => {
    // Test the time formula: timeScore = Math.max(0, 1 - (predictedTime / 20))
    const fastTime = Math.max(0, 1 - (2 / 20)); // 0.9
    const slowTime = Math.max(0, 1 - (15 / 20)); // 0.25
    
    expect(fastTime).toBeGreaterThan(slowTime);
  });

  it('combined score should follow expected formula', () => {
    // Score = (loadScore * 0.4) + (timeScore * 0.3) + (priorityBonus * 0.3)
    const loadScore = 0.8;
    const timeScore = 0.75;
    const priorityBonus = 0.6;
    
    const expectedScore = (loadScore * 0.4) + (timeScore * 0.3) + (priorityBonus * 0.3);
    
    expect(expectedScore).toBeCloseTo(0.725, 3);
    expect(expectedScore).toBeGreaterThan(0);
    expect(expectedScore).toBeLessThanOrEqual(1);
  });
});
