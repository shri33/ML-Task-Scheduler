# B.Sc. (CS) - Software Development Project Proposal

---

## Project Information

| Field | Details |
|-------|---------|
| **Course Title** | BCS ZC241T - Study Project |
| **Project Title** | Intelligent Task Allocation and Scheduling System with ML-Assisted Optimization |
| **Student(s) Name(s)** | Shri Srivastava, Ichha Dwivedi, Aditi Singh |
| **Student(s) ID(s)** | 2023ebcs593, 2023ebcs125, 2023ebcs498 |
| **Team Name** | Byte_hogs |
| **Project Advisor/Supervisor** | [To be assigned] |
| **Date of Submission** | January 15, 2026 |

---

## 1. Project Idea Summary

### Title of Project
**Intelligent Task Allocation and Scheduling System with Machine Learning-Assisted Execution Time Prediction**

### Abstract
This project aims to develop a full-stack web application that intelligently allocates computational tasks to available resources using a research-based scheduling algorithm enhanced with machine learning predictions. The system converts academic research on task scheduling (Wang & Li, 2019) into a practical, deployable application with a user-friendly interface. The anticipated outcome is a working system that demonstrates 20-25% improvement in task completion time compared to traditional scheduling approaches, along with visual explainability of scheduling decisions.

---

## 2. Project Background and Motivation

### Problem Statement
In distributed computing environments, efficiently allocating multiple computational tasks to limited resources is a critical challenge. Current solutions fall into two extremes:

1. **Simple algorithms** (FCFS, Round-Robin): Easy to implement but suboptimal, leading to 25-40% performance degradation due to ignoring task priorities and resource states.

2. **Enterprise systems** (Kubernetes, OpenStack): Highly sophisticated but require extensive infrastructure, expertise, and are inaccessible to small organizations and educational institutions.

**The Gap:** No production-ready, user-friendly system exists that combines intelligent scheduling with machine learning prediction for practical, deployable real-world use cases that is also accessible and educational.

### Motivation
The motivation behind this project stems from:

1. **Academic Foundation:** The research paper "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing" (Wang & Li, 2019) proposes effective scheduling algorithms but only provides simulation results without real-world implementation.

2. **Practical Need:** There is a growing demand for intelligent resource management in cloud computing, fog computing, and edge computing environments.

3. **Educational Value:** Students and practitioners need accessible systems to understand and experiment with scheduling algorithms and ML integration.

4. **Career Relevance:** Building a full-stack system with ML integration provides hands-on experience valuable for software engineering careers.

**Potential Impact:** The solution will bridge the gap between academic research and practical implementation, providing an educational tool for understanding intelligent scheduling while being extensible for real-world applications.

---

## 3. Objectives

### Primary Objectives

1. **Design and implement a real-time task scheduling system** that converts academic research into a functional, deployable web application.

2. **Develop a heuristic-based scheduler** that outperforms baseline algorithms (FCFS, Round-Robin) by at least 20% in average task completion time.

3. **Integrate machine learning** for execution time prediction using regression models (Linear Regression/Random Forest) to improve scheduling accuracy.

4. **Create a user-friendly web interface** that allows users to submit tasks, monitor resources, and visualize scheduling decisions with explainability.

5. **Compare and evaluate** intelligent scheduling vs. baseline scheduling with quantifiable metrics (latency, throughput, resource utilization).

### Secondary Objectives

1. Implement real-time updates using WebSockets for live task status monitoring.

2. Containerize the application using Docker for consistent deployment.

3. Create comprehensive API documentation using OpenAPI/Swagger standards.

4. Develop automated testing with >80% code coverage.

5. Prepare the system for cloud deployment in the capstone phase.

---

## 4. Project Scope and Expected Deliverables

### Scope Definition

#### In Scope
| Feature | Description |
|---------|-------------|
| Task Management | Create, view, update, delete tasks with priority and deadline |
| Resource Management | Monitor resource capacity, load, and availability |
| Scheduler Engine | Heuristic-based, priority-aware scheduling algorithm |
| ML Prediction Module | Execution time prediction using regression models |
| Web Dashboard | Task submission, resource monitoring, performance visualization |
| Performance Comparison | Intelligent vs. baseline algorithm comparison |
| RESTful API | Complete API for all operations (25+ endpoints) |
| Real-time Updates | WebSocket-based live status updates |
| Containerization | Docker setup for deployment |

#### Out of Scope (Limitations)
- Distributed consensus algorithms (Raft, Paxos)
- GPU/Tensor processing acceleration
- Multi-cloud federation
- Commercial-grade security (beyond basic authentication)
- Advanced reinforcement learning models
- Production deployment (reserved for Capstone phase)

### Deliverables

#### Software Solution
| Deliverable | Description |
|-------------|-------------|
| Frontend Application | React-based dashboard with task management and visualization |
| Backend API | Node.js/Express RESTful API with scheduler engine |
| ML Service | Python/Flask microservice for execution time prediction |
| Database | PostgreSQL schema for tasks, resources, and history |
| Docker Setup | Containerized deployment configuration |

#### Documentation
| Document | Description |
|----------|-------------|
| Technical Documentation | Architecture diagrams, API specifications, database schema |
| User Manual | Step-by-step guide for using the application |
| Installation Guide | Setup instructions for development and deployment |
| API Documentation | Swagger/OpenAPI specification for all endpoints |

#### Additional Assets
| Asset | Description |
|-------|-------------|
| Presentation Slides | Project overview and demonstration slides |
| Demo Video | 5-10 minute video showcasing system functionality |
| GitHub Repository | Complete source code with documentation |
| Figma Prototype | UI/UX wireframes and interactive prototype |

---

## 5. Preliminary Project Timeline and Milestones

### Proposed Schedule

| Phase | Duration | Activities | Deliverables |
|-------|----------|------------|--------------|
| **Phase 1: Planning** | Week 1-3 (Jan 2026) | Problem identification, literature review, technology selection, proposal writing | Project Proposal, GitHub repo setup |
| **Phase 2: Design** | Week 4-5 (Feb 2026) | System architecture, database design, API specification, UI wireframes | SRS Document, Architecture diagrams |
| **Phase 3: Development** | Week 6-9 (Mar-Apr 2026) | Frontend, backend, ML service implementation, integration | Working prototype |
| **Phase 4: Testing** | Week 10-11 (May 2026) | Unit testing, integration testing, performance evaluation | Test reports, bug fixes |
| **Phase 5: Documentation** | Week 12 (May 2026) | Final documentation, presentation preparation | Complete documentation |
| **Capstone** | Jun-Aug 2026 | Cloud deployment, optimization, paper writing | Deployed application |

### Key Milestones

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| Proposal Approval | Jan 15, 2026 | Supervisor sign-off on project proposal |
| Architecture Complete | Feb 15, 2026 | SRS document and architecture diagrams approved |
| Backend API Ready | Mar 15, 2026 | All API endpoints functional with tests |
| ML Service Integrated | Apr 1, 2026 | Prediction service working with scheduler |
| Frontend Complete | Apr 15, 2026 | Dashboard fully functional |
| Testing Complete | May 15, 2026 | >80% test coverage, all critical bugs fixed |
| Final Submission | May 31, 2026 | Complete system with documentation |

---

## 6. Team Structure and Collaboration

### Roles and Responsibilities

| Team Member | Role | Responsibilities |
|-------------|------|------------------|
| **Shri Srivastava** (2023ebcs593) | Backend Lead & Team Lead | REST API development (Node.js/Express), Scheduler engine implementation, Database design (PostgreSQL/Prisma), ML service integration, WebSocket implementation, Overall project coordination |
| **Ichha Dwivedi** (2023ebcs125) | Frontend Lead | React application development, Dashboard and visualization components, State management (Redux/Zustand), Responsive design (Tailwind CSS), WebSocket client integration, UI/UX design in Figma |
| **Aditi Singh** (2023ebcs498) | ML & DevOps Lead | ML model development (Python/scikit-learn), Flask API for predictions, Docker containerization, GitHub Actions CI/CD pipeline, Testing framework setup, Performance testing |

### Collaboration Plan

#### Communication Methods
| Method | Frequency | Purpose |
|--------|-----------|---------|
| WhatsApp Group | Daily | Quick updates, questions, file sharing |
| Weekly Video Call | Weekly (Sunday) | Progress review, planning, problem-solving |
| GitHub Issues | As needed | Bug tracking, feature requests |
| Status Reports | Weekly | Written progress updates to supervisor |

#### Version Control Practices
- **Repository:** GitHub (private repository)
- **Branching Strategy:** Git Flow (main, develop, feature branches)
- **Code Reviews:** All pull requests require at least one team member review
- **Commit Convention:** Conventional commits (feat:, fix:, docs:, etc.)

#### Task Management
- **Tool:** GitHub Projects / Trello
- **Sprint Duration:** 2 weeks
- **Daily Standup:** Async updates in WhatsApp group

---

## 7. Supervisor Review and Approval

### Advisor Feedback

| Section | Feedback | Status |
|---------|----------|--------|
| Project Scope | | ☐ Approved ☐ Needs Revision |
| Timeline | | ☐ Approved ☐ Needs Revision |
| Technical Approach | | ☐ Approved ☐ Needs Revision |
| Team Structure | | ☐ Approved ☐ Needs Revision |

### Comments and Recommendations

```
[Space for supervisor comments]






```

### Approval

| Field | Details |
|-------|---------|
| Supervisor Name | |
| Signature | |
| Date | |
| Approval Status | ☐ Approved ☐ Conditionally Approved ☐ Revision Required |

---

## References

1. Wang, J., & Li, D. (2019). "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing." *Sensors*, 19(5), 1023. DOI: 10.3390/s19051023

2. Buyya, R., Ranjan, R., & Calheiros, R. N. (2009). "Cloud computing: A taxonomy of platforms and infrastructure." *Journal of Network and Computer Applications*, 32(1), 11-24.

3. Pedregosa, F., et al. (2011). "Scikit-learn: Machine learning in Python." *Journal of Machine Learning Research*, 12, 2825-2830.

---

*Submitted by Team Byte_hogs | BITS Pilani Online | January 2026*
