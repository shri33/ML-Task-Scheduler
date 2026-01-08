# PHASE 1 STUDY PROJECT PROPOSAL

## Intelligent Task Allocation and Scheduling System with ML-Assisted Optimization

---

**Submission Date:** January 15, 2026  
**Course:** BCS ZC241T - Study Project  
**Semester:** 5 (Year 3, Term 2)  
**Institution:** BITS Pilani Online  

---

## TEAM MEMBERS

| Name | Roll Number | Role |
|------|------------|------|
| [Your Full Name] | [Your Roll No] | Backend Lead (Node.js, API, Scheduler) |
| [Member 2 Full Name] | [Member 2 Roll No] | Frontend Lead (React, UI, Dashboard) |
| [Member 3 Full Name] | [Member 3 Roll No] | ML/DevOps Lead (Python, ML, Deployment) |

---

## 1. PROJECT TITLE

**"Intelligent Task Allocation and Scheduling System with Machine Learning-Assisted Execution Time Prediction"**

---

## 2. PROBLEM STATEMENT

### 2.1 Background

In distributed computing environments (cloud infrastructure, fog computing, edge computing, and resource-constrained IoT networks), the efficient allocation of computational tasks to available resources is a critical and complex problem. When multiple tasks arrive and multiple resources exist, the scheduling decision significantly impacts system performance, latency, energy consumption, and user satisfaction.

### 2.2 Current Challenge

Existing solutions fall into two categories:

1. **Simple algorithms** (FCFS, Round-Robin): Easy to implement but suboptimal, leading to 25-40% performance degradation.
2. **Complex systems** (Kubernetes, Mesos, OpenStack): Highly sophisticated but require extensive infrastructure and expertise, making them inaccessible to small organizations and educational institutions.

There exists a critical gap: No production-ready, user-friendly system exists that combines intelligent scheduling with machine learning prediction for practical, deployable real-world use cases.

### 2.3 Research Foundation

The paper "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing" (Wang & Li, 2019) proposes an effective heuristic-based scheduling algorithm. However, the research is limited to **simulation environments only** with no:
- Real-time implementation
- User interface for interaction
- Machine learning integration for execution time prediction
- Deployment readiness

### 2.4 Problem Definition

**How can we convert existing academic research on intelligent task scheduling into a practical, full-stack web application that combines heuristic algorithms with machine learning predictions, making it accessible and usable for real-world scenarios?**

---

## 3. OBJECTIVES

1. **Design and implement a real-time task scheduling system** that converts academic research (Wang & Li, 2019) into a functional, deployable application.

2. **Develop a heuristic-based scheduler** that outperforms baseline algorithms (FCFS, round-robin) by at least 20% in task completion time.

3. **Integrate machine learning** for execution time prediction using simple regression models to improve scheduling accuracy.

4. **Create a user-friendly web interface** that allows users to submit tasks, monitor resources, and visualize scheduling decisions.

5. **Compare and evaluate** intelligent scheduling vs. random/FCFS scheduling with quantifiable metrics (latency, throughput, resource utilization).

6. **Deploy as a scalable application** with clear architecture for potential real-world use and future extensions.

---

## 4. SCOPE AND CONSTRAINTS

### 4.1 In Scope

- ✅ Task management (create, view, update, delete tasks with priority/deadline)
- ✅ Resource management (monitor resource capacity, load, availability)
- ✅ Scheduler engine implementation (heuristic-based, priority-aware)
- ✅ ML prediction module (execution time prediction using linear/random forest regression)
- ✅ Web UI dashboard (task submission, resource monitoring, performance visualization)
- ✅ Performance comparison (intelligent vs. baseline algorithms)
- ✅ RESTful API for all operations
- ✅ Real-time updates using WebSockets
- ✅ Containerized deployment (Docker)
- ✅ Automated testing (unit + integration tests)

### 4.2 Out of Scope

- ❌ Distributed consensus algorithms (Raft, Paxos)
- ❌ GPU/Tensor processing acceleration
- ❌ Multi-cloud federation and hybrid cloud support
- ❌ Commercial-grade security (encryption, authentication beyond basic)
- ❌ Advanced reinforcement learning models
- ❌ Blockchain integration
- ❌ Real production deployment (Capstone phase)

### 4.3 Constraints

- **Team:** 3 members with knowledge of JavaScript, Python, and SQL
- **Timeline:** 12 weeks (Phase 1: proposal, Phase 2: design + PoC, Phase 3: implementation)
- **Budget:** Zero cost (all open-source tools)
- **Data:** Synthetic task data + simulated resource loads (Phase 2-3)
- **Expertise:** Learning required for modern frameworks (React, Node.js)

---

## 5. EXISTING SOLUTIONS ANALYSIS

| Solution | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| **Kubernetes** | Industry standard, highly scalable | Extremely complex, steep learning curve | Too enterprise-focused, not educational |
| **OpenStack** | Comprehensive cloud infrastructure | Requires dedicated team, massive setup | Not suitable for 3-person team |
| **AWS Lambda** | Fully managed, automatic scaling | Proprietary, vendor lock-in, expensive | Not accessible for open-source project |
| **Apache YARN** | Distributed resource manager | Hadoop-specific, not general-purpose | Limited to Hadoop ecosystem |
| **Apache Mesos** | Flexible resource abstraction | Steep learning curve, complex config | Difficult to understand and extend |
| **FIFO/Round-Robin** | Simple to implement | Suboptimal, ignores task priority | Baseline for comparison only |
| **Our Approach** | Educational, extensible, ML-integrated | Requires implementation effort | ✅ Perfect for study project |

**Gap Identified:** No system combines user-friendly interface + intelligent scheduling + ML integration + open-source + educational focus.

---

## 6. PROPOSED SOLUTION

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│             USER INTERFACE (React.js)                       │
│  • Task Dashboard  • Resource Monitor  • Performance Charts │
└────────────────────────┬────────────────────────────────────┘
                         │ (REST API + WebSocket)
┌────────────────────────▼────────────────────────────────────┐
│           BACKEND (Node.js + Express.js)                    │
│  ├─ REST API Endpoints (20-30 endpoints)                    │
│  ├─ Scheduler Engine (Heuristic algorithm)                  │
│  ├─ ML Service Integration (call prediction API)            │
│  └─ WebSocket Handler (real-time updates)                   │
└────────┬───────────────────────┬──────────────────┬─────────┘
         │                       │                  │
    ┌────▼────┐        ┌────────▼────────┐   ┌─────▼─────┐
    │PostgreSQL│       │  Python ML API   │   │ Job Queue │
    │ Database │       │    (Flask)       │   │  (Redis)  │
    └──────────┘       │ • Prediction     │   └───────────┘
                       │ • Model Update   │
                       └──────────────────┘
```

### 6.2 Key Components

**1. Scheduler Engine**
- Input: Task queue (priority, deadline, size), Resource status (capacity, load)
- Algorithm: Priority-based with deadline awareness + ML prediction
- Output: Task → Resource assignment, Expected completion time

**2. ML Prediction Module**
- Model: Linear/Random Forest Regression
- Input: Task type, data size, resource load, time of day
- Output: Predicted execution time (confidence score)
- Training: Historical task data (collected during Phase 2-3)

**3. Web Interface**
- Dashboard: Real-time task status, resource utilization
- Task Management: Create/update/delete tasks
- Analytics: Performance comparison charts
- Monitoring: Resource health, queue status

**4. REST API**
- Task operations: POST /tasks, GET /tasks, PUT /tasks/:id, DELETE /tasks/:id
- Resource operations: GET /resources, POST /resources
- Scheduler operations: POST /schedule, GET /schedule-history
- Analytics: GET /metrics, GET /comparison

---

## 7. TECHNOLOGY STACK AND JUSTIFICATION

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Frontend** | React.js | 18+ | Component-based, reusable, real-time capable |
| **State Mgmt** | Redux/Zustand | Latest | Complex state, debugging tools |
| **Styling** | Tailwind CSS | Latest | Rapid development, responsive |
| **Charts** | Recharts | Latest | Beautiful visualizations, React-integrated |
| **Backend** | Node.js | 18+ | Non-blocking I/O, WebSocket support |
| **Framework** | Express.js | 4.18+ | Lightweight, flexible, well-documented |
| **Language** | TypeScript | 4.9+ | Type safety, better IDE support |
| **ORM** | Prisma | 4.0+ | Simple syntax, type-safe queries |
| **Database** | PostgreSQL | 13+ | ACID compliance, JSON support |
| **ML Service** | Python | 3.9+ | Rich ecosystem, easy to learn |
| **ML Library** | scikit-learn | 1.0+ | Simple, interpretable, no GPU needed |
| **ML Framework** | Flask | 2.2+ | Lightweight, perfect for microservice |
| **Containerization** | Docker | Latest | Environment consistency |
| **Testing** | Jest | 29+ | Unit testing, coverage reporting |
| **CI/CD** | GitHub Actions | Latest | Free, integrated with GitHub |

### Why This Stack?
- ✅ **Full JavaScript/Node.js stack** for unified development
- ✅ **Python for ML** (industry standard, easy to learn)
- ✅ **PostgreSQL** for reliable, queryable data
- ✅ **Docker** for consistent deployment
- ✅ **Zero cost** (all open-source)
- ✅ **Industry-relevant** (used at major tech companies)
- ✅ **Learning-friendly** (extensive tutorials, large community)

---

## 8. PROJECT TIMELINE

### Phase 1: Study & Planning (Weeks 1-3) ✅ **CURRENT**
- Problem identification and research
- Literature review (research papers, existing solutions)
- Team role assignment
- Technology selection and justification
- **Deliverable:** This proposal document + GitHub repository setup

### Phase 2: Design & Proof of Concept (Weeks 4-5)
- System architecture design and documentation
- Database schema design
- API specification (OpenAPI/Swagger)
- Module-wise design breakdown
- **Deliverable:** Architecture diagram, SRS, PoC prototype

### Phase 3: Implementation & Testing (Weeks 6-9)
- Frontend development (UI components, pages, real-time updates)
- Backend development (API endpoints, scheduler engine)
- ML model training and integration
- Unit testing and integration testing
- Performance evaluation and comparison
- **Deliverable:** Full working prototype, test results

### Final Phase: Documentation & Submission (Weeks 10-12)
- Comprehensive documentation
- Deployment guide and Docker setup
- Final presentation preparation
- Code review and refactoring
- **Deliverable:** Complete project documentation, working code, presentation

---

## 9. TEAM ROLES AND RESPONSIBILITIES

### Member 1: Backend & Scheduler Lead
**Responsibilities:**
- Design and implement REST API (20-30 endpoints)
- Implement heuristic-based scheduler engine
- Database design and schema management using Prisma ORM
- Integration with ML service
- WebSocket implementation for real-time updates
- Testing (unit tests for scheduler algorithm)

**Technology:** Node.js, Express, TypeScript, PostgreSQL, Prisma, Jest

### Member 2: Frontend & UI Lead
**Responsibilities:**
- Design system and component architecture
- Implement React components for all pages
- Create dashboard with real-time metrics
- Data visualization (Recharts for charts/graphs)
- State management (Redux/Zustand setup)
- WebSocket client integration
- Responsive design (mobile + desktop)

**Technology:** React, TypeScript, Tailwind CSS, Recharts, Redux

### Member 3: ML, DevOps & Testing Lead
**Responsibilities:**
- Machine learning model development (execution time prediction)
- Flask REST API for ML predictions
- Feature engineering from historical task data
- Model training and validation
- Docker containerization (backend, frontend, ML service)
- GitHub Actions CI/CD pipeline setup
- Performance testing and load testing

**Technology:** Python, scikit-learn, Flask, Docker, GitHub Actions

---

## 10. FEASIBILITY ASSESSMENT

### 10.1 Technical Feasibility ✅
- All technologies are well-documented with extensive community support
- No cutting-edge or unproven technologies
- Modular architecture allows parallel development
- Simple ML model (no complex deep learning required)

### 10.2 Economic Feasibility ✅
- All tools are open-source and free
- No infrastructure costs (free tier cloud platforms available)
- No hardware requirements (standard laptops sufficient)

### 10.3 Time Feasibility ✅
- 12-week timeline is realistic for scope
- Phase-wise breakdown prevents overcommitment
- Buffer time included in schedule

### 10.4 Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Tech learning curve | Medium | Medium | Week 1-2 learning sprint, tutorials |
| Team member issues | Low | High | Documentation, knowledge sharing |
| Scope creep | Medium | Medium | Strict phase boundaries, clear scope |
| ML model accuracy | Low | Low | Multiple algorithms, fallback to heuristic |
| Integration issues | Medium | Medium | Early integration testing |

---

## 11. EXPECTED OUTCOMES

### By End of Study Project (Phase 3)

1. **Working Software System**
   - Fully functional web application with UI
   - REST API with 25+ endpoints
   - Heuristic scheduler passing unit tests
   - ML predictions integrated and working

2. **Quantifiable Results**
   - Intelligent scheduling: 20-30% better than FCFS
   - ML prediction accuracy: >85% (RMSE < 15% of actual)
   - System latency: <100ms for 1000 tasks
   - 80%+ code test coverage

3. **Documentation**
   - Architecture diagrams and design documents
   - API documentation (Swagger/OpenAPI)
   - Deployment and installation guides

4. **Professional Deliverables**
   - GitHub repository with clear commit history
   - Docker images for easy deployment
   - CI/CD pipeline with automated testing
   - Presentation slides and demo video

---

## 12. ORIGINAL CONTRIBUTIONS

Our project makes the following original contributions:

1. **Research → Real Software**  
   Converting simulation-only research into a deployable full-stack application

2. **ML-Assisted Scheduling**  
   Integrating machine learning for execution time prediction (not in original paper)

3. **Explainability & Visualization**  
   Visual explanation of scheduling decisions (unlike black-box enterprise systems)

4. **Educational System**  
   Configurable, understandable system for learning and demonstration

---

## 13. REFERENCES

1. Wang, J., & Li, D. (2019). "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing." *Sensors*, 19(5), 1023. DOI: 10.3390/s19051023

2. Buyya, R., Ranjan, R., & Calheiros, R. N. (2009). "Cloud computing: A taxonomy of platforms and infrastructure." *Journal of Network and Computer Applications*, 32(1), 11-24.

3. Apache Kubernetes Community. (2024). "Kubernetes Documentation." https://kubernetes.io/docs/

4. Pedregosa, F., et al. (2011). "Scikit-learn: Machine learning in Python." *Journal of Machine Learning Research*, 12, 2825-2830.

5. Facebook Research. (2023). "React Documentation." https://react.dev/

6. Express.js Foundation. (2023). "Express.js Guide." https://expressjs.com/

7. PostgreSQL Global Development Group. (2024). "PostgreSQL Documentation." https://www.postgresql.org/docs/

---

## 14. APPENDIX A: System Architecture Diagram

```
                    ┌─────────────────────┐
                    │   Web Browser       │
                    │  (User Interface)   │
                    └──────────┬──────────┘
                               │ HTTP/WebSocket
                    ┌──────────▼──────────┐
                    │  React Frontend     │
                    │  • Dashboard        │
                    │  • Task Manager     │
                    │  • Analytics        │
                    └──────────┬──────────┘
                               │ REST API
                    ┌──────────▼──────────┐
        ┌───────────┤  Node.js Backend    │
        │           │  • REST API         │
        │           │  • Scheduler        │
        │           │  • WebSocket        │
        │           └──────────┬──────────┘
        │                      │
   ┌────▼─────┐  ┌────────────▼────┐  ┌────────────┐
   │PostgreSQL│  │  Python ML API  │  │   Redis    │
   │ Database │  │    (Flask)      │  │   Queue    │
   │          │  │  • Predictions  │  │            │
   └──────────┘  └─────────────────┘  └────────────┘
```

---

## 15. APPENDIX B: Project Timeline (Gantt Chart)

```
Phase 1: Study & Planning (Weeks 1-3)
├─ Literature Review               ████████░░░░░░ Week 1-2
├─ Technology Research             ████░░░░░░░░░░ Week 1
├─ Architecture Planning           ░░████░░░░░░░░ Week 2-3
└─ Proposal Submission             ░░░░████░░░░░░ Week 3

Phase 2: Design & PoC (Weeks 4-5)
├─ Database Design                 ████░░░░░░░░░░ Week 4
├─ API Specification               ░░████░░░░░░░░ Week 4-5
├─ Frontend PoC                    ░░░░██░░░░░░░░ Week 5
└─ ML Model Prototype              ░░░░██░░░░░░░░ Week 5

Phase 3: Implementation (Weeks 6-9)
├─ Backend Development             ████████░░░░░░ Week 6-8
├─ Frontend Development            ████████░░░░░░ Week 6-8
├─ ML Integration                  ░░░░████░░░░░░ Week 7-8
├─ Testing & Bug Fixes             ░░░░░░████░░░░ Week 8-9
└─ Performance Optimization        ░░░░░░░░██░░░░ Week 9

Final: Documentation (Weeks 10-12)
├─ Code Documentation              ████░░░░░░░░░░ Week 10
├─ User Guide & Deployment         ░░████░░░░░░░░ Week 10-11
├─ Final Testing                   ░░░░████░░░░░░ Week 11
└─ Presentation Preparation        ░░░░░░██████░░ Week 11-12
```

---

## SUBMISSION INFORMATION

**Document:** Phase1_Study_Project_Proposal.pdf  
**Submitted By:** [Your Name], [Member 2 Name], [Member 3 Name]  
**Date:** January 15, 2026  
**Course:** BCS ZC241T - Study Project (5 units)  
**Semester:** 5 (Year 3, Term 2)  
**Institution:** BITS Pilani Online  

---

**This proposal is hereby submitted for review and approval to proceed to Phase 2 (Design & PoC).**

*End of Proposal*
