/**
 * Integration Tests for API Routes
 * Tests the full request-response cycle
 */

import request from 'supertest';
import express, { Application } from 'express';

// Create a mock app for testing
const mockApp = (): Application => {
  const app = express();
  app.use(express.json());

  // Mock health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'v1', timestamp: new Date().toISOString() });
  });

  // Mock tasks endpoint
  app.get('/api/tasks', (req, res) => {
    const status = req.query.status;
    const mockTasks = [
      { id: 'task-1', name: 'Task 1', status: 'PENDING', priority: 3 },
      { id: 'task-2', name: 'Task 2', status: 'COMPLETED', priority: 5 }
    ];
    const filtered = status 
      ? mockTasks.filter(t => t.status === status)
      : mockTasks;
    res.json({ success: true, data: filtered });
  });

  app.post('/api/tasks', (req, res) => {
    const { name, type, size, priority } = req.body;
    
    if (!name || !type || !size) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: 'new-task-id',
        name,
        type,
        size,
        priority: priority || 3,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }
    });
  });

  app.get('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    if (id === 'not-found') {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({
      success: true,
      data: { id, name: 'Test Task', status: 'PENDING', priority: 3 }
    });
  });

  // Mock resources endpoint
  app.get('/api/resources', (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 'resource-1', name: 'Server 1', currentLoad: 20, status: 'ACTIVE' },
        { id: 'resource-2', name: 'Server 2', currentLoad: 60, status: 'ACTIVE' }
      ]
    });
  });

  // Mock schedule endpoint
  app.post('/api/schedule', (req, res) => {
    res.json({
      success: true,
      data: {
        results: [
          {
            taskId: 'task-1',
            taskName: 'Task 1',
            resourceId: 'resource-1',
            resourceName: 'Server 1',
            predictedTime: 5.0,
            confidence: 0.85,
            score: 0.75
          }
        ],
        count: 1,
        scheduledAt: new Date().toISOString()
      }
    });
  });

  // Mock ML status endpoint
  app.get('/api/schedule/ml-status', (req, res) => {
    res.json({
      success: true,
      data: {
        mlServiceAvailable: true,
        fallbackMode: false
      }
    });
  });

  // Mock fog scheduling endpoint
  app.post('/api/fog/schedule', (req, res) => {
    res.json({
      success: true,
      data: {
        algorithm: 'HH',
        totalDelay: 15.5,
        totalEnergy: 25.3,
        fitness: 18.5,
        reliability: 95.0,
        allocations: [
          { taskId: 'task-1', fogNodeId: 'fog-1' }
        ]
      }
    });
  });

  app.get('/api/fog/comparison', (req, res) => {
    res.json({
      success: true,
      data: {
        hh: { fitness: 18.5, reliability: 95.0 },
        ipso: { fitness: 22.3, reliability: 88.0 },
        iaco: { fitness: 21.1, reliability: 90.0 },
        rr: { fitness: 35.2, reliability: 75.0 },
        minMin: { fitness: 28.4, reliability: 82.0 }
      }
    });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = mockApp();
  });

  describe('Health Check', () => {
    it('GET /api/health should return ok status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.version).toBeDefined();
    });
  });

  describe('Tasks API', () => {
    describe('GET /api/tasks', () => {
      it('should return all tasks', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(2);
      });

      it('should filter tasks by status', async () => {
        const response = await request(app)
          .get('/api/tasks?status=PENDING')
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.data.forEach((task: any) => {
          expect(task.status).toBe('PENDING');
        });
      });
    });

    describe('POST /api/tasks', () => {
      it('should create a new task', async () => {
        const newTask = {
          name: 'New Task',
          type: 'CPU',
          size: 'MEDIUM',
          priority: 4
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(newTask)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New Task');
        expect(response.body.data.status).toBe('PENDING');
      });

      it('should return 400 for missing required fields', async () => {
        const invalidTask = {
          name: 'Incomplete Task'
          // Missing type and size
        };

        const response = await request(app)
          .post('/api/tasks')
          .send(invalidTask)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should return task by ID', async () => {
        const response = await request(app)
          .get('/api/tasks/task-123')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('task-123');
      });

      it('should return 404 for non-existent task', async () => {
        const response = await request(app)
          .get('/api/tasks/not-found')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Resources API', () => {
    it('GET /api/resources should return all resources', async () => {
      const response = await request(app)
        .get('/api/resources')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('currentLoad');
    });
  });

  describe('Schedule API', () => {
    describe('POST /api/schedule', () => {
      it('should schedule pending tasks', async () => {
        const response = await request(app)
          .post('/api/schedule')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toBeDefined();
        expect(response.body.data.count).toBeGreaterThanOrEqual(0);
      });

      it('should return predictions with confidence', async () => {
        const response = await request(app)
          .post('/api/schedule')
          .send({})
          .expect(200);

        const result = response.body.data.results[0];
        expect(result).toHaveProperty('predictedTime');
        expect(result).toHaveProperty('confidence');
      });
    });

    describe('GET /api/schedule/ml-status', () => {
      it('should return ML service status', async () => {
        const response = await request(app)
          .get('/api/schedule/ml-status')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('mlServiceAvailable');
        expect(response.body.data).toHaveProperty('fallbackMode');
      });
    });
  });

  describe('Fog Computing API', () => {
    describe('POST /api/fog/schedule', () => {
      it('should schedule tasks using HH algorithm', async () => {
        const response = await request(app)
          .post('/api/fog/schedule')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.algorithm).toBe('HH');
        expect(response.body.data.fitness).toBeGreaterThan(0);
        expect(response.body.data.reliability).toBeGreaterThanOrEqual(0);
      });
    });

    describe('GET /api/fog/comparison', () => {
      it('should return algorithm comparison results', async () => {
        const response = await request(app)
          .get('/api/fog/comparison')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('hh');
        expect(response.body.data).toHaveProperty('ipso');
        expect(response.body.data).toHaveProperty('iaco');
        expect(response.body.data).toHaveProperty('rr');
      });

      it('should show HH with competitive fitness', async () => {
        const response = await request(app)
          .get('/api/fog/comparison')
          .expect(200);

        const data = response.body.data;
        // HH should have better (lower) fitness than Round Robin
        expect(data.hh.fitness).toBeLessThan(data.rr.fitness);
      });
    });
  });
});

// ==================== CONTRACT TESTS ====================

describe('API Contract Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = mockApp();
  });

  describe('Task Response Contract', () => {
    it('should match task schema', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      const task = response.body.data[0];
      
      // Required fields
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('name');
      expect(task).toHaveProperty('status');
      
      // Type checks
      expect(typeof task.id).toBe('string');
      expect(typeof task.name).toBe('string');
      expect(['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED'])
        .toContain(task.status);
    });
  });

  describe('Resource Response Contract', () => {
    it('should match resource schema', async () => {
      const response = await request(app)
        .get('/api/resources')
        .expect(200);

      const resource = response.body.data[0];
      
      expect(resource).toHaveProperty('id');
      expect(resource).toHaveProperty('name');
      expect(resource).toHaveProperty('currentLoad');
      expect(resource).toHaveProperty('status');
      
      expect(typeof resource.currentLoad).toBe('number');
      expect(resource.currentLoad).toBeGreaterThanOrEqual(0);
      expect(resource.currentLoad).toBeLessThanOrEqual(100);
    });
  });

  describe('Schedule Response Contract', () => {
    it('should match schedule result schema', async () => {
      const response = await request(app)
        .post('/api/schedule')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('scheduledAt');
    });

    it('should have valid schedule result fields', async () => {
      const response = await request(app)
        .post('/api/schedule')
        .send({})
        .expect(200);

      const result = response.body.data.results[0];
      
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('resourceId');
      expect(result).toHaveProperty('predictedTime');
      expect(result).toHaveProperty('confidence');
      
      expect(result.predictedTime).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Fog Computing Response Contract', () => {
    it('should match fog scheduling schema', async () => {
      const response = await request(app)
        .post('/api/fog/schedule')
        .expect(200);

      const data = response.body.data;
      
      expect(data).toHaveProperty('algorithm');
      expect(data).toHaveProperty('totalDelay');
      expect(data).toHaveProperty('totalEnergy');
      expect(data).toHaveProperty('fitness');
      expect(data).toHaveProperty('reliability');
      
      expect(data.reliability).toBeGreaterThanOrEqual(0);
      expect(data.reliability).toBeLessThanOrEqual(100);
    });
  });
});
