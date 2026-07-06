# Copilot Instructions for ML-Task-Scheduler

Production full-stack fog-computing scheduler with ML-assisted predictions, Redis-backed locking/caching, and multiple scheduling heuristics.

## Architecture
- `frontend/`: React 18 + Vite + TypeScript + Zustand + TanStack Query; main UI pages live in `frontend/src/pages/`.
- `backend/`: Express + Prisma + Socket.IO + BullMQ; main entry is `backend/src/index.ts`.
- `ml-service/`: Flask + scikit-learn; app factory and routes are in `ml-service/app_factory.py` and `ml-service/routes/`.
- Data plane: PostgreSQL via Prisma, Redis for cache/locks, BullMQ for async jobs.

## Critical flow
- Scheduling starts at `POST /api/v1/schedule` and is orchestrated by `backend/src/services/scheduler/scheduler.service.ts`.
- `SchedulerService.schedule()` wraps the whole run in `withSchedulerLock()` to prevent concurrent scheduling.
- Pending tasks are fetched through `schedulerRepository.findPending(100)`; available resources come from `schedulerRepository.findAvailableResources()`.
- Prediction batches go through `backend/src/services/ml.service.ts` to the Flask service; `ml-service/model.py` supports hot reload by file mtime.
- Results update `Task`, `Resource`, and `ScheduleHistory`, then `schedule:completed` is emitted over Socket.IO.

## Backend conventions
- API routes are versioned under `/api/v1/*`; `backend/src/index.ts` still keeps `/api/auth` as a compatibility alias.
- Authentication uses httpOnly access/refresh cookies plus a double-submit CSRF cookie/header pair (`csrf-token` / `X-CSRF-Token`).
- Middleware order matters in `backend/src/index.ts`: Helmet → CORS → JSON/urlencoded parsers → request ID/context → CSRF → logging → metrics → rate limiting → routes.
- Use `logger.*` instead of `console.log()` in backend code; `errorHandler` and `errorRecovery.service.ts` centralize failures.
- Request validation lives in `backend/src/validators/` and `backend/src/middleware/validate.middleware.ts`; keep route handlers thin and validate before service calls.
- Prisma schema rules are in `backend/prisma/schema.prisma`: task status is a strict state machine, and `userId` is the multi-tenant partition key.
- Prisma is the source of truth for the data model; use `npm run db:generate`, `npm run db:push`, and `npm run db:seed` from `backend/` instead of migrations.
- `backend/prisma/seed.ts` clears dependent tables first, then seeds demo users, resources, and tasks for local/dev workflows.

## Frontend conventions
- `frontend/src/lib/api.ts` owns Axios, CSRF header injection, and automatic refresh-token retry logic with a cooldown for repeated 401s.
- `frontend/src/lib/socket.ts` connects to `VITE_WS_URL` or `http://localhost:3001` and is used for live updates instead of manual refresh.
- Prefer React Query for server state and Zustand for UI state; `frontend/src/store/` holds shared client state.
- The app expects `/api/v1/*` backend routes in dev and proxy-based same-origin `/api` in production.

## ML service conventions
- Flask blueprints are registered in `ml-service/app_factory.py`; health, predict, train, and admin routes live in `ml-service/routes/`.
- Prediction endpoints accept task size/type/priority/resource-load features and return `predictedTime` plus `confidence`.
- Keep ML changes aligned with `ml-service/model.py`, `train.py`, and `research.py`; tests live under `ml-service/tests/`.

## Dev workflows
- Backend: `cd backend && npm run dev|build|test|db:generate|db:push|db:seed|benchmark|experiments`.
- Frontend: `cd frontend && npm run dev|build|test|lint|test:e2e`.
- ML service: `cd ml-service && pip install -r requirements.txt && python app.py`.
- Docker dev is available via `docker-compose up -d`.

## Before changing code
- Preserve the task lifecycle (`PENDING → SCHEDULED → RUNNING → COMPLETED/FAILED`) and resource layer hierarchy (`TERMINAL → FOG → CLOUD`).
- Keep multi-tenant queries filtered by `userId` where applicable.
- Respect Redis lock/caching behavior in scheduler and ML integration code.
- Check the nearest tests in `backend/src/__tests__/`, `frontend/src/**/__tests__/`, or `ml-service/tests/` when changing behavior.
