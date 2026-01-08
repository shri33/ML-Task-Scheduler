# Intelligent Task Allocation and Scheduling System
## ML-Assisted Optimization

A full-stack web application that demonstrates intelligent task scheduling with machine learning predictions.

**Team Byte_hogs** | BITS Pilani Online BSc CS Study Project

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   ML Service    │
│  React + Vite   │     │  Node + Express │     │  Python + Flask │
│    Port 3000    │     │    Port 3001    │     │    Port 5001    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   PostgreSQL    │
                        │    Port 5432    │
                        └─────────────────┘
```

## 📁 Project Structure

```
PROJECT/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── validators/     # Input validation
│   │   └── middleware/     # Error handling
│   └── prisma/             # Database schema
│
├── frontend/               # React + TypeScript UI
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Zustand state
│   │   ├── lib/            # API client
│   │   └── types/          # TypeScript types
│
├── ml-service/             # Python + Flask ML API
│   ├── app.py              # Flask server
│   ├── model.py            # ML model
│   └── models/             # Saved models
│
├── docs/                   # Documentation
│   ├── Phase1_Project_Proposal.md
│   ├── Phase2_SRS_Document.md
│   └── Phase3_Design_Submission.md
│
└── docker-compose.yml      # Container orchestration
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application at http://localhost:3000

### Option 2: Manual Setup

#### 1. Database (PostgreSQL)
```bash
# Using Docker
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=task_scheduler \
  postgres:15-alpine
```

#### 2. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed    # Add sample data
npm run dev
```

#### 3. ML Service
```bash
cd ml-service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```

#### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 API Endpoints

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

### Resources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | List resources |
| POST | `/api/resources` | Create resource |
| PUT | `/api/resources/:id` | Update resource |
| DELETE | `/api/resources/:id` | Delete resource |

### Scheduling
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedule` | Run scheduler |
| GET | `/api/schedule/history` | Get history |
| GET | `/api/schedule/comparison` | ML vs heuristic |

### ML Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict` | Predict execution time |
| GET | `/api/health` | Health check |

## 🤖 How ML Works

The system uses a **Random Forest Regressor** to predict task execution time:

**Input Features:**
- `taskSize`: 1 (Small), 2 (Medium), 3 (Large)
- `taskType`: 1 (CPU), 2 (IO), 3 (Mixed)
- `priority`: 1-5
- `resourceLoad`: 0-100%

**Output:**
- `predictedTime`: Estimated execution time in seconds
- `confidence`: Prediction confidence (0-1)

The scheduler uses these predictions to optimally assign tasks to resources, minimizing overall execution time.

## 📊 Features

- ✅ **Dashboard**: Real-time overview of tasks and resources
- ✅ **Task Management**: Create, update, delete tasks
- ✅ **Resource Monitoring**: Track resource utilization
- ✅ **ML Predictions**: Execution time predictions
- ✅ **Smart Scheduling**: Algorithm optimization with ML
- ✅ **Analytics**: Performance comparison charts
- ✅ **Real-time Updates**: WebSocket notifications

## 👥 Team

| Name | Role | Student ID |
|------|------|------------|
| Shri Srivastava | Lead / Backend | 2023ebcs593 |
| Ichha Dwivedi | UI/UX / Frontend | 2023ebcs125 |
| Aditi Singh | Database / ML | 2023ebcs498 |

## 📚 References

1. Wang, J., & Li, D. (2019). "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing." *Sensors*, 19(5), 1023.

---

*BITS Pilani Online | BSc Computer Science | Study Project 2025-26*
