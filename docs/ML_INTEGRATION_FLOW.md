# ML Integration Flow Diagram
## Intelligent Task Allocation and Scheduling System

---

## Overview

This document provides a detailed visualization of how Machine Learning integrates with the core scheduling system. The ML component acts as a **prediction assistant** to the scheduler, not a replacement.

---

## 1. High-Level ML Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ML INTEGRATION FLOW DIAGRAM                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    USER     │
                              │  (Browser)  │
                              └──────┬──────┘
                                     │
                                     │ 1. Create Task
                                     ▼
                              ┌─────────────┐
                              │   FRONTEND  │
                              │   (React)   │
                              └──────┬──────┘
                                     │
                                     │ 2. POST /api/tasks
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │   3. TaskService.create()                                            │ │
│  │         │                                                            │ │
│  │         ▼                                                            │ │
│  │   ┌─────────────┐     4. Request      ┌─────────────────────────┐   │ │
│  │   │  SCHEDULER  │ ─────Prediction────►│  ML INTEGRATION SERVICE │   │ │
│  │   │   SERVICE   │                     │                         │   │ │
│  │   │             │◄────────────────────│  - Prepares features    │   │ │
│  │   │             │   5. Return         │  - Calls ML Service     │   │ │
│  │   │             │   Prediction        │  - Returns result       │   │ │
│  │   └──────┬──────┘                     └────────────┬────────────┘   │ │
│  │          │                                         │                │ │
│  │          │ 6. Apply Algorithm                      │ HTTP           │ │
│  │          │    + ML Prediction                      │                │ │
│  │          ▼                                         ▼                │ │
│  │   ┌─────────────┐                     ┌─────────────────────────┐   │ │
│  │   │  Assign to  │                     │    PYTHON ML SERVICE    │   │ │
│  │   │  Best       │                     │    (Flask - Port 5001)  │   │ │
│  │   │  Resource   │                     │                         │   │ │
│  │   └──────┬──────┘                     │  ┌───────────────────┐  │   │ │
│  │          │                            │  │  Random Forest /  │  │   │ │
│  │          │ 7. Save Result             │  │  Linear Regression│  │   │ │
│  │          ▼                            │  └───────────────────┘  │   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                    │                                                       │
└────────────────────┼───────────────────────────────────────────────────────┘
                     │
                     │ 8. Store in Database
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL DATABASE                                │
│                                                                            │
│   ┌─────────┐    ┌───────────┐    ┌─────────────────┐    ┌────────────┐  │
│   │  tasks  │    │ resources │    │ schedule_history│    │ predictions│  │
│   │         │    │           │    │                 │    │            │  │
│   │ status  │    │ load      │    │ explanation     │    │ confidence │  │
│   │ pred_   │    │ capacity  │    │ actual_time     │    │ features   │  │
│   │  time   │    │           │    │ predicted_time  │    │ model_ver  │  │
│   └─────────┘    └───────────┘    └─────────────────┘    └────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed ML Prediction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ML PREDICTION SEQUENCE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

SCHEDULER SERVICE                ML INTEGRATION SERVICE              ML SERVICE (Python)
      │                                   │                                │
      │  1. scheduleTask(task)            │                                │
      │──────────────────────────────────►│                                │
      │                                   │                                │
      │                                   │  2. Extract Features           │
      │                                   │  ┌─────────────────────┐       │
      │                                   │  │ taskSize: LARGE → 3 │       │
      │                                   │  │ taskType: CPU → 1   │       │
      │                                   │  │ priority: 5         │       │
      │                                   │  │ resourceLoad: 45%   │       │
      │                                   │  └─────────────────────┘       │
      │                                   │                                │
      │                                   │  3. POST /api/predict          │
      │                                   │───────────────────────────────►│
      │                                   │                                │
      │                                   │                    4. Load Model
      │                                   │                    ┌───────────┐
      │                                   │                    │ model.pkl │
      │                                   │                    └───────────┘
      │                                   │                                │
      │                                   │                    5. Predict  │
      │                                   │                    ┌───────────┐
      │                                   │                    │ [3,1,5,45]│
      │                                   │                    │     ↓     │
      │                                   │                    │   4.2 sec │
      │                                   │                    └───────────┘
      │                                   │                                │
      │                                   │  6. Response                   │
      │                                   │◄───────────────────────────────│
      │                                   │  {                             │
      │                                   │    predictedTime: 4.2,         │
      │                                   │    confidence: 0.87            │
      │                                   │  }                             │
      │                                   │                                │
      │  7. Return Prediction             │                                │
      │◄──────────────────────────────────│                                │
      │                                   │                                │
      │  8. Calculate Score               │                                │
      │  ┌─────────────────────────────┐  │                                │
      │  │ score = (priority × 0.4)   │  │                                │
      │  │       + (1/predTime × 0.3) │  │                                │
      │  │       + (1/load × 0.3)     │  │                                │
      │  │ score = 0.923              │  │                                │
      │  └─────────────────────────────┘  │                                │
      │                                   │                                │
      │  9. Select Best Resource          │                                │
      │  10. Assign Task                  │                                │
      │  11. Save to Database             │                                │
      │                                   │                                │
```

---

## 3. ML Model Training Flow (Offline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ML MODEL TRAINING FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   POSTGRESQL    │
│                 │
│ schedule_history│
│ ┌─────────────┐ │
│ │ task_type   │ │
│ │ task_size   │ │
│ │ priority    │ │
│ │ resource_   │ │
│ │   load      │ │
│ │ actual_time │◄┼──── This is the LABEL (what we predict)
│ └─────────────┘ │
└────────┬────────┘
         │
         │ 1. Extract Training Data
         │    SELECT * FROM schedule_history
         │    WHERE actual_time IS NOT NULL
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODEL TRAINER (Python)                              │
│                                                                             │
│  2. Load Data into Pandas DataFrame                                         │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  task_type | task_size | priority | resource_load | actual_time    │    │
│  │  ──────────┼───────────┼──────────┼───────────────┼─────────────   │    │
│  │  CPU       | LARGE     | 5        | 45            | 4.1            │    │
│  │  IO        | SMALL     | 2        | 20            | 1.2            │    │
│  │  MIXED     | MEDIUM    | 3        | 60            | 3.5            │    │
│  │  ...       | ...       | ...      | ...           | ...            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. Feature Engineering                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  • Encode task_type: CPU=1, IO=2, MIXED=3                          │    │
│  │  • Encode task_size: SMALL=1, MEDIUM=2, LARGE=3                    │    │
│  │  • Normalize resource_load: 0-100 → 0-1                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. Split Data                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │        Training Set (80%)       │  │        Test Set (20%)           │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                             │
│  5. Train Model                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  from sklearn.ensemble import RandomForestRegressor                │    │
│  │                                                                    │    │
│  │  model = RandomForestRegressor(n_estimators=100)                   │    │
│  │  model.fit(X_train, y_train)                                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  6. Evaluate Model                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  predictions = model.predict(X_test)                               │    │
│  │  rmse = sqrt(mean_squared_error(y_test, predictions))              │    │
│  │  r2 = r2_score(y_test, predictions)                                │    │
│  │                                                                    │    │
│  │  Expected Results:                                                 │    │
│  │  • RMSE: < 1.5 seconds (acceptable)                                │    │
│  │  • R² Score: > 0.80 (good fit)                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  7. Save Model                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  import joblib                                                     │    │
│  │  joblib.dump(model, 'models/task_predictor_v1.pkl')                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 8. Deploy to ML Service
         ▼
┌─────────────────┐
│   ML SERVICE    │
│   (Flask)       │
│                 │
│ models/         │
│ └─task_predictor│
│   _v1.pkl       │
└─────────────────┘
```

---

## 4. Complete System Data Flow with ML

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW WITH ML                               │
└─────────────────────────────────────────────────────────────────────────────┘

                                    USER
                                      │
                                      │ Submit Task
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Create Task Form                                                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│  │  │ Name: Job-A   │  │ Type: CPU     │  │ Priority: 5   │           │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │   │
│  │                                                                     │   │
│  │  [ Submit Task ]                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ HTTP POST /api/tasks
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND                                                                    │
│                                                                             │
│  ┌──────────────────┐                                                      │
│  │  Task Controller │ ──────► Task Created (status: PENDING)               │
│  └────────┬─────────┘                                                      │
│           │                                                                 │
│           │ Trigger Scheduling                                              │
│           ▼                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │ Scheduler Service│ ◄──────►│  Resource Service│                         │
│  │                  │         │                  │                         │
│  │ 1. Get Task      │         │ Get Available    │                         │
│  │ 2. Get Resources │         │ Resources        │                         │
│  └────────┬─────────┘         └──────────────────┘                         │
│           │                                                                 │
│           │ For each resource candidate:                                    │
│           ▼                                                                 │
│  ┌──────────────────┐                                                      │
│  │ ML Integration   │ ──────────────────────────────────┐                  │
│  │ Service          │                                    │                  │
│  │                  │                                    │                  │
│  │ Prepare request: │                                    │                  │
│  │ {                │                                    │ HTTP POST        │
│  │   taskSize: 3,   │                                    │ /api/predict     │
│  │   taskType: 1,   │                                    │                  │
│  │   priority: 5,   │                                    │                  │
│  │   resourceLoad:  │                                    ▼                  │
│  │     45           │                      ┌──────────────────┐            │
│  │ }                │                      │  ML SERVICE      │            │
│  └────────┬─────────┘                      │  (Python/Flask)  │            │
│           │                                │                  │            │
│           │                                │  ┌────────────┐  │            │
│           │                                │  │   MODEL    │  │            │
│           │                                │  │            │  │            │
│           │                                │  │ Predict:   │  │            │
│           │                                │  │ 4.2 sec    │  │            │
│           │                                │  │ conf: 87%  │  │            │
│           │                                │  └────────────┘  │            │
│           │                                │                  │            │
│           │ ◄──────────────────────────────│  Response:       │            │
│           │     {predictedTime: 4.2,       │  {               │            │
│           │      confidence: 0.87}         │    predictedTime,│            │
│           │                                │    confidence    │            │
│  ┌────────▼─────────┐                      │  }               │            │
│  │ Scheduler Service│                      └──────────────────┘            │
│  │                  │                                                      │
│  │ Calculate Score: │                                                      │
│  │ ┌──────────────────────────────────────────────────────────┐           │
│  │ │ Resource-A: load=45%, score = 0.923 ★ SELECTED           │           │
│  │ │ Resource-B: load=78%, score = 0.671                      │           │
│  │ │ Resource-C: load=60%, score = 0.752                      │           │
│  │ └──────────────────────────────────────────────────────────┘           │
│  │                  │                                                      │
│  │ Assign Task to   │                                                      │
│  │ Resource-A       │                                                      │
│  └────────┬─────────┘                                                      │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │ Save to Database
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATABASE                                                                   │
│                                                                             │
│  UPDATE tasks SET                          INSERT INTO predictions          │
│    status = 'SCHEDULED',                     (task_id, predicted_time,      │
│    resource_id = 'resource-a-id',            confidence, features,          │
│    predicted_time = 4.2,                     model_version)                 │
│    scheduled_at = NOW()                    VALUES (...)                     │
│                                                                             │
│  INSERT INTO schedule_history                                               │
│    (task_id, resource_id, algorithm,                                        │
│     ml_enabled, predicted_time, score,                                      │
│     explanation)                                                            │
│  VALUES (                                                                   │
│    'task-id',                                                               │
│    'resource-a-id',                                                         │
│    'PRIORITY_ML_HYBRID',                                                    │
│    true,                                                                    │
│    4.2,                                                                     │
│    0.923,                                                                   │
│    'Assigned to Resource-A due to lowest load and highest score'           │
│  )                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            │ Return Result
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND - RESULT SCREEN                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Task Scheduled Successfully                                     │   │
│  │                                                                     │   │
│  │  Task: Job-A                                                        │   │
│  │  Assigned to: Resource-A                                            │   │
│  │                                                                     │   │
│  │  ML Prediction:                                                     │   │
│  │  • Predicted Time: 4.2 seconds                                      │   │
│  │  • Confidence: 87%                                                  │   │
│  │                                                                     │   │
│  │  Why this decision?                                                 │   │
│  │  "Assigned to Resource-A due to lowest load (45%) and              │   │
│  │   highest scheduling score (0.923)"                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. ML Feature Engineering Details

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FEATURE ENGINEERING                                      │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT (Raw Task Data)                    OUTPUT (ML Features)
─────────────────────                    ────────────────────

┌─────────────────────┐                  ┌─────────────────────┐
│                     │                  │                     │
│  name: "Job-A"      │ ────────────────►│  (not used)         │
│                     │                  │                     │
│  type: "CPU"        │ ────────────────►│  taskType: 1        │
│                     │   Encoding:      │  (CPU=1, IO=2,      │
│                     │                  │   MIXED=3)          │
│                     │                  │                     │
│  size: "LARGE"      │ ────────────────►│  taskSize: 3        │
│                     │   Encoding:      │  (SMALL=1, MED=2,   │
│                     │                  │   LARGE=3)          │
│                     │                  │                     │
│  priority: 5        │ ────────────────►│  priority: 5        │
│                     │   (unchanged)    │  (1-5 scale)        │
│                     │                  │                     │
└─────────────────────┘                  │                     │
                                         │                     │
┌─────────────────────┐                  │                     │
│  RESOURCE DATA      │                  │                     │
│                     │                  │                     │
│  current_load: 45%  │ ────────────────►│  resourceLoad: 0.45 │
│                     │   Normalize:     │  (0-100 → 0-1)      │
│                     │                  │                     │
│  capacity: 100      │ ────────────────►│  (optional feature) │
│                     │                  │                     │
└─────────────────────┘                  └─────────────────────┘
                                                   │
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  FEATURE VECTOR     │
                                         │                     │
                                         │  [1, 3, 5, 0.45]    │
                                         │                     │
                                         │  This goes to ML    │
                                         │  model.predict()    │
                                         └─────────────────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  PREDICTION OUTPUT  │
                                         │                     │
                                         │  predictedTime: 4.2 │
                                         │  confidence: 0.87   │
                                         └─────────────────────┘
```

---

## 6. Scheduling Algorithm with ML (Pseudocode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCHEDULING ALGORITHM                                     │
└─────────────────────────────────────────────────────────────────────────────┘

function scheduleTask(task):
    
    // Step 1: Get all available resources
    resources = resourceService.getAvailable()
    
    if resources.isEmpty():
        return ERROR("No resources available")
    
    // Step 2: For each resource, calculate score
    scores = []
    
    for each resource in resources:
        
        // Step 2a: Get ML prediction for this task-resource pair
        features = {
            taskSize: encodeSize(task.size),      // LARGE → 3
            taskType: encodeType(task.type),      // CPU → 1
            priority: task.priority,               // 5
            resourceLoad: resource.currentLoad     // 45
        }
        
        prediction = mlService.predict(features)
        // Returns: { predictedTime: 4.2, confidence: 0.87 }
        
        // Step 2b: Calculate scheduling score
        // Higher score = better choice
        score = calculateScore(task, resource, prediction)
        
        scores.push({
            resource: resource,
            score: score,
            predictedTime: prediction.predictedTime
        })
    
    // Step 3: Sort by score (descending)
    scores.sortByScoreDescending()
    
    // Step 4: Select best resource
    best = scores[0]
    
    // Step 5: Assign task
    task.resourceId = best.resource.id
    task.predictedTime = best.predictedTime
    task.status = 'SCHEDULED'
    task.scheduledAt = NOW()
    
    // Step 6: Update resource load
    best.resource.currentLoad += estimateLoadIncrease(task)
    
    // Step 7: Record decision for future learning
    saveScheduleHistory({
        taskId: task.id,
        resourceId: best.resource.id,
        algorithm: 'PRIORITY_ML_HYBRID',
        mlEnabled: true,
        predictedTime: best.predictedTime,
        score: best.score,
        explanation: generateExplanation(task, best)
    })
    
    return SUCCESS(task, best)


function calculateScore(task, resource, prediction):
    
    // Weights (can be configured)
    W_PRIORITY = 0.40
    W_PRED_TIME = 0.30
    W_LOAD = 0.30
    
    // Normalize factors
    priorityFactor = task.priority / 5.0                    // 0-1
    timeFactor = 1.0 / (1.0 + prediction.predictedTime)     // inverse, 0-1
    loadFactor = 1.0 - (resource.currentLoad / 100.0)       // inverse, 0-1
    
    // Calculate weighted score
    score = (priorityFactor * W_PRIORITY) +
            (timeFactor * W_PRED_TIME) +
            (loadFactor * W_LOAD)
    
    // Adjust by ML confidence (optional)
    score = score * (0.5 + 0.5 * prediction.confidence)
    
    return score


function generateExplanation(task, best):
    return `Task ${task.name} was assigned to ${best.resource.name} because:
            - Resource has lowest current load (${best.resource.currentLoad}%)
            - Task priority is ${task.priority}/5
            - ML predicted execution time: ${best.predictedTime}s
            - Scheduling score: ${best.score.toFixed(3)} (highest)`
```

---

## 7. What AI/ML Is and Isn't Doing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              WHAT ML DOES vs WHAT ML DOESN'T DO                            │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════╦═══════════════════════════════════╗
║           ML DOES ✅                  ║         ML DOESN'T ❌             ║
╠═══════════════════════════════════════╬═══════════════════════════════════╣
║                                       ║                                   ║
║  • Predict task execution time        ║  • Make final scheduling decision ║
║                                       ║                                   ║
║  • Provide confidence score           ║  • Create or delete tasks         ║
║                                       ║                                   ║
║  • Learn from historical data         ║  • Manage resources               ║
║                                       ║                                   ║
║  • Assist scheduler with estimates    ║  • Handle user authentication     ║
║                                       ║                                   ║
║  • Improve over time with more data   ║  • Replace rule-based logic       ║
║                                       ║                                   ║
║  • Help explain scheduling decisions  ║  • Work without the scheduler     ║
║                                       ║                                   ║
╚═══════════════════════════════════════╩═══════════════════════════════════╝

                           ┌─────────────────────┐
                           │                     │
                           │    SCHEDULER        │
                           │    (The Boss)       │
                           │                     │
                           │  Makes decisions    │
                           │  Uses algorithms    │
                           │  Assigns tasks      │
                           │                     │
                           └──────────┬──────────┘
                                      │
                                      │ "Hey ML, how long
                                      │  will this task take?"
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │                     │
                           │    ML SERVICE       │
                           │   (The Advisor)     │
                           │                     │
                           │  "Based on history, │
                           │   about 4.2 seconds │
                           │   with 87% confidence"│
                           │                     │
                           └─────────────────────┘

        ML is a TOOL that helps the SCHEDULER make BETTER decisions.
        The SCHEDULER is still in control.
```

---

## 8. Summary: Why ML Matters in This System

| Without ML | With ML |
|------------|---------|
| Execution time is assumed or hardcoded | Execution time is predicted from real data |
| All tasks treated similarly | Tasks optimized based on learned patterns |
| No learning from past performance | System improves over time |
| Black-box scheduling | Explainable decisions with confidence |
| ~70% resource efficiency | ~90% resource efficiency (estimated) |

---

## Interview Answer (Memorize This)

> "In our system, Machine Learning is used as a **prediction assistant** to the scheduler. It predicts task execution time based on historical data—considering factors like task type, size, priority, and current resource load. The scheduler then combines this prediction with priority-based rules to assign tasks to the most suitable resource. ML doesn't make decisions; it provides **intelligent estimates** that help the scheduler make **better decisions**. This is a **lightweight regression model**, not deep learning, making it practical and explainable."

---

*Document created for Phase 3 Design Submission | Team Byte_hogs | 2026*
