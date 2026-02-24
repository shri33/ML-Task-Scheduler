import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../index';
import { act } from '@testing-library/react';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStore.setState({
      tasks: [],
      tasksLoading: false,
      resources: [],
      resourcesLoading: false,
      metrics: null,
      metricsLoading: false,
      mlAvailable: false,
      scheduling: false,
    });
  });

  describe('Tasks', () => {
    it('has initial empty tasks array', () => {
      const { tasks } = useStore.getState();
      expect(tasks).toEqual([]);
    });

    it('adds a task correctly', () => {
      const task = {
        id: '1',
        name: 'Test Task',
        type: 'CPU' as const,
        size: 'MEDIUM' as const,
        priority: 5,
        status: 'PENDING' as const,
        dueDate: null,
        predictedTime: null,
        actualTime: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
        scheduledAt: null,
        completedAt: null,
      };

      act(() => {
        useStore.getState().addTask(task);
      });

      const { tasks } = useStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(task);
    });

    it('updates a task correctly', () => {
      const task = {
        id: '1',
        name: 'Test Task',
        type: 'CPU' as const,
        size: 'MEDIUM' as const,
        priority: 5,
        status: 'PENDING' as const,
        dueDate: null,
        predictedTime: null,
        actualTime: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
        scheduledAt: null,
        completedAt: null,
      };

      act(() => {
        useStore.getState().addTask(task);
      });

      const updatedTask = { ...task, name: 'Updated Task', priority: 10 };
      
      act(() => {
        useStore.getState().updateTask(updatedTask);
      });

      const { tasks } = useStore.getState();
      expect(tasks[0].name).toBe('Updated Task');
      expect(tasks[0].priority).toBe(10);
    });

    it('removes a task correctly', () => {
      const task = {
        id: '1',
        name: 'Test Task',
        type: 'CPU' as const,
        size: 'MEDIUM' as const,
        priority: 5,
        status: 'PENDING' as const,
        dueDate: null,
        predictedTime: null,
        actualTime: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
        scheduledAt: null,
        completedAt: null,
      };

      act(() => {
        useStore.getState().addTask(task);
      });

      expect(useStore.getState().tasks).toHaveLength(1);

      act(() => {
        useStore.getState().removeTask('1');
      });

      expect(useStore.getState().tasks).toHaveLength(0);
    });
  });

  describe('Resources', () => {
    it('has initial empty resources array', () => {
      const { resources } = useStore.getState();
      expect(resources).toEqual([]);
    });

    it('adds a resource correctly', () => {
      const resource = {
        id: '1',
        name: 'Test Resource',
        capacity: 100,
        currentLoad: 50,
        status: 'AVAILABLE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        useStore.getState().addResource(resource);
      });

      const { resources } = useStore.getState();
      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual(resource);
    });

    it('updates a resource correctly', () => {
      const resource = {
        id: '1',
        name: 'Test Resource',
        capacity: 100,
        currentLoad: 50,
        status: 'AVAILABLE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        useStore.getState().addResource(resource);
      });

      const updatedResource = { ...resource, currentLoad: 75, status: 'BUSY' as const };
      
      act(() => {
        useStore.getState().updateResource(updatedResource);
      });

      const { resources } = useStore.getState();
      expect(resources[0].currentLoad).toBe(75);
      expect(resources[0].status).toBe('BUSY');
    });

    it('removes a resource correctly', () => {
      const resource = {
        id: '1',
        name: 'Test Resource',
        capacity: 100,
        currentLoad: 50,
        status: 'AVAILABLE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        useStore.getState().addResource(resource);
      });

      expect(useStore.getState().resources).toHaveLength(1);

      act(() => {
        useStore.getState().removeResource('1');
      });

      expect(useStore.getState().resources).toHaveLength(0);
    });
  });

  describe('Loading states', () => {
    it('has correct initial loading states', () => {
      const state = useStore.getState();
      expect(state.tasksLoading).toBe(false);
      expect(state.resourcesLoading).toBe(false);
      expect(state.metricsLoading).toBe(false);
      expect(state.scheduling).toBe(false);
    });
  });

  describe('ML Status', () => {
    it('has initial mlAvailable as false', () => {
      const { mlAvailable } = useStore.getState();
      expect(mlAvailable).toBe(false);
    });
  });
});
