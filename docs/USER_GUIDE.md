# ML Task Scheduler - User Guide
## How to Use the Software

---

## 🚀 Quick Start

### Accessing the Application

1. **Make sure Docker containers are running:**
   ```bash
   docker-compose up -d
   ```

2. **Open the application in your browser:**
   - **Frontend (Main UI):** http://localhost:3000
   - **Backend API:** http://localhost:3001
   - **ML Service:** http://localhost:5001

---

## 📱 Application Pages

### 1. Dashboard (Home Page)
**URL:** http://localhost:3000/

The Dashboard shows:
- **Total Tasks** - Number of tasks in the system
- **Pending Tasks** - Tasks waiting to be scheduled
- **Active Resources** - Available fog nodes/servers
- **ML Accuracy** - Prediction accuracy percentage
- **Recent Activity** - Latest task operations
- **Quick Stats** - Resource utilization overview

### 2. Tasks Page
**URL:** http://localhost:3000/tasks

**Features:**
- View all tasks (with filters: All, Pending, Scheduled, Running, Completed, Failed)
- Create new tasks
- Schedule tasks using ML-assisted algorithm
- Delete tasks
- Mark tasks as completed

**How to Create a Task:**
1. Click **"Create Task"** button
2. Fill in:
   - **Name:** Task identifier (e.g., "Data Processing Job")
   - **Type:** CPU, IO, or MIXED
   - **Size:** SMALL, MEDIUM, or LARGE
   - **Priority:** 1 (Low) to 5 (High)
3. Click **"Submit"**

**How to Schedule a Task:**
1. Find a task with "PENDING" status
2. Click the **Play icon (▶)** next to it
3. The ML service predicts execution time
4. Task is assigned to the best resource

### 3. Resources Page
**URL:** http://localhost:3000/resources

**Features:**
- View all fog nodes/servers
- See current load percentage
- Monitor resource status (Available, Busy, Offline)
- Add new resources
- Update resource capacity

**How to Add a Resource:**
1. Click **"Add Resource"** button
2. Fill in:
   - **Name:** Resource identifier (e.g., "Fog-Node-1")
   - **Capacity:** Maximum concurrent tasks (e.g., 100)
3. Click **"Create"**

### 4. Analytics Page
**URL:** http://localhost:3000/analytics

**Features:**
- **Performance Timeline** - Tasks scheduled over time
- **ML Comparison** - With ML vs Without ML performance
- **Execution Time Analysis** - Average times and trends
- **ML Accuracy Metrics** - Prediction accuracy over time

### 5. Fog Computing Page
**URL:** http://localhost:3000/fog-computing

**Features:**
- View the HH Algorithm (IPSO + IACO) implementation
- See scheduling decisions with explanations
- Compare algorithms
- Visualize resource allocation

---

## 📥 PDF Reports - How to Download

### Available Reports

| Report | Description | Download URL |
|--------|-------------|--------------|
| **Task Summary** | All tasks with status breakdown | http://localhost:3001/api/reports/pdf/tasks |
| **ML Performance** | ML prediction accuracy analysis | http://localhost:3001/api/reports/pdf/performance |
| **Resource Utilization** | Resource load and efficiency | http://localhost:3001/api/reports/pdf/resources |

### How to Download PDF Reports

#### Method 1: Direct Browser Download
1. Open any of these URLs in your browser:
   - Task Report: http://localhost:3001/api/reports/pdf/tasks
   - Performance Report: http://localhost:3001/api/reports/pdf/performance
   - Resources Report: http://localhost:3001/api/reports/pdf/resources

2. The PDF will automatically download

#### Method 2: Using cURL (Command Line)
```bash
# Download Task Summary Report
curl -o task-report.pdf http://localhost:3001/api/reports/pdf/tasks

# Download ML Performance Report
curl -o ml-performance-report.pdf http://localhost:3001/api/reports/pdf/performance

# Download Resource Utilization Report
curl -o resource-report.pdf http://localhost:3001/api/reports/pdf/resources
```

#### Method 3: Using PowerShell
```powershell
# Download Task Summary Report
Invoke-WebRequest -Uri "http://localhost:3001/api/reports/pdf/tasks" -OutFile "task-report.pdf"

# Download ML Performance Report
Invoke-WebRequest -Uri "http://localhost:3001/api/reports/pdf/performance" -OutFile "ml-performance-report.pdf"

# Download Resource Utilization Report
Invoke-WebRequest -Uri "http://localhost:3001/api/reports/pdf/resources" -OutFile "resource-report.pdf"
```

### What's in Each Report

#### Task Summary Report (`task-summary-report.pdf`)
- Total task count by status
- Recent 20 tasks with details
- Task type distribution
- Priority breakdown
- Resource assignments

#### ML Performance Report (`ml-performance-report.pdf`)
- Prediction accuracy metrics
- Actual vs Predicted comparison
- Model confidence scores
- Error analysis
- Performance trends

#### Resource Utilization Report (`resource-utilization-report.pdf`)
- All resources with current load
- Utilization percentage
- Task assignments per resource
- Capacity analysis

---

## 🔌 API Endpoints (For Developers)

### Tasks API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create new task |
| GET | `/api/tasks/:id` | Get task by ID |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/complete` | Mark task complete |

### Resources API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | List all resources |
| POST | `/api/resources` | Create new resource |
| PUT | `/api/resources/:id` | Update resource |
| DELETE | `/api/resources/:id` | Delete resource |

### Scheduling API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedule` | Schedule tasks (ML-assisted) |
| GET | `/api/schedule/history` | Get scheduling history |
| GET | `/api/schedule/comparison` | ML vs non-ML comparison |

### Metrics API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics` | System metrics |
| GET | `/api/metrics/timeline` | Metrics over time |

### Reports API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | List available reports |
| GET | `/api/reports/pdf/tasks` | Download task PDF |
| GET | `/api/reports/pdf/performance` | Download ML PDF |
| GET | `/api/reports/pdf/resources` | Download resource PDF |

---

## 🧪 Testing the System

### Quick Test Flow

1. **Create Resources (Fog Nodes)**
   ```
   Go to: http://localhost:3000/resources
   Add 3 resources:
   - Fog-Node-1 (capacity: 100)
   - Fog-Node-2 (capacity: 80)
   - Fog-Node-3 (capacity: 60)
   ```

2. **Create Tasks**
   ```
   Go to: http://localhost:3000/tasks
   Add 5 tasks:
   - Data Processing (CPU, LARGE, Priority 5)
   - File Upload (IO, SMALL, Priority 2)
   - Report Generation (MIXED, MEDIUM, Priority 3)
   - API Request (CPU, SMALL, Priority 4)
   - Backup Job (IO, LARGE, Priority 1)
   ```

3. **Schedule Tasks**
   ```
   Click the Play button (▶) on each task
   Watch ML predict execution time
   See task assigned to best resource
   ```

4. **View Analytics**
   ```
   Go to: http://localhost:3000/analytics
   See charts showing:
   - Task distribution
   - ML accuracy
   - Performance comparison
   ```

5. **Download Report**
   ```
   Open: http://localhost:3001/api/reports/pdf/tasks
   PDF downloads automatically
   ```

---

## 🛠 Troubleshooting

### Common Issues

**Problem: Cannot access http://localhost:3000**
```bash
# Check if containers are running
docker ps

# Restart containers
docker-compose restart
```

**Problem: PDF download not working**
```bash
# Check backend logs
docker logs task-scheduler-backend

# Verify API is running
curl http://localhost:3001/api/health
```

**Problem: ML predictions not working**
```bash
# Check ML service logs
docker logs task-scheduler-ml

# Test ML service directly
curl http://localhost:5001/health
```

---

## 📊 Understanding the ML Predictions

When you schedule a task, the system:

1. **Extracts Features:**
   - Task Type (CPU=1, IO=2, MIXED=3)
   - Task Size (SMALL=1, MEDIUM=2, LARGE=3)
   - Priority (1-5)
   - Resource Load (0-100%)

2. **ML Model Predicts:**
   - Execution Time (seconds)
   - Confidence Score (0-100%)

3. **Scheduler Calculates Score:**
   ```
   Score = 0.4 × (100 - load) / 100 + 0.3 × (1 - predictedTime / 20) + 0.3 × (priority / 5)
   ```

4. **Best Resource Selected:**
   - Highest score wins
   - Task assigned to that resource

5. **Result Displayed:**
   - Shows predicted time
   - Shows why that resource was chosen
   - Logs to schedule_history table

---

## 🎯 Key Features Summary

| Feature | How It Works |
|---------|--------------|
| **Task Creation** | Form → API → Database → UI Update |
| **ML Scheduling** | Task → ML Predict → Score → Assign |
| **Real-time Updates** | WebSocket pushes changes to UI |
| **PDF Reports** | PDFKit generates → Download as file |
| **Analytics** | Recharts + Chart.js visualizations |
| **HH Algorithm** | IPSO + IACO hybrid optimization |

---

*Created for ML Task Scheduler | Team Byte_hogs | 2026*
