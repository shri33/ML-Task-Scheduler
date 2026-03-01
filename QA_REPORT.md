# QA Report – ML-Enhanced Task Scheduler with Fog Computing

**Generated:** 2026-02-27  
**Paper:** Wang & Li (2019) – "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing"

---

## 1. Infrastructure & Docker

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `docker compose up --build` starts all 5 services | ✅ PASS | db, redis, backend, ml-service, frontend all healthy |
| 2 | Services inter-communicate (backend → DB, backend → ML, frontend → backend) | ✅ PASS | Verified via API calls and health checks |
| 3 | Health endpoint `/api/health` returns OK | ✅ PASS | Returns `{status: "ok", services: {database: true, redis: true}}` |
| 4 | Frontend accessible at http://localhost:3000 | ✅ PASS | Nginx serves React SPA |
| 5 | Backend API at http://localhost:3001 | ✅ PASS | All routes responding |
| 6 | ML service at http://localhost:5001 | ✅ PASS | `/api/health` returns OK |

## 2. Authentication

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7 | POST `/auth/register` creates new user | ✅ PASS | Returns JWT tokens |
| 8 | POST `/auth/login` returns accessToken + refreshToken | ✅ PASS | bcrypt password verification |
| 9 | POST `/auth/refresh` rotates refresh token | ✅ PASS | Old token invalidated, new token issued |
| 10 | Protected routes reject unauthenticated requests | ✅ PASS | Returns 401 Unauthorized |
| 11 | Frontend login flow works end-to-end | ✅ PASS | Login → Dashboard with session persistence |

## 3. Task Management

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 12 | POST `/tasks` creates task with PENDING status | ✅ PASS | All task fields persisted |
| 13 | GET `/tasks` returns paginated task list | ✅ PASS | Supports filtering, sorting, pagination |
| 14 | POST `/tasks/bulk` creates up to 100 tasks | ✅ PASS | Bulk creation with validation |
| 15 | PATCH/PUT `/tasks/:id` updates task | ✅ PASS | Status transitions validated |
| 16 | DELETE `/tasks/:id` soft-deletes task | ✅ PASS | Sets deletedAt timestamp |
| 17 | Task status transitions (PENDING → RUNNING → COMPLETED/FAILED) | ✅ PASS | Enforced in service layer |

## 4. Resource Management

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 18 | POST `/resources` creates resource | ✅ PASS | Name, capacity, status required |
| 19 | GET `/resources` returns all resources with counts | ✅ PASS | Includes task assignment counts |
| 20 | PATCH `/resources/:id` updates load/status | ✅ PASS | |
| 21 | Resource statuses: AVAILABLE, BUSY, OFFLINE | ✅ PASS | Frontend displays visual counters |
| 22 | Frontend Resource page shows 10 fog nodes | ✅ PASS | F1-F10 with varying capacities |

## 5. Scheduling Algorithms

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 23 | HH (Hybrid Heuristic) algorithm runs correctly | ✅ PASS | IPSO → pheromone init → IACO pipeline |
| 24 | IPSO (Improved PSO) standalone scheduling | ✅ PASS | Discrete particle swarm optimization |
| 25 | IACO (Improved ACO) standalone scheduling | ✅ PASS | Ant colony with pheromone updates |
| 26 | RR (Round-Robin) baseline scheduler | ✅ PASS | Simple cyclic assignment |
| 27 | FCFS (First Come First Served) baseline | ✅ PASS | Sequential assignment |
| 28 | Min-Min heuristic scheduler | ✅ PASS | Greedy minimum completion time |
| 29 | POST `/fog/compare` compares all 6 algorithms | ✅ PASS | Returns delay, energy, reliability per algo |
| 30 | POST `/fog/schedule` runs single algorithm by name | ✅ PASS | Supports HH/IPSO/IACO/FCFS/RR/Min-Min |
| 31 | Scheduling assignments use DB transactions | ✅ PASS | Atomic with SELECT FOR UPDATE |
| 32 | ML predicted execution time used in Tij calculation | ✅ PASS | Fallback to TEij = Di×θi/Cj when ML unavailable |

## 6. ML Service Integration

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 33 | POST `/api/predict` returns predicted_time + confidence + model_version | ✅ PASS | XGBoost/RandomForest/GradientBoosting |
| 34 | POST `/api/predict/batch` handles up to 1000 predictions | ✅ PASS | Batch processing |
| 35 | POST `/api/train` triggers model training | ✅ PASS | API key protected |
| 36 | POST `/api/model/switch` switches model type | ✅ PASS | RF/XGBoost/GB hot-swappable |
| 37 | GET `/api/model/info` returns model metadata | ✅ PASS | Version, features, type |
| 38 | Backend fallback when ML service is down | ✅ PASS | Uses formula-based estimation |
| 39 | Prometheus metrics at `/metrics` | ✅ PASS | Both backend and ML service |

## 7. Experimental Evaluation (Paper Reproduction)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 40 | Energy experiment (Figure 6): HH lowest energy | ✅ PASS | Across task counts 50–300 |
| 41 | Energy experiment: RR highest energy | ✅ PASS | Consistent across all scenarios |
| 42 | Reliability vs task count (Figure 7): decreases as tasks increase | ✅ PASS | Monotonic trend |
| 43 | Reliability vs task count: HH highest reliability | ✅ PASS | Outperforms IPSO, IACO, RR |
| 44 | Reliability vs tolerance (Figure 8): increases with tolerance | ✅ PASS | 10s → 100s range |
| 45 | Reliability vs tolerance: HH highest across all values | ✅ PASS | |
| 46 | Experiments reproducible with fixed seed | ✅ PASS | `--seed 42` flag supported |
| 47 | All results exported to CSV + JSON | ✅ PASS | Under `results/` directory |
| 48 | CLI: `npm run experiments:all` generates all figures | ✅ PASS | Outputs to `results/` |
| 49 | API: `POST /experiments/run` generates experiments | ✅ PASS | Returns data + validation |
| 50 | Frontend Experiments page with interactive charts | ✅ PASS | Recharts visualizations |

## 8. Frontend Features

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 51 | Login page with JWT authentication | ✅ PASS | Secure auth flow |
| 52 | Resource management: add, list, status counters | ✅ PASS | Total/Available/Busy/Offline/Avg Load |
| 53 | Task creation form with all fields | ✅ PASS | Type, size, priority, due date |
| 54 | Fog Computing dashboard with algorithm comparison | ✅ PASS | Interactive charts |
| 55 | Experiments page with Figure 5–8 charts | ✅ PASS | LineCharts + BarCharts |
| 56 | Real-time WebSocket updates | ✅ PASS | Socket.IO with Redis adapter |
| 57 | CSV export of schedules | ✅ PASS | Via reports API |
| 58 | PDF report generation | ✅ PASS | PDFKit-based reports |
| 59 | Dark mode support | ✅ PASS | Theme toggle in header |
| 60 | Keyboard shortcuts | ✅ PASS | `?` for help modal |

## 9. WebSocket & Real-time

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 61 | WebSocket broadcasts scheduling events | ✅ PASS | `schedule:completed` channel |
| 62 | Resource update events | ✅ PASS | `resource:updated` channel |
| 63 | Task update events | ✅ PASS | `task:updated` channel |
| 64 | Frontend receives and updates UI | ✅ PASS | Socket.IO client integration |

## 10. Testing & CI

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 65 | Backend unit tests pass (Jest) | ✅ PASS | 103+ tests |
| 66 | Frontend unit tests pass (Vitest) | ✅ PASS | 48+ tests |
| 67 | ML service tests pass (pytest) | ✅ PASS | Prediction and training tests |
| 68 | Integration tests for scheduling workflow | ✅ PASS | End-to-end scheduling flow |
| 69 | GitHub Actions CI workflow exists | ✅ PASS | `.github/workflows/ci.yml` |

## 11. Performance Validation

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 70 | HH runtime for 200 tasks, 10 nodes < 10s | ✅ PASS | Typically 3–7s |
| 71 | Scheduler logs runtime, CPU, memory usage | ✅ PASS | Via `simulation_log.json` |
| 72 | Benchmark script generates Figures 5–8 CSVs | ✅ PASS | `npm run benchmark` |

## 12. Documentation

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 73 | README with build/run instructions | ✅ PASS | Docker + local dev instructions |
| 74 | API documentation (Swagger/OpenAPI) | ✅ PASS | `/api/docs` endpoint |
| 75 | Architecture documentation | ✅ PASS | Algorithm descriptions, flow diagrams |
| 76 | Experiment reproduction instructions | ✅ PASS | CLI + API + Frontend methods |

## 13. Security & Code Quality

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 77 | bcrypt password hashing | ✅ PASS | Cost factor 10 |
| 78 | JWT with access + refresh token rotation | ✅ PASS | Configurable expiry |
| 79 | Rate limiting on API routes | ✅ PASS | express-rate-limit |
| 80 | Input validation (Zod) | ✅ PASS | All routes validated |
| 81 | Helmet security headers | ✅ PASS | CSP, HSTS, etc. |
| 82 | CSRF protection | ✅ PASS | Token-based CSRF |

---

## Summary

| Category | Passed | Total |
|----------|--------|-------|
| Infrastructure | 6 | 6 |
| Authentication | 5 | 5 |
| Task Management | 6 | 6 |
| Resource Management | 5 | 5 |
| Scheduling Algorithms | 10 | 10 |
| ML Integration | 7 | 7 |
| Experiments | 11 | 11 |
| Frontend | 10 | 10 |
| WebSocket | 4 | 4 |
| Testing | 5 | 5 |
| Performance | 3 | 3 |
| Documentation | 4 | 4 |
| Security | 6 | 6 |
| **TOTAL** | **82** | **82** |

**All 82 checks passed.** ✅
