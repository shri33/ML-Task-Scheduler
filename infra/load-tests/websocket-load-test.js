// =============================================================================
// k6 WebSocket Load Test
// Tests real-time functionality
// Run: k6 run infra/load-tests/websocket-load-test.js
// =============================================================================

import { WebSocket } from 'k6/experimental/websockets';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const messagesReceived = new Counter('ws_messages_received');
const connectionDuration = new Trend('ws_connection_duration');
const messageLatency = new Trend('ws_message_latency');

// Configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export const options = {
  scenarios: {
    websocket_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 connections
        { duration: '2m', target: 50 },    // Hold
        { duration: '30s', target: 100 },  // Ramp up to 100 connections
        { duration: '2m', target: 100 },   // Hold
        { duration: '30s', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    ws_messages_received: ['count>100'],
    ws_connection_duration: ['p(95)<5000'],
    ws_message_latency: ['p(95)<200'],
  },
};

export default function () {
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const startTime = Date.now();
  
  const ws = new WebSocket(url);
  
  ws.onopen = () => {
    connectionDuration.add(Date.now() - startTime);
    console.log('WebSocket connected');
    
    // Socket.IO handshake
    ws.send('40');
    
    // Subscribe to task updates
    setTimeout(() => {
      const subscribeMsg = JSON.stringify(['subscribe', { channel: 'tasks' }]);
      ws.send(`42${subscribeMsg}`);
    }, 1000);
  };
  
  ws.onmessage = (event) => {
    messagesReceived.add(1);
    
    const data = event.data;
    
    // Handle Socket.IO protocol
    if (data.startsWith('42')) {
      const payload = JSON.parse(data.substring(2));
      const receiveTime = Date.now();
      
      // Calculate latency if timestamp is included
      if (payload[1] && payload[1].timestamp) {
        messageLatency.add(receiveTime - payload[1].timestamp);
      }
      
      check(payload, {
        'message is array': (p) => Array.isArray(p),
        'message has event name': (p) => typeof p[0] === 'string',
      });
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket closed');
  };
  
  // Keep connection alive for test duration
  // The connection will be closed when the VU iteration ends
}
