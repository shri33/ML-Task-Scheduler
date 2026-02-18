# Load Testing Guide

This directory contains k6 load tests for the ML Task Scheduler.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Windows
winget install k6

# Docker
docker pull grafana/k6
```

## Test Files

| File | Description |
|------|-------------|
| `api-load-test.js` | Full API endpoint testing with multiple scenarios |
| `websocket-load-test.js` | WebSocket/Socket.IO connection testing |

## Running Tests

### Smoke Test (Quick Validation)
```bash
k6 run --out json=results.json infra/load-tests/api-load-test.js
```

### With Custom URL
```bash
k6 run -e BASE_URL=https://api.ml-scheduler.example.com infra/load-tests/api-load-test.js
```

### Docker
```bash
docker run --rm -i grafana/k6 run - < infra/load-tests/api-load-test.js
```

### With Specific Scenario
```bash
# Run only the load scenario
k6 run --tag scenario=load infra/load-tests/api-load-test.js
```

## Test Scenarios

### API Load Test Scenarios

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| Smoke | 1 | 1m | Verify system works |
| Load | 50-100 | 14m | Normal traffic patterns |
| Stress | 100-300 | 19m | Find breaking points |
| Spike | 0→1000→0 | ~2m | Sudden traffic bursts |

### Thresholds

- **p(95) < 500ms**: 95% of requests complete in under 500ms
- **p(99) < 1000ms**: 99% of requests complete in under 1 second
- **Error rate < 1%**: Less than 1% of requests fail
- **Task creation p(95) < 300ms**: Task creation is fast
- **Predictions p(95) < 1000ms**: ML predictions are reasonable

## Analyzing Results

### Console Output
k6 provides real-time metrics in the console including:
- Request rate (req/s)
- Response time percentiles
- Error rate
- Custom metrics

### JSON Output
```bash
k6 run --out json=results.json infra/load-tests/api-load-test.js
```

### InfluxDB + Grafana
```bash
# Start InfluxDB
docker run -d -p 8086:8086 influxdb:1.8

# Run k6 with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 infra/load-tests/api-load-test.js
```

### Cloud (k6 Cloud)
```bash
k6 cloud infra/load-tests/api-load-test.js
```

## Custom Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `errors` | Rate | Error rate for checked conditions |
| `task_creation_duration` | Trend | Time to create a task |
| `prediction_duration` | Trend | Time for ML prediction |
| `tasks_created` | Counter | Total tasks created |
| `ws_messages_received` | Counter | WebSocket messages received |
| `ws_connection_duration` | Trend | Time to establish WS connection |
| `ws_message_latency` | Trend | Round-trip message latency |

## Performance Baselines

Expected performance for production workloads:

| Endpoint | Target p95 | Target p99 |
|----------|------------|------------|
| `GET /health` | < 50ms | < 100ms |
| `GET /api/v1/tasks` | < 200ms | < 400ms |
| `POST /api/v1/tasks` | < 300ms | < 500ms |
| `POST /api/v1/schedule/predict` | < 1000ms | < 2000ms |
| `GET /metrics` | < 100ms | < 200ms |

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Run Load Tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: infra/load-tests/api-load-test.js
    flags: --vus 10 --duration 30s
```

## Troubleshooting

### "Authentication failed"
Ensure test user exists or update credentials in the test file.

### "Connection refused"
Check that the API is running and BASE_URL is correct.

### High error rates
- Check server logs
- Verify database connections
- Check Redis connectivity
