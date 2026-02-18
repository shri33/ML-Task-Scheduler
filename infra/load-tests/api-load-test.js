// =============================================================================
// k6 Load Test - API Endpoints
// Run: k6 run infra/load-tests/api-load-test.js
// =============================================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const taskCreationDuration = new Trend('task_creation_duration');
const predictionDuration = new Trend('prediction_duration');
const tasksCreated = new Counter('tasks_created');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '1m',
      tags: { scenario: 'load' },
    },
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 0 },
      ],
      startTime: '17m',
      tags: { scenario: 'stress' },
    },
    // Spike test - sudden traffic spike
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 1000 },  // Instant spike
        { duration: '1m', target: 1000 },   // Hold
        { duration: '10s', target: 0 },     // Instant drop
      ],
      startTime: '37m',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    task_creation_duration: ['p(95)<300'],
    prediction_duration: ['p(95)<1000'],
  },
};

// Setup - authenticate and get token
export function setup() {
  const loginRes = http.post(`${API_URL}/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token };
  }
  
  // If login fails, try to register
  const registerRes = http.post(`${API_URL}/auth/register`, JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Load Test User',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    return { token: body.token };
  }
  
  console.error('Failed to authenticate');
  return { token: null };
}

// Main test function
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
  });

  group('Tasks API', () => {
    // List tasks
    const listRes = http.get(`${API_URL}/tasks`, { headers });
    check(listRes, {
      'list tasks status is 200': (r) => r.status === 200,
      'list tasks returns array': (r) => Array.isArray(JSON.parse(r.body)),
    }) || errorRate.add(1);

    // Create task
    const taskData = {
      name: `Load Test Task ${Date.now()}`,
      cpuRequired: Math.floor(Math.random() * 4) + 1,
      memoryRequired: Math.floor(Math.random() * 2048) + 512,
      priority: Math.floor(Math.random() * 5) + 1,
      deadline: new Date(Date.now() + 3600000).toISOString(),
    };

    const createStart = Date.now();
    const createRes = http.post(`${API_URL}/tasks`, JSON.stringify(taskData), { headers });
    taskCreationDuration.add(Date.now() - createStart);

    const taskCreated = check(createRes, {
      'create task status is 201': (r) => r.status === 201,
      'create task returns id': (r) => JSON.parse(r.body).id !== undefined,
    });

    if (taskCreated) {
      tasksCreated.add(1);
      const task = JSON.parse(createRes.body);

      // Get task by ID
      const getRes = http.get(`${API_URL}/tasks/${task.id}`, { headers });
      check(getRes, {
        'get task status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);

      // Update task
      const updateRes = http.put(`${API_URL}/tasks/${task.id}`, JSON.stringify({
        ...taskData,
        priority: 5,
      }), { headers });
      check(updateRes, {
        'update task status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);

      // Delete task (cleanup)
      const deleteRes = http.del(`${API_URL}/tasks/${task.id}`, null, { headers });
      check(deleteRes, {
        'delete task status is 200 or 204': (r) => r.status === 200 || r.status === 204,
      });
    } else {
      errorRate.add(1);
    }
  });

  group('ML Predictions', () => {
    const predictionData = {
      cpuRequired: Math.floor(Math.random() * 4) + 1,
      memoryRequired: Math.floor(Math.random() * 2048) + 512,
      priority: Math.floor(Math.random() * 5) + 1,
    };

    const predStart = Date.now();
    const predRes = http.post(`${API_URL}/schedule/predict`, JSON.stringify(predictionData), { headers });
    predictionDuration.add(Date.now() - predStart);

    check(predRes, {
      'prediction status is 200': (r) => r.status === 200,
      'prediction returns executionTime': (r) => JSON.parse(r.body).executionTime !== undefined,
    }) || errorRate.add(1);
  });

  group('Resources', () => {
    const listRes = http.get(`${API_URL}/resources`, { headers });
    check(listRes, {
      'list resources status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group('Metrics', () => {
    const metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
      'metrics endpoint responds': (r) => r.status === 200,
      'metrics contains http_requests': (r) => r.body.includes('http_requests'),
    });
  });

  sleep(1);
}

// Teardown
export function teardown(data) {
  console.log('Load test completed');
}
