# Developer Onboarding Guide

Welcome to the ML Task Scheduler project! This guide will help you get started with development.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│                    Vite + TypeScript + Tailwind                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP / WebSocket
┌─────────────────────────────▼───────────────────────────────────┐
│                      API Server (Express)                        │
│                    Node.js + TypeScript                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Routes    │ │  Services   │ │ Middleware  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└────────┬────────────────┬────────────────┬──────────────────────┘
         │                │                │
   ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐
   │ PostgreSQL │   │    Redis    │  │  BullMQ     │
   │  (Prisma)  │   │   (Cache)   │  │  (Queue)    │
   └───────────┘   └─────────────┘  └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │  ML Service │
                                    │  (Python)   │
                                    └─────────────┘
```

### Key Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + Vite | User interface |
| API | Express + TypeScript | REST API + WebSocket |
| Database | PostgreSQL + Prisma | Data persistence |
| Cache | Redis | Caching, sessions, pub/sub |
| Queue | BullMQ | Async job processing |
| ML | Python + scikit-learn | Task predictions |

---

## Getting Started

### Prerequisites

```bash
# Required versions
node --version  # v20+
npm --version   # v10+
docker --version # v24+
docker-compose --version # v2.20+
```

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-org/ml-task-scheduler.git
cd ml-task-scheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 2. Environment Configuration

```bash
# Copy environment templates
cp backend/.env.example backend/.env

# Edit backend/.env with your settings
# Minimum required:
# - DATABASE_URL
# - JWT_SECRET (any 32+ char string for dev)
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d db redis

# Wait for services to be ready
docker-compose exec db pg_isready
docker-compose exec redis redis-cli ping
```

### 4. Setup Database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with test data (optional)
npm run db:seed
```

### 5. Start Development Servers

Terminal 1 - Backend:
```bash
cd backend
npm run dev
# API running at http://localhost:3001
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# UI running at http://localhost:3000
```

Terminal 3 - ML Service (optional):
```bash
cd ml-service
pip install -r requirements.txt
python app.py
# ML service at http://localhost:5001
```

### 6. Verify Setup

```bash
# API health
curl http://localhost:3001/api/health

# Frontend
open http://localhost:3000

# API docs
open http://localhost:3001/api/docs
```

---

## Project Structure

```
ml-task-scheduler/
├── backend/                  # Express API server
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── lib/             # Core utilities
│   │   │   ├── env.ts       # Environment validation
│   │   │   ├── logger.ts    # Logging
│   │   │   ├── metrics.ts   # Prometheus metrics
│   │   │   ├── prisma.ts    # Database client
│   │   │   ├── redis.ts     # Redis client
│   │   │   └── swagger.ts   # API documentation
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── queues/          # BullMQ setup
│   │   ├── workers/         # Background job processors
│   │   └── validators/      # Request validation
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Seed data
│   └── package.json
│
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── App.tsx          # Root component
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   ├── store/           # State management
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── ml-service/              # Python ML service
│   ├── app.py               # Flask server
│   ├── model.py             # ML model logic
│   └── requirements.txt
│
├── infra/                   # Infrastructure configs
│   ├── nginx/               # Reverse proxy
│   ├── prometheus/          # Monitoring
│   └── grafana/             # Dashboards
│
├── docs/                    # Documentation
│   ├── DEPLOYMENT.md        # Production deployment
│   ├── DEVELOPER_GUIDE.md   # This file
│   └── ...
│
├── docker-compose.yml       # Development setup
└── docker-compose.production.yml  # Production setup
```

---

## Development Workflow

### Branch Strategy

```
main (production)
  └── develop (integration)
       ├── feature/task-123-add-feature
       ├── fix/task-456-bug-fix
       └── refactor/improve-xyz
```

### Commit Messages

Follow conventional commits:

```
feat: add task scheduling endpoint
fix: resolve memory leak in cache service
docs: update API documentation
refactor: simplify prediction logic
test: add unit tests for scheduler
chore: update dependencies
```

### Pull Request Process

1. Create branch from `develop`
2. Make changes with tests
3. Run `npm run lint` and `npm test`
4. Create PR with description
5. Wait for CI to pass
6. Get code review approval
7. Squash and merge

---

## Coding Standards

### TypeScript

```typescript
// ✅ Good: Explicit types, clear naming
interface TaskCreateInput {
  name: string;
  type: TaskType;
  priority: number;
}

async function createTask(input: TaskCreateInput): Promise<Task> {
  // Implementation
}

// ❌ Bad: Any types, unclear naming
async function create(data: any) {
  // ...
}
```

### Error Handling

```typescript
// ✅ Good: Structured error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)));
  throw new AppError('OPERATION_FAILED', 'Unable to complete operation', 500);
}

// ❌ Bad: Silent failures
try {
  await riskyOperation();
} catch (e) {
  console.log(e);  // Never use console.log
}
```

### API Routes

```typescript
// ✅ Good: Validated, documented, error-handled
/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create a new task
 */
router.post('/tasks', 
  validate(taskCreateSchema),
  authenticate,
  async (req, res, next) => {
    try {
      const task = await taskService.create(req.body);
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }
);
```

### Environment Variables

```typescript
// ✅ Good: Use validated env
import { getEnv } from '../lib/env';

const port = getEnv().PORT;

// ❌ Bad: Direct process.env access
const port = process.env.PORT;  // No validation, no type safety
```

---

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Frontend tests
cd frontend
npm test
```

### Test Structure

```typescript
// backend/src/services/__tests__/task.service.test.ts

describe('TaskService', () => {
  describe('create', () => {
    it('should create task with valid input', async () => {
      const input = { name: 'Test Task', type: 'CPU', priority: 3 };
      const task = await taskService.create(input);
      
      expect(task).toMatchObject(input);
      expect(task.id).toBeDefined();
    });

    it('should throw on invalid priority', async () => {
      const input = { name: 'Test', type: 'CPU', priority: 10 };
      
      await expect(taskService.create(input))
        .rejects.toThrow('Priority must be between 1 and 5');
    });
  });
});
```

### Test Database

```bash
# Use separate test database
DATABASE_URL=postgresql://test:test@localhost:5432/test_db npm test
```

---

## Common Tasks

### Add New API Endpoint

1. Create route file or add to existing:
   ```typescript
   // src/routes/feature.routes.ts
   router.get('/feature', controller.getFeature);
   ```

2. Add Swagger documentation:
   ```typescript
   /**
    * @swagger
    * /api/v1/feature:
    *   get:
    *     summary: Get feature
    */
   ```

3. Register route in `index.ts`:
   ```typescript
   app.use('/api/v1/feature', featureRoutes);
   ```

### Add Database Migration

```bash
cd backend

# Create migration
npx prisma migrate dev --name add_new_field

# Apply in production
npx prisma migrate deploy
```

### Add Background Job

1. Define job type in `queues/types.ts`
2. Create producer function in `queues/`
3. Create worker in `workers/`
4. Register worker startup

### Update ML Model

1. Update `ml-service/model.py`
2. Increment model version
3. Test with `python -m pytest`
4. Update fallback logic in `ml.service.ts`

---

## Troubleshooting

### Database Issues

```bash
# Reset database
npx prisma migrate reset

# View database
npx prisma studio

# Check connection
npx prisma db pull
```

### Redis Issues

```bash
# Check Redis
docker-compose exec redis redis-cli ping

# Clear cache
docker-compose exec redis redis-cli FLUSHALL
```

### Port Conflicts

```bash
# Find process using port
netstat -ano | findstr :3001  # Windows
lsof -i :3001                  # Mac/Linux

# Kill process
taskkill /PID <pid> /F         # Windows
kill -9 <pid>                   # Mac/Linux
```

### Dependencies Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

### TypeScript Errors

```bash
# Regenerate types
cd backend
npx prisma generate  # Regenerate Prisma types
npm run build        # Full type check
```

---

## Getting Help

1. **Check documentation** in `/docs`
2. **Search existing issues** in repository
3. **Ask in team channel** (Slack/Discord)
4. **Create new issue** with:
   - Clear description
   - Steps to reproduce
   - Environment details
   - Error messages/logs

---

## Quick Reference

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run linter |
| `npm test` | Run tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |

### URLs (Development)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs | http://localhost:3001/api/docs |
| API Health | http://localhost:3001/api/health |
| ML Service | http://localhost:5001 |

### Key Files

| File | Purpose |
|------|---------|
| `backend/.env` | Environment variables |
| `backend/prisma/schema.prisma` | Database schema |
| `backend/src/index.ts` | API entry point |
| `frontend/src/App.tsx` | React root |

---

Happy coding! 🚀
