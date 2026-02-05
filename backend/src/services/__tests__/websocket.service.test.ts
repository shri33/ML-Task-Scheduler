/**
 * Unit Tests for WebSocket Service
 * Tests real-time event emission functionality
 */

import { Server as HttpServer, createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketService } from '../websocket.service';

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn(() => ({ emit: mockEmit }));
  const mockJoin = jest.fn();
  const mockLeave = jest.fn();
  const mockOn = jest.fn();
  const mockUse = jest.fn();
  
  const mockSocket = {
    id: 'test-socket-id',
    handshake: { auth: {}, headers: {} },
    join: mockJoin,
    leave: mockLeave,
    on: mockOn,
    emit: mockEmit,
  };
  
  const mockSockets = new Map([['test-socket-id', mockSocket]]);
  
  return {
    Server: jest.fn().mockImplementation(() => ({
      use: mockUse,
      on: jest.fn((event: string, callback: (socket: any) => void) => {
        if (event === 'connection') {
          callback(mockSocket);
        }
      }),
      to: mockTo,
      emit: mockEmit,
      sockets: { sockets: mockSockets },
    })),
  };
});

describe('WebSocket Service', () => {
  let httpServer: HttpServer;
  let wsService: WebSocketService;
  let mockIo: any;

  beforeAll(() => {
    httpServer = createServer();
    wsService = new WebSocketService(httpServer);
    mockIo = (wsService as any).io;
  });

  afterAll(() => {
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Events', () => {
    test('should emit task created event to tasks room', () => {
      const taskData = { id: 'task-1', name: 'New Task', status: 'PENDING' };
      
      wsService.emitTaskCreated(taskData);

      expect(mockIo.to).toHaveBeenCalledWith('tasks');
      expect(mockIo.to).toHaveBeenCalledWith('general');
    });

    test('should emit task updated event', () => {
      const taskData = { id: 'task-1', name: 'Updated Task', status: 'COMPLETED' };
      
      wsService.emitTaskUpdated(taskData);

      expect(mockIo.to).toHaveBeenCalledWith('tasks');
    });

    test('should emit task deleted event', () => {
      wsService.emitTaskDeleted('task-1');

      expect(mockIo.to).toHaveBeenCalledWith('tasks');
    });

    test('should emit tasks scheduled event', () => {
      const results = [{ taskId: 'task-1', resourceId: 'res-1' }];
      
      wsService.emitTasksScheduled(results);

      expect(mockIo.to).toHaveBeenCalledWith('tasks');
    });
  });

  describe('Resource Events', () => {
    test('should emit resource created event', () => {
      const resourceData = { id: 'res-1', name: 'Server 1', capacity: 100 };
      
      wsService.emitResourceCreated(resourceData);

      expect(mockIo.to).toHaveBeenCalledWith('resources');
    });

    test('should emit resource updated event', () => {
      const resourceData = { id: 'res-1', currentLoad: 75 };
      
      wsService.emitResourceUpdated(resourceData);

      expect(mockIo.to).toHaveBeenCalledWith('resources');
    });

    test('should emit resource deleted event', () => {
      wsService.emitResourceDeleted('res-1');

      expect(mockIo.to).toHaveBeenCalledWith('resources');
    });
  });

  describe('ML Events', () => {
    test('should emit ML model updated event', () => {
      const model = { version: 'v20260205', modelType: 'random_forest', r2Score: 0.92 };
      
      wsService.emitMLModelUpdated(model);

      expect(mockIo.to).toHaveBeenCalledWith('general');
      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });

    test('should emit ML training started event', () => {
      wsService.emitMLTrainingStarted({ jobId: 'job-123', triggerType: 'auto' });

      expect(mockIo.to).toHaveBeenCalledWith('general');
      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });

    test('should emit ML training progress event', () => {
      wsService.emitMLTrainingProgress({ jobId: 'job-123', progress: 50 });

      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });

    test('should emit ML training completed event', () => {
      const completedData = {
        jobId: 'job-123',
        model: { version: 'v20260205' },
        metrics: { r2Score: 0.92 },
      };
      
      wsService.emitMLTrainingCompleted(completedData);

      expect(mockIo.to).toHaveBeenCalledWith('general');
      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });

    test('should emit ML training failed event', () => {
      wsService.emitMLTrainingFailed({ error: 'Insufficient data' });

      expect(mockIo.to).toHaveBeenCalledWith('general');
      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });

    test('should emit ML service health change event', () => {
      wsService.emitMLServiceHealthChange({ isHealthy: false, fallbackMode: true });

      expect(mockIo.to).toHaveBeenCalledWith('general');
    });

    test('should emit ML prediction made event', () => {
      const predictionData = {
        taskId: 'task-1',
        predictedTime: 5.5,
        confidence: 0.92,
        modelVersion: 'v20260205',
      };
      
      wsService.emitMLPredictionMade(predictionData);

      expect(mockIo.to).toHaveBeenCalledWith('ml-events');
    });
  });

  describe('Fog Computing Events', () => {
    test('should emit fog algorithm started event', () => {
      wsService.emitFogAlgorithmStarted('HH', 50);

      expect(mockIo.to).toHaveBeenCalledWith('fog-computing');
    });

    test('should emit fog algorithm progress event', () => {
      wsService.emitFogAlgorithmProgress('IPSO', 75);

      expect(mockIo.to).toHaveBeenCalledWith('fog-computing');
    });

    test('should emit fog algorithm completed event', () => {
      const results = { totalDelay: 100, totalEnergy: 50 };
      
      wsService.emitFogAlgorithmCompleted('HH', results);

      expect(mockIo.to).toHaveBeenCalledWith('fog-computing');
    });
  });

  describe('System Events', () => {
    test('should emit system alert', () => {
      wsService.emitSystemAlert({
        type: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert',
      });

      expect(mockIo.to).toHaveBeenCalledWith('general');
    });

    test('should emit metrics update', () => {
      wsService.emitMetricsUpdate({ cpu: 75, activeConnections: 10 });

      expect(mockIo.to).toHaveBeenCalledWith('general');
    });
  });

  describe('User Events', () => {
    test('should emit to specific user', () => {
      wsService.emitToUser('user-123', 'notification', { message: 'Hello' });

      expect(mockIo.to).toHaveBeenCalledWith('user:user-123');
    });

    test('should emit global notification', () => {
      wsService.emitGlobalNotification({ message: 'System update' });

      expect(mockIo.to).toHaveBeenCalledWith('general');
    });
  });

  describe('Utility Methods', () => {
    test('should return connected users count', () => {
      const count = wsService.getConnectedUsersCount();
      expect(typeof count).toBe('number');
    });

    test('should return connected socket IDs', () => {
      const sockets = wsService.getConnectedSockets();
      expect(Array.isArray(sockets)).toBe(true);
    });

    test('should return Socket.IO server instance', () => {
      const io = wsService.getIO();
      expect(io).toBeDefined();
    });
  });
});
