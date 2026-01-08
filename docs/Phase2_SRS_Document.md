# B.Sc. (CS) – Software Requirements Specification (SRS)

---

## Document Information

| Field | Details |
|-------|---------|
| **Project Title** | Intelligent Task Allocation and Scheduling System with ML-Assisted Optimization |
| **Prepared by** | Team Byte_hogs |
| **Student(s) Name(s)** | Shri Srivastava, Ichha Dwivedi, Aditi Singh |
| **Student(s) ID(s)** | 2023ebcs593, 2023ebcs125, 2023ebcs498 |
| **Date** | February 2026 |
| **Version** | 1.0 |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document provides a comprehensive description of the Intelligent Task Allocation and Scheduling System. It defines the functional and non-functional requirements, system interfaces, and constraints for the development team. This document serves as:

- A contract between the development team and stakeholders
- A reference for system design and implementation
- A basis for testing and validation
- A guide for project evaluation

### 1.2 Scope of the Project

The **Intelligent Task Allocation and Scheduling System** is a full-stack web application designed to:

1. **Accept computational tasks** from users with attributes like priority, size, and type
2. **Manage resources** (servers/machines) with capacity and load monitoring
3. **Schedule tasks intelligently** using a research-based heuristic algorithm
4. **Predict execution time** using machine learning models
5. **Visualize decisions** with explainability and performance comparison

**Main Functionalities:**
- Task creation, modification, and deletion
- Resource registration and monitoring
- Intelligent task-to-resource assignment
- ML-based execution time prediction
- Real-time dashboard with metrics
- Performance comparison (ML vs. non-ML scheduling)

**Expected Outcome:**
A working web application demonstrating 20-25% improvement in task completion time compared to traditional FCFS scheduling, with full visibility into scheduling decisions.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| **Task** | A computational job to be executed on a resource |
| **Resource** | A computing entity (server/machine) that can execute tasks |
| **Scheduler** | The component that decides task-to-resource assignment |
| **ML** | Machine Learning |
| **API** | Application Programming Interface |
| **REST** | Representational State Transfer |
| **FCFS** | First-Come-First-Serve scheduling algorithm |
| **CRUD** | Create, Read, Update, Delete operations |
| **SRS** | Software Requirements Specification |
| **UI** | User Interface |
| **UX** | User Experience |
| **JWT** | JSON Web Token |
| **ORM** | Object-Relational Mapping |
| **CI/CD** | Continuous Integration / Continuous Deployment |

### 1.4 References

1. Wang, J., & Li, D. (2019). "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing." *Sensors*, 19(5), 1023.
2. Phase 1 Project Proposal - Team Byte_hogs (January 2026)
3. BITS Pilani Study Project Guidelines
4. React Documentation - https://react.dev/
5. Express.js Documentation - https://expressjs.com/
6. scikit-learn Documentation - https://scikit-learn.org/

---

## 2. Project Overview

### 2.1 Product Perspective

This system is a **standalone web application** that can operate independently. However, it is designed with extensibility to integrate into larger environments:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL ENVIRONMENT                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Cloud APIs  │  │ Monitoring  │  │ External Task Sources   │ │
│  │ (Future)    │  │ Tools       │  │ (Future Integration)    │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              INTELLIGENT TASK SCHEDULING SYSTEM                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Frontend (React)                      │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │                  Backend (Node.js)                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   REST API   │  │  Scheduler   │  │  WebSocket   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────┐  ┌────────▼────────┐  ┌────────────────────┐   │
│  │ PostgreSQL │  │  ML Service     │  │      Redis         │   │
│  │  Database  │  │  (Python/Flask) │  │   (Job Queue)      │   │
│  └────────────┘  └─────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions

| Function Category | Functions |
|-------------------|-----------|
| **Task Management** | Create task, View tasks, Update task, Delete task, View task details, Filter/sort tasks |
| **Resource Management** | Register resource, View resources, Update resource status, Monitor resource load |
| **Scheduling** | Run scheduler, View scheduling decisions, View assignment history |
| **ML Prediction** | Predict execution time, View prediction accuracy, Compare with actual |
| **Analytics** | View performance metrics, Compare algorithms, Export reports |
| **User Interface** | Dashboard view, Real-time updates, Responsive design |

### 2.3 User Classes and Characteristics

| User Class | Description | Interaction Level | Technical Expertise |
|------------|-------------|-------------------|---------------------|
| **System Administrator** | Manages resources, configures system settings | High | High |
| **Task Submitter** | Creates and monitors tasks | Medium | Low-Medium |
| **Analyst** | Views performance metrics and comparisons | Medium | Medium |
| **Developer** | Extends system via APIs | High | High |
| **Evaluator (Professor)** | Reviews system for academic evaluation | Low | Medium |

### 2.4 Operating Environment

#### Software Requirements
| Component | Requirement |
|-----------|-------------|
| **Operating System** | Windows 10+, macOS 10.15+, Ubuntu 20.04+ |
| **Web Browser** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| **Node.js** | Version 18.x or higher |
| **Python** | Version 3.9 or higher |
| **PostgreSQL** | Version 13.x or higher |
| **Docker** | Version 20.x or higher (optional) |

#### Hardware Requirements
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 4 GB | 8 GB |
| **Storage** | 10 GB | 20 GB |
| **Processor** | Dual-core 2.0 GHz | Quad-core 2.5 GHz |
| **Network** | Broadband internet | Broadband internet |

### 2.5 Assumptions and Dependencies

#### Assumptions
1. Users have access to a modern web browser with JavaScript enabled
2. The system will initially handle up to 1000 concurrent tasks
3. Resources are pre-registered and their specifications are known
4. Network latency between components is minimal (< 100ms)
5. Synthetic data will be used for initial ML model training

#### Dependencies
| Dependency | Type | Purpose |
|------------|------|---------|
| React 18.x | Library | Frontend framework |
| Express.js 4.x | Framework | Backend API framework |
| Prisma 4.x | ORM | Database access |
| scikit-learn 1.x | Library | ML model training |
| Flask 2.x | Framework | ML API service |
| Chart.js/Recharts | Library | Data visualization |
| Socket.io | Library | Real-time communication |

---

## 3. Functional Requirements

### 3.1 Use Cases

#### 3.1.1 Use Case Diagram

```
                           ┌─────────────────────────────────────┐
                           │    Task Scheduling System           │
                           │                                     │
    ┌──────────┐           │   ┌─────────────────────────┐      │
    │          │           │   │     Create Task         │      │
    │   Task   │──────────►│   └─────────────────────────┘      │
    │ Submitter│           │   ┌─────────────────────────┐      │
    │          │──────────►│   │     View Tasks          │      │
    └──────────┘           │   └─────────────────────────┘      │
                           │   ┌─────────────────────────┐      │
                           │   │   View Scheduling       │      │
    ┌──────────┐           │   │     Results             │      │
    │          │──────────►│   └─────────────────────────┘      │
    │  System  │           │   ┌─────────────────────────┐      │
    │  Admin   │──────────►│   │   Manage Resources      │      │
    │          │           │   └─────────────────────────┘      │
    └──────────┘           │   ┌─────────────────────────┐      │
         │                 │   │   Run Scheduler         │      │
         │                 │   └─────────────────────────┘      │
         │                 │   ┌─────────────────────────┐      │
         └────────────────►│   │   Configure System      │      │
                           │   └─────────────────────────┘      │
    ┌──────────┐           │   ┌─────────────────────────┐      │
    │          │──────────►│   │   View Analytics        │      │
    │ Analyst  │           │   └─────────────────────────┘      │
    │          │──────────►│   ┌─────────────────────────┐      │
    └──────────┘           │   │   Compare Algorithms    │      │
                           │   └─────────────────────────┘      │
                           │                                     │
                           │          ┌──────────────┐          │
                           │          │  ML Service  │          │
                           │          │   (Actor)    │          │
                           │          └──────────────┘          │
                           └─────────────────────────────────────┘
```

#### 3.1.2 Use Case Details

##### UC-01: Create Task
| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-01 |
| **Name** | Create Task |
| **Actors** | Task Submitter, System Admin |
| **Description** | User creates a new task with specified attributes |
| **Preconditions** | User is authenticated and has create permission |
| **Postconditions** | Task is stored in database with "Pending" status |
| **Main Flow** | 1. User navigates to "Create Task" page<br>2. User enters task name<br>3. User selects task type (CPU/IO/Mixed)<br>4. User selects task size (Small/Medium/Large)<br>5. User sets priority (1-5)<br>6. User clicks "Submit"<br>7. System validates input<br>8. System stores task<br>9. System confirms creation |
| **Alternative Flow** | 7a. Validation fails → Show error message |
| **Exceptions** | Database connection failure → Show error, retry option |

##### UC-02: Run Scheduler
| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-02 |
| **Name** | Run Scheduler |
| **Actors** | System Admin |
| **Description** | Admin triggers the scheduling algorithm to assign tasks |
| **Preconditions** | At least one pending task exists; at least one resource available |
| **Postconditions** | Tasks are assigned to resources; status updated |
| **Main Flow** | 1. Admin clicks "Run Scheduler"<br>2. System fetches pending tasks<br>3. System calls ML service for predictions<br>4. System applies scheduling algorithm<br>5. System assigns tasks to resources<br>6. System updates task status<br>7. System displays results |
| **Alternative Flow** | 3a. ML service unavailable → Use default execution time |
| **Exceptions** | No available resources → Show warning message |

##### UC-03: View Analytics
| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-03 |
| **Name** | View Analytics |
| **Actors** | Analyst, System Admin |
| **Description** | User views performance metrics and comparisons |
| **Preconditions** | Historical scheduling data exists |
| **Postconditions** | Analytics displayed on dashboard |
| **Main Flow** | 1. User navigates to Analytics page<br>2. System fetches historical data<br>3. System calculates metrics<br>4. System renders charts<br>5. User views comparison data |

#### 3.1.3 User Stories

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| US-01 | As a **task submitter**, I want to **create a new task** so that **it can be scheduled for execution** | High | Task form validates input; Task saved to database; Confirmation shown |
| US-02 | As a **task submitter**, I want to **view all my tasks** so that **I can track their status** | High | Tasks displayed in table; Filter by status; Real-time updates |
| US-03 | As a **system admin**, I want to **run the scheduler** so that **pending tasks are assigned to resources** | High | Scheduler executes; Tasks assigned; Results displayed |
| US-04 | As a **system admin**, I want to **add new resources** so that **the system has capacity for tasks** | High | Resource form validates; Resource saved; Visible in list |
| US-05 | As an **analyst**, I want to **see ML prediction accuracy** so that **I can evaluate system performance** | Medium | Predicted vs actual shown; Accuracy percentage calculated |
| US-06 | As an **analyst**, I want to **compare ML vs non-ML scheduling** so that **I can quantify improvement** | Medium | Side-by-side comparison; Metrics calculated; Charts displayed |
| US-07 | As a **task submitter**, I want to **see why a task was scheduled a certain way** so that **I understand the decision** | Medium | Explanation text shown; Factors listed; Score breakdown |
| US-08 | As a **system admin**, I want to **monitor resource load in real-time** so that **I can ensure system health** | Medium | Live updates; Load percentage shown; Alerts for high load |
| US-09 | As a **developer**, I want to **access the system via API** so that **I can integrate with other systems** | Medium | REST endpoints available; Documentation provided; Auth working |
| US-10 | As an **evaluator**, I want to **see a demo of the complete system** so that **I can assess the project** | High | End-to-end flow works; All features demonstrable |

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

| Requirement | Specification |
|-------------|---------------|
| **Response Time** | API responses < 200ms for 95% of requests |
| **Throughput** | Handle 100 concurrent task submissions |
| **ML Prediction** | Prediction response < 100ms |
| **Dashboard Load** | Initial page load < 3 seconds |
| **Real-time Updates** | WebSocket latency < 500ms |
| **Scheduling** | Schedule 1000 tasks in < 5 seconds |

### 4.2 Security Requirements

| Requirement | Specification |
|-------------|---------------|
| **Authentication** | Basic token-based authentication (JWT) |
| **Data Validation** | All user inputs sanitized and validated |
| **SQL Injection** | Prevented via ORM parameterized queries |
| **XSS Protection** | React's built-in escaping + CSP headers |
| **HTTPS** | All production traffic encrypted (future) |
| **Rate Limiting** | API rate limiting (100 requests/minute) |

### 4.3 Usability Requirements

| Requirement | Specification |
|-------------|---------------|
| **Learnability** | New user can create task within 2 minutes |
| **Efficiency** | Common tasks completable in < 5 clicks |
| **Error Messages** | Clear, actionable error messages |
| **Accessibility** | WCAG 2.1 Level AA compliance (basic) |
| **Responsiveness** | Functional on desktop and tablet |
| **Documentation** | User guide with screenshots |

### 4.4 Scalability Requirements

| Requirement | Specification |
|-------------|---------------|
| **Horizontal Scaling** | Architecture supports adding backend instances |
| **Database Scaling** | PostgreSQL supports connection pooling |
| **ML Service** | Can be scaled independently |
| **Task Volume** | Designed for 10,000 tasks initially |

### 4.5 Reliability Requirements

| Requirement | Specification |
|-------------|---------------|
| **Uptime** | 95% availability during development |
| **Data Integrity** | ACID-compliant database transactions |
| **Graceful Degradation** | ML failure doesn't break scheduling |
| **Error Logging** | All errors logged with stack traces |

### 4.6 Compatibility Requirements

| Requirement | Specification |
|-------------|---------------|
| **Browsers** | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| **API Format** | JSON for all API responses |
| **Database** | PostgreSQL (SQLite for development) |
| **Containerization** | Docker compatible |

---

## 5. System Models and Diagrams

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     React Frontend (SPA)                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │  Dashboard  │  │Task Manager │  │  Analytics  │  │  Settings   │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                         │                                              │ │
│  │                    Zustand/Redux (State Management)                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTP/WebSocket
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                              API LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                   Node.js + Express Backend                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │  REST API   │  │  Scheduler  │  │  WebSocket  │  │ Middleware  │   │ │
│  │  │  Controller │  │   Engine    │  │   Handler   │  │  (Auth,Log) │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└────────┬────────────────────────┬───────────────────────────┬───────────────┘
         │                        │                           │
         ▼                        ▼                           ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐
│   PostgreSQL    │    │   Python ML Service │    │        Redis            │
│   Database      │    │   (Flask API)       │    │     (Job Queue)         │
│                 │    │                     │    │                         │
│ ┌─────────────┐ │    │ ┌─────────────────┐ │    │  ┌───────────────────┐  │
│ │   Tasks     │ │    │ │ Linear/Random   │ │    │  │  Task Queue       │  │
│ │  Resources  │ │    │ │ Forest Model    │ │    │  │  Scheduled Jobs   │  │
│ │   History   │ │    │ │                 │ │    │  └───────────────────┘  │
│ │   Metrics   │ │    │ │ /predict-time   │ │    │                         │
│ └─────────────┘ │    │ └─────────────────┘ │    │                         │
└─────────────────┘    └─────────────────────┘    └─────────────────────────┘
```

### 5.2 Domain Class Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN CLASSES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│       Task          │         │      Resource       │
├─────────────────────┤         ├─────────────────────┤
│ - id: UUID          │         │ - id: UUID          │
│ - name: String      │    *    │ - name: String      │
│ - type: TaskType    │◄────────│ - capacity: Int     │
│ - size: TaskSize    │    1    │ - currentLoad: Float│
│ - priority: Int     │         │ - status: Status    │
│ - status: Status    │         │ - createdAt: Date   │
│ - predictedTime: Float        │ - updatedAt: Date   │
│ - actualTime: Float │         └─────────────────────┘
│ - resourceId: UUID  │                   │
│ - createdAt: Date   │                   │
│ - scheduledAt: Date │                   │ 1
│ - completedAt: Date │                   │
├─────────────────────┤                   │
│ + create()          │                   │
│ + update()          │         ┌─────────▼───────────┐
│ + delete()          │         │   ScheduleHistory   │
│ + getStatus()       │         ├─────────────────────┤
└─────────────────────┘         │ - id: UUID          │
         │                      │ - taskId: UUID      │
         │                      │ - resourceId: UUID  │
         │ *                    │ - scheduledAt: Date │
         │                      │ - algorithm: String │
         ▼                      │ - mlEnabled: Bool   │
┌─────────────────────┐         │ - predictedTime: Float
│    TaskType         │         │ - actualTime: Float │
├─────────────────────┤         │ - score: Float      │
│ CPU                 │         └─────────────────────┘
│ IO                  │
│ MIXED               │         ┌─────────────────────┐
└─────────────────────┘         │   Prediction        │
                                ├─────────────────────┤
┌─────────────────────┐         │ - taskId: UUID      │
│    TaskSize         │         │ - predictedTime: Float
├─────────────────────┤         │ - confidence: Float │
│ SMALL               │         │ - features: JSON    │
│ MEDIUM              │         │ - createdAt: Date   │
│ LARGE               │         └─────────────────────┘
└─────────────────────┘

┌─────────────────────┐
│    Status           │
├─────────────────────┤
│ PENDING             │
│ SCHEDULED           │
│ RUNNING             │
│ COMPLETED           │
│ FAILED              │
└─────────────────────┘
```

### 5.3 Sequence Diagrams

#### Sequence Diagram: Task Creation and Scheduling

```
┌──────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌────────────┐
│ User │    │ Frontend │    │  Backend  │    │ ML Service│    │  Database  │
└──┬───┘    └────┬─────┘    └─────┬─────┘    └─────┬─────┘    └──────┬─────┘
   │             │                │                │                 │
   │ Fill Form   │                │                │                 │
   │────────────►│                │                │                 │
   │             │                │                │                 │
   │             │ POST /tasks    │                │                 │
   │             │───────────────►│                │                 │
   │             │                │                │                 │
   │             │                │ Validate       │                 │
   │             │                │────────┐       │                 │
   │             │                │        │       │                 │
   │             │                │◄───────┘       │                 │
   │             │                │                │                 │
   │             │                │ INSERT task    │                 │
   │             │                │────────────────────────────────►│
   │             │                │                │                 │
   │             │                │ Task created   │                 │
   │             │                │◄────────────────────────────────│
   │             │                │                │                 │
   │             │ 201 Created    │                │                 │
   │             │◄───────────────│                │                 │
   │             │                │                │                 │
   │ Show Success│                │                │                 │
   │◄────────────│                │                │                 │
   │             │                │                │                 │
   │ Click Schedule               │                │                 │
   │────────────►│                │                │                 │
   │             │                │                │                 │
   │             │ POST /schedule │                │                 │
   │             │───────────────►│                │                 │
   │             │                │                │                 │
   │             │                │ GET pending    │                 │
   │             │                │────────────────────────────────►│
   │             │                │                │                 │
   │             │                │ Tasks list     │                 │
   │             │                │◄────────────────────────────────│
   │             │                │                │                 │
   │             │                │ POST /predict  │                 │
   │             │                │───────────────►│                 │
   │             │                │                │                 │
   │             │                │ Prediction     │                 │
   │             │                │◄───────────────│                 │
   │             │                │                │                 │
   │             │                │ Apply Algorithm│                 │
   │             │                │────────┐       │                 │
   │             │                │        │       │                 │
   │             │                │◄───────┘       │                 │
   │             │                │                │                 │
   │             │                │ UPDATE tasks   │                 │
   │             │                │────────────────────────────────►│
   │             │                │                │                 │
   │             │ Schedule Result│                │                 │
   │             │◄───────────────│                │                 │
   │             │                │                │                 │
   │ Show Results│                │                │                 │
   │◄────────────│                │                │                 │
   │             │                │                │                 │
```

### 5.4 Entity-Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE SCHEMA (ERD)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐              ┌─────────────────────┐
│       tasks         │              │     resources       │
├─────────────────────┤              ├─────────────────────┤
│ PK  id (UUID)       │         ┌───│ PK  id (UUID)       │
│     name (VARCHAR)  │         │   │     name (VARCHAR)  │
│     type (ENUM)     │         │   │     capacity (INT)  │
│     size (ENUM)     │         │   │     current_load    │
│     priority (INT)  │         │   │         (DECIMAL)   │
│     status (ENUM)   │         │   │     status (ENUM)   │
│     predicted_time  │         │   │     created_at      │
│         (DECIMAL)   │         │   │         (TIMESTAMP) │
│     actual_time     │         │   │     updated_at      │
│         (DECIMAL)   │         │   │         (TIMESTAMP) │
│ FK  resource_id ────┼─────────┘   └─────────────────────┘
│     created_at      │
│         (TIMESTAMP) │              ┌─────────────────────┐
│     scheduled_at    │              │  schedule_history   │
│         (TIMESTAMP) │              ├─────────────────────┤
│     completed_at    │         ┌───│ PK  id (UUID)       │
│         (TIMESTAMP) │         │   │ FK  task_id ────────┼───┐
└─────────────────────┘         │   │ FK  resource_id ────┼───┤
         │                      │   │     algorithm       │   │
         │                      │   │         (VARCHAR)   │   │
         └──────────────────────┘   │     ml_enabled      │   │
                                    │         (BOOLEAN)   │   │
                                    │     predicted_time  │   │
                                    │         (DECIMAL)   │   │
                                    │     actual_time     │   │
                                    │         (DECIMAL)   │   │
                                    │     score (DECIMAL) │   │
                                    │     created_at      │   │
                                    │         (TIMESTAMP) │   │
                                    └─────────────────────┘   │
                                             │                │
         ┌───────────────────────────────────┘                │
         │                                                     │
         │  ┌─────────────────────┐                           │
         │  │    predictions      │                           │
         │  ├─────────────────────┤                           │
         │  │ PK  id (UUID)       │                           │
         └──│ FK  task_id ────────┼───────────────────────────┘
            │     predicted_time  │
            │         (DECIMAL)   │
            │     confidence      │
            │         (DECIMAL)   │
            │     features (JSON) │
            │     created_at      │
            │         (TIMESTAMP) │
            └─────────────────────┘
```

---

## 6. External Interface Requirements

### 6.1 User Interfaces

| Screen | Description | Key Elements |
|--------|-------------|--------------|
| **Landing Page** | Entry point with system overview | Title, description, "Get Started" button |
| **Dashboard** | Main view with task queue and metrics | Task table, resource status, quick actions |
| **Create Task** | Form for new task submission | Input fields, dropdowns, submit button |
| **Task Details** | Individual task information | Status, assignment, prediction, history |
| **Resources** | Resource management view | Resource list, load indicators, add form |
| **Scheduling Decision** | Shows scheduling results | Assignment details, explanation, metrics |
| **Analytics** | Performance comparison charts | Bar charts, metrics, comparison tables |

### 6.2 Hardware Interfaces

| Interface | Description |
|-----------|-------------|
| **Client Device** | Standard computer/tablet with web browser |
| **Server** | Standard server hardware or cloud VM |
| **No Special Hardware** | No sensors, peripherals, or IoT devices required |

### 6.3 Software Interfaces

| Interface | Protocol | Description |
|-----------|----------|-------------|
| **Frontend ↔ Backend** | REST/HTTP | JSON-based API calls |
| **Backend ↔ Database** | PostgreSQL Protocol | Via Prisma ORM |
| **Backend ↔ ML Service** | REST/HTTP | JSON-based predictions |
| **Real-time Updates** | WebSocket | Socket.io for live updates |

### 6.4 Communication Interfaces

| Protocol | Port | Usage |
|----------|------|-------|
| **HTTP/HTTPS** | 80/443 | Frontend serving, API calls |
| **WebSocket** | 3001 | Real-time updates |
| **PostgreSQL** | 5432 | Database connections |
| **Flask API** | 5001 | ML service |

---

## 7. Quality Assurance and Testing

### 7.1 Testing Strategy

| Testing Type | Scope | Tools |
|--------------|-------|-------|
| **Unit Testing** | Individual functions, components | Jest, React Testing Library |
| **Integration Testing** | API endpoints, service interactions | Jest, Supertest |
| **System Testing** | End-to-end workflows | Cypress |
| **Performance Testing** | Load, stress testing | Artillery, k6 |
| **Acceptance Testing** | User requirements validation | Manual testing |

### 7.2 Test Cases and Scenarios

| TC-ID | Test Case | Input | Expected Output | Priority |
|-------|-----------|-------|-----------------|----------|
| TC-01 | Create valid task | Valid task data | Task created, 201 status | High |
| TC-02 | Create invalid task | Missing required field | 400 error, validation message | High |
| TC-03 | Run scheduler | Pending tasks exist | Tasks assigned to resources | High |
| TC-04 | ML prediction | Task features | Predicted time returned | High |
| TC-05 | ML service down | Task features | Fallback time used | Medium |
| TC-06 | View analytics | Historical data exists | Charts rendered | Medium |
| TC-07 | Real-time update | Task status change | Dashboard updates live | Medium |
| TC-08 | Load test | 100 concurrent requests | Response < 500ms | Medium |

### 7.3 Acceptance Criteria

| Requirement | Acceptance Criteria |
|-------------|---------------------|
| **Task Creation** | User can create task in < 1 minute; Task appears in queue |
| **Scheduling** | Scheduler assigns all pending tasks; No task left unassigned |
| **ML Prediction** | Prediction accuracy > 80% on test data |
| **Performance** | API response < 200ms for 95% of requests |
| **UI Usability** | New user completes workflow without help |
| **Documentation** | All API endpoints documented; Setup guide tested |

---

## 8. Project Plan

### 8.1 Timeline and Milestones

| Phase | Start | End | Milestone | Deliverable |
|-------|-------|-----|-----------|-------------|
| Phase 1 | Jan 1, 2026 | Jan 15, 2026 | Proposal Approved | Project Proposal |
| Phase 2 | Jan 16, 2026 | Feb 28, 2026 | Design Complete | SRS Document |
| Phase 3a | Mar 1, 2026 | Mar 31, 2026 | Backend Ready | API + Scheduler |
| Phase 3b | Apr 1, 2026 | Apr 30, 2026 | Frontend Ready | UI Complete |
| Phase 3c | May 1, 2026 | May 15, 2026 | ML Integrated | Full System |
| Phase 4 | May 16, 2026 | May 31, 2026 | Testing Complete | Test Reports |

### 8.2 Roles and Responsibilities

| Team Member | Role | Phase 2 Tasks | Phase 3 Tasks |
|-------------|------|---------------|---------------|
| **Shri Srivastava** | Backend Lead | Database schema, API design | REST API, Scheduler engine |
| **Ichha Dwivedi** | Frontend Lead | UI wireframes, component design | React implementation |
| **Aditi Singh** | ML/DevOps Lead | ML model design, CI/CD setup | ML service, Docker, testing |

### 8.3 Risk Assessment and Mitigation Plan

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Technology learning curve | Medium | Medium | Start learning early; use tutorials; pair programming |
| ML model poor accuracy | Low | Medium | Use simple baseline; collect more training data |
| Integration issues | Medium | High | Early integration; continuous testing |
| Time overrun | Medium | High | Buffer time in schedule; prioritize core features |
| Team coordination | Low | Medium | Regular meetings; clear communication channels |

---

## 9. Tools and Technologies

### 9.1 Development Tools

| Category | Tool | Purpose |
|----------|------|---------|
| **IDE** | Visual Studio Code | Code editing, debugging |
| **Frontend** | React 18, TypeScript, Tailwind CSS | UI development |
| **Backend** | Node.js 18, Express.js, TypeScript | API development |
| **Database** | PostgreSQL, Prisma ORM | Data storage |
| **ML** | Python 3.9, scikit-learn, Flask | ML model and API |
| **API Testing** | Postman, Insomnia | API development/testing |

### 9.2 Testing Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Unit and integration testing |
| **React Testing Library** | Component testing |
| **Supertest** | API testing |
| **Cypress** | End-to-end testing |
| **Artillery** | Load testing |

### 9.3 Project Management Tools

| Tool | Purpose |
|------|---------|
| **GitHub** | Version control, code reviews |
| **GitHub Projects** | Task tracking, sprint planning |
| **GitHub Actions** | CI/CD pipeline |
| **Figma** | UI/UX design |
| **Draw.io** | Architecture diagrams |
| **Google Docs** | Documentation |

---

## 10. Appendices

### Appendix A: API Endpoint Specification

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/tasks | Create new task |
| GET | /api/tasks | List all tasks |
| GET | /api/tasks/:id | Get task by ID |
| PUT | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |
| GET | /api/resources | List all resources |
| POST | /api/resources | Create resource |
| PUT | /api/resources/:id | Update resource |
| POST | /api/schedule | Run scheduler |
| GET | /api/schedule/history | Get scheduling history |
| POST | /api/predict | Get ML prediction |
| GET | /api/metrics | Get performance metrics |
| GET | /api/comparison | Get algorithm comparison |

### Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Heuristic** | A problem-solving approach using practical methods |
| **Regression** | ML technique for predicting numerical values |
| **WebSocket** | Protocol for real-time bidirectional communication |
| **ORM** | Object-Relational Mapping for database access |
| **Microservice** | Architectural style with small, independent services |

---

*Prepared by Team Byte_hogs | BITS Pilani Online | February 2026*
