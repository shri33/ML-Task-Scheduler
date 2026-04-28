# AI Task Scheduling Platform — Architecture Documentation

## System Overview

A distributed, ML-enhanced task scheduling platform for fog/cloud computing environments. The system optimizes task-to-resource assignment using 9 scheduling algorithms including bio-inspired metaheuristics (IPSO, IACO) and machine learning predictions.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        FE["React SPA<br/>(Vite + TypeScript)"]
        WS["Socket.IO Client"]
    end

    subgraph Gateway["API Gateway"]
        NG["Nginx<br/>(Reverse Proxy)"]
    end

    subgraph Backend["Application Layer"]
        API["Express.js API<br/>(Node.js)"]
        AUTH["Auth Middleware<br/>(JWT + Cookies)"]
        SCHED["Scheduling Engine<br/>(9 Algorithms)"]
        WORK["BullMQ Workers<br/>(Background Jobs)"]
    end

    subgraph ML["ML Layer"]
        FLASK["Flask API<br/>(Python)"]
        MODEL["Prediction Models<br/>(XGBoost / RF / GB)"]
        NVIDIA["NVIDIA NIM<br/>(AI Chat)"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL 15<br/>(Primary Store)"]
        REDIS["Redis 7<br/>(Cache + Queues)"]
    end

    subgraph Observability["Observability"]
        PROM["Prometheus<br/>(Metrics)"]
        GRAF["Grafana<br/>(Dashboards)"]
    end

    FE --> NG
    WS -.->|WebSocket| API
    NG --> API
    API --> AUTH
    API --> SCHED
    API --> WORK
    SCHED --> FLASK
    API --> FLASK
    FLASK --> MODEL
    FLASK --> NVIDIA
    API --> PG
    API --> REDIS
    WORK --> REDIS
    WORK --> PG
    PROM --> API
    PROM --> FLASK
    GRAF --> PROM
```

---

## Service Topology

| Service | Port | Technology | Purpose |
|---|---|---|---|
| Frontend | 3000 | React + Vite + Tailwind | SPA dashboard |
| Backend | 3001 | Node.js + Express + Prisma | REST API + WebSocket |
| ML Service | 5001 | Python + Flask + scikit-learn | Prediction + training |
| PostgreSQL | 5432 | PostgreSQL 15 | Primary data store |
| Redis | 6379 | Redis 7 + BullMQ | Caching + job queues |
| Prometheus | 9090 | Prometheus | Metrics collection |
| Grafana | 3002 | Grafana | Metrics visualization |
| Nginx | 80 | Nginx | Reverse proxy + static |

---

## Scheduling Lifecycle

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Backend API
    participant ML as ML Service
    participant SCHED as Scheduler
    participant DB as PostgreSQL
    participant Q as BullMQ
    participant WS as Socket.IO

    U->>FE: Click "Schedule Tasks"
    FE->>API: POST /api/schedule
    API->>DB: Fetch PENDING tasks
    API->>DB: Fetch AVAILABLE resources
    API->>ML: POST /api/predict/batch
    ML-->>API: predictions + confidence
    API->>SCHED: Run algorithm(tasks, resources, predictions)
    SCHED-->>API: assignments[]
    API->>DB: Update task status → SCHEDULED
    API->>DB: Update resource loads
    API->>DB: Create ScheduleHistory records
    API->>WS: Emit schedule:completed
    WS-->>FE: Real-time update
    API-->>FE: 200 OK {results, algorithm}
    FE->>U: Show scheduling results
```

---

## ML Prediction Pipeline

```mermaid
flowchart LR
    subgraph Input["Feature Engineering"]
        TS["Task Size<br/>(1-3)"]
        TT["Task Type<br/>(CPU/IO/MIXED)"]
        PR["Priority<br/>(1-5)"]
        RL["Resource Load<br/>(0-100%)"]
        SO["Startup Overhead<br/>(seconds)"]
    end

    subgraph Guards["Input Guards"]
        CLIP["Feature Clipping"]
    end

    subgraph Model["ML Model"]
        RF["Random Forest"]
        XGB["XGBoost"]
        GB["Gradient Boosting"]
    end

    subgraph Output["Output Guards"]
        MONO["Monotonicity<br/>(LARGE ≥ SMALL)"]
        FEAS["Feasibility<br/>(≥ min time)"]
        CONF["Confidence<br/>(0.1 - 1.0)"]
    end

    TS & TT & PR & RL & SO --> CLIP
    CLIP --> RF & XGB & GB
    RF & XGB & GB --> MONO
    MONO --> FEAS
    FEAS --> CONF
    CONF --> RESULT["(predicted_time, confidence)"]
```

---

## Queue Topology

```mermaid
flowchart TD
    subgraph Producers["Job Producers"]
        TASK_CREATE["Task Created"]
        SCHEDULE_REQ["Schedule Request"]
        TASK_COMPLETE["Task Completed"]
    end

    subgraph Queues["BullMQ Queues"]
        SQ["scheduling-queue<br/>(priority-based)"]
        NQ["notification-queue"]
    end

    subgraph Workers["Workers"]
        SW["Scheduling Worker<br/>(concurrency: 3)"]
        NW["Notification Worker<br/>(concurrency: 5)"]
    end

    subgraph DLQ["Dead Letter Queues"]
        SDLQ["scheduling-dlq"]
        NDLQ["notification-dlq"]
    end

    TASK_CREATE --> SQ
    SCHEDULE_REQ --> SQ
    TASK_COMPLETE --> NQ

    SQ --> SW
    NQ --> NW

    SW -->|failed 3x| SDLQ
    NW -->|failed 3x| NDLQ
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Backend
    participant DB as Database

    Note over C,DB: Login Flow
    C->>API: POST /auth/login {email, password}
    API->>DB: Find user by email
    API->>API: bcrypt.compare(password, hash)
    API->>DB: Store refresh token
    API-->>C: Set httpOnly cookies + CSRF token
    API-->>C: 200 {user, accessToken}

    Note over C,DB: Authenticated Request
    C->>API: GET /api/tasks (Cookie: access_token)
    API->>API: Verify JWT
    API->>DB: Query tasks
    API-->>C: 200 {tasks}

    Note over C,DB: Token Refresh
    C->>API: POST /auth/refresh (Cookie: refresh_token)
    API->>DB: Verify + rotate refresh token (transaction)
    API-->>C: New cookies + new accessToken
```

---

## Scheduling Algorithms

| Algorithm | Type | Complexity | Best For |
|---|---|---|---|
| **ML Enhanced** | Hybrid | O(n·m) + ML latency | General use (default) |
| **Hybrid Heuristic (HH)** | Multi-objective | O(n·m·k) | Balanced delay + energy + reliability |
| **IPSO** | Particle Swarm | O(n·m·iterations) | Large search spaces |
| **IACO** | Ant Colony | O(n·m·iterations) | Path optimization |
| **Round Robin** | Deterministic | O(n) | Even distribution |
| **Min-Min** | Greedy | O(n·m) | Minimizing makespan |
| **FCFS** | Queue-based | O(n) | Order preservation |
| **EDF** | Priority | O(n log n) | Deadline-sensitive |
| **SJF** | Priority | O(n log n) | Throughput optimization |

---

## Data Model (Simplified)

```mermaid
erDiagram
    User ||--o{ Task : creates
    User ||--o{ RefreshToken : has
    User ||--o| NotificationPreference : configures
    User ||--o| UserBehaviorProfile : has
    Task }o--|| Resource : assigned_to
    Task ||--o{ ScheduleHistory : tracked_by
    Task ||--o{ Prediction : predicted_by
    Resource ||--o{ ScheduleHistory : hosts
    FogNode ||--o{ FogTaskAssignment : runs
    Device ||--o{ DeviceLog : logs
    Device ||--o{ DeviceMetric : measures
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| API Framework | Express.js | Mature ecosystem, Socket.IO integration, team familiarity |
| ORM | Prisma | Type-safe queries, migration system, middleware hooks |
| Auth Strategy | JWT + httpOnly cookies | Dual-layer: header for SPAs, cookies for CSRF safety |
| Queue System | BullMQ | Redis-backed, priority queues, DLQ, job deduplication |
| ML Framework | scikit-learn + XGBoost | Low-latency inference, simple deployment, good for tabular |
| Real-time | Socket.IO | Fallback transport, room-based scoping, reconnection |
| CSS | Tailwind CSS | Utility-first, consistent design system, small bundle |
| Validation | Zod | Runtime type safety, composable schemas, good TS integration |

---

## Scaling Strategy

### Phase 1: Vertical (Current)
- Single instance of each service
- Docker Compose orchestration
- PostgreSQL + Redis on same host

### Phase 2: Horizontal (50-500 users)
- Socket.IO Redis adapter (already configured)
- Multiple backend instances behind Nginx
- Read replicas for PostgreSQL
- Redis Sentinel for HA

### Phase 3: Cloud-Native (500+ users)
- Kubernetes with HPA
- Managed PostgreSQL (RDS/Cloud SQL)
- Redis Cluster
- CDN for static assets
- ML service autoscaling on GPU nodes

---

## Operational Runbook

### Health Checks
```
Backend:  GET /api/health
ML:       GET /api/health
Redis:    redis-cli ping
Postgres: pg_isready
```

### Key Metrics
- `http_request_duration_seconds` — API latency (p50, p95, p99)
- `ml_service_predictions_total` — Prediction throughput
- `bullmq_jobs_completed` — Queue processing rate
- `pg_connections_active` — Database connection pool

### Failure Recovery
| Failure | Impact | Recovery |
|---|---|---|
| ML Service down | Scheduler falls back to heuristics | Auto-detected via health check |
| Redis down | Queues pause, cache miss | BullMQ auto-reconnects, lock fails-closed |
| DB down | All writes fail | Prisma reconnects, auth returns 503 |
| Backend crash | Frontend shows error states | Docker restart policy: unless-stopped |

