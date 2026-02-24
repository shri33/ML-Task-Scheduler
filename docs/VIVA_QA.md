# Viva Q&A - Interview Preparation

## 🎯 How to Use This Document

1. Read each question
2. Memorize the **short answer**
3. Understand the **detailed answer** for follow-ups
4. Practice saying answers out loud

---

## 📌 BASIC PROJECT QUESTIONS

### Q1: What is your project about?
**Short Answer:**
> "Our project is a full-stack web application that intelligently assigns tasks to available resources. We use machine learning to predict task execution time, which helps the scheduler make better decisions."

**Detailed Answer:**
> "We are building an intelligent task allocation and scheduling system. The system takes computational tasks submitted by users and assigns them to available resources like servers or machines. The key innovation is that we use a machine learning model to predict how long each task will take to execute. This prediction helps the scheduler make more accurate assignment decisions compared to traditional approaches that assume fixed execution times."

---

### Q2: What problem are you solving?
**Short Answer:**
> "We are solving the task-to-resource assignment problem. The challenge is deciding which task should go to which resource, and in what order."

**Detailed Answer:**
> "In any computing environment, whether it's cloud servers, fog nodes, or even office workstations, multiple tasks compete for limited resources. The problem is: how do we efficiently assign tasks to resources to minimize total completion time, reduce resource idle time, and meet priority requirements? Traditional approaches like First-Come-First-Serve don't consider task characteristics. Our system uses intelligent scheduling with ML-assisted prediction to make better decisions."

---

### Q3: Is this solution already available in the market?
**Short Answer:**
> "Similar components exist separately, but our specific combination of features does not exist as an accessible, educational, open-source system."

**Detailed Answer:**
> "Yes, enterprise schedulers like Kubernetes exist, but they are extremely complex and not designed for learning or demonstration. Research papers propose algorithms but only run simulations without real implementations. Our contribution is unique because we:
> 1. Convert research into working software
> 2. Add ML-based execution time prediction (not in the paper)
> 3. Provide visual explainability
> 4. Build an educational, configurable system
> 
> No existing tool combines all these features in an accessible way."

---

### Q4: What is YOUR contribution? What is new?
**Short Answer:**
> "Our contribution is converting simulation-only research into a real full-stack system with ML-assisted prediction and visual explainability."

**Detailed Answer (memorize these 4 points):**
> 1. **Research to Software:** The reference paper only has simulations. We built a real, deployable web application.
> 2. **ML Integration:** The original paper uses fixed execution times. We added ML to predict execution time dynamically.
> 3. **Explainability:** Our system shows WHY a task was assigned to a specific resource, unlike black-box enterprise solutions.
> 4. **Educational Focus:** Users can configure parameters and see how scheduling decisions change.

---

## 🤖 ML-SPECIFIC QUESTIONS

### Q5: What AI/ML is used in this project?
**Short Answer:**
> "We use Machine Learning, specifically regression models, to predict task execution time."

**Detailed Answer:**
> "We use supervised learning - specifically regression - to predict execution time. The model takes features like task size, task type, priority, and current resource load. It outputs a predicted execution time in seconds. We use an ensemble model — **Random Forest** as the primary, with **XGBoost** and **Gradient Boosting** as alternatives. This is NOT deep learning, NOT classification, NOT NLP."

---

### Q6: Why do you need ML? Can't you just use rules?
**Short Answer:**
> "Rules assume fixed execution times, but real tasks vary. ML learns from historical data and provides accurate predictions."

**Detailed Answer:**
> "Traditional schedulers assume 'Task Type A takes 5 seconds, Task Type B takes 10 seconds.' But in reality, execution time depends on many factors: current resource load, task data size, time of day, etc. ML learns these patterns from historical execution data and provides more realistic predictions. This leads to better scheduling decisions - we expect 20-25% improvement in average completion time."

---

### Q7: What model are you using?
**Short Answer:**
> "Random Forest as the primary model, with XGBoost and Gradient Boosting as alternatives. All are ensemble methods — accurate yet explainable."

**Detailed Answer:**
> "We chose **Random Forest** as our primary model because:
> 1. It's an ensemble of decision trees — more accurate than a single model
> 2. No GPU required
> 3. Works well with small datasets and handles non-linear relationships
> 4. Feature importance is easy to interpret
> 
> We also support **XGBoost** (if installed) for even better accuracy, and **Gradient Boosting** as a fallback. We are NOT using neural networks or deep learning because the problem doesn't require that complexity."

---

### Q8: Where does the training data come from?
**Short Answer:**
> "The system generates its own training data from actual task executions."

**Detailed Answer:**
> "We use synthetic data initially, then the system learns from real executions:
> 1. Phase 2: We create synthetic training data with realistic distributions
> 2. Phase 3: As users run tasks, actual execution times are recorded
> 3. This historical data trains and improves the ML model
> 
> This is called 'online learning' or 'continuous learning' - the system gets smarter over time."

---

### Q9: What are the input features for ML?
**Short Answer:**
> "Task size, task type, priority, current resource load, and historical average time."

**Detailed Answer:**
```
Input Features:
├── Task Size (Small/Medium/Large → 1/2/3)
├── Task Type (CPU/IO/Mixed → 1/2/3)
├── Priority (1-5)
├── Resource CPU Load (0-100%)
├── Resource Memory Load (0-100%)
└── Historical Avg Time for Similar Tasks

Output:
└── Predicted Execution Time (seconds)
```

---

## 🏗️ ARCHITECTURE QUESTIONS

### Q10: Explain your system architecture.
**Short Answer:**
> "Three-tier architecture: React frontend, Node.js backend with scheduler, and Python ML service. PostgreSQL for storage."

**Detailed Answer:**
> "Our system has four main components:
> 1. **Frontend (React):** User interface for task submission, monitoring, and visualization
> 2. **Backend (Node.js/Express):** REST API, scheduling engine, business logic
> 3. **ML Service (Python/Flask):** Lightweight prediction API
> 4. **Database (PostgreSQL):** Stores tasks, resources, execution history
> 
> Data flow: User creates task → Backend stores task → Scheduler asks ML for prediction → Scheduler assigns task → Results shown to user"

---

### Q11: Why did you choose this tech stack?
**Short Answer:**
> "Industry-standard, well-documented, free, and our team has experience with these technologies."

**Detailed Answer:**
| Technology | Justification |
|------------|---------------|
| React | Industry standard, component-based, good for dashboards |
| Node.js | Full JavaScript stack, non-blocking, WebSocket support |
| Python/Flask | Best for ML, scikit-learn ecosystem, lightweight |
| PostgreSQL | ACID compliance, JSON support, free |
| Docker | Consistent deployment, easy to demonstrate |

---

### Q12: Why separate ML service? Why not include in backend?
**Short Answer:**
> "Separation of concerns - different languages, different deployment needs, easier to update."

**Detailed Answer:**
> "We use microservices architecture for several reasons:
> 1. **Language choice:** ML is best in Python, backend is best in Node.js
> 2. **Independent scaling:** ML can be scaled separately if needed
> 3. **Easy updates:** Can update ML model without touching backend
> 4. **Clear responsibility:** Each service does one thing well
> 
> This is industry best practice for ML integration."

---

## 📊 TECHNICAL QUESTIONS

### Q13: Explain the scheduling algorithm.
**Short Answer:**
> "Priority-based scheduling enhanced with ML-predicted execution time. Higher priority and shorter predicted time = scheduled first."

**Detailed Answer:**
> "Our scheduling algorithm works in these steps:
> 1. **Get pending tasks** from queue
> 2. **For each task,** call ML to get predicted execution time
> 3. **Calculate score:** Score = 0.4 × (100 - load) / 100 + 0.3 × (1 - predictedTime / 20) + 0.3 × (priority / 5)
> 4. **Sort tasks** by score (highest first)
> 5. **For each task,** find resource with lowest load that can handle it
> 6. **Assign task** to selected resource
> 7. **Update** resource load and task status
> 
> This is a greedy heuristic approach inspired by the reference paper."

---

### Q14: What APIs does your system have?
**Short Answer:**
> "CRUD for tasks and resources, scheduling endpoint, prediction endpoint, and analytics endpoints."

**Detailed Answer:**
```
API Endpoints:

Tasks:
  POST   /api/tasks          - Create task
  GET    /api/tasks          - List all tasks
  GET    /api/tasks/:id      - Get single task
  PUT    /api/tasks/:id      - Update task
  DELETE /api/tasks/:id      - Delete task

Resources:
  GET    /api/resources      - List resources
  POST   /api/resources      - Add resource

Scheduling:
  POST   /api/schedule       - Run scheduler
  GET    /api/schedule-history - View past decisions

ML:
  POST   /api/predict-time   - Get prediction

Analytics:
  GET    /api/metrics        - Performance metrics
  GET    /api/comparison     - ML vs Non-ML comparison
```

---

### Q15: How do you handle errors?
**Short Answer:**
> "Try-catch blocks, proper HTTP status codes, logging, and fallback to default values if ML fails."

**Detailed Answer:**
> "Error handling strategy:
> 1. **API errors:** Return proper status codes (400, 404, 500) with error messages
> 2. **ML service down:** Scheduler falls back to default execution time estimate
> 3. **Database errors:** Transaction rollback, retry logic
> 4. **Validation:** All inputs validated before processing
> 5. **Logging:** All errors logged for debugging
> 
> The system degrades gracefully - if ML fails, scheduling still works with reduced accuracy."

---

## 📅 FEASIBILITY QUESTIONS

### Q16: Is this feasible in 6-9 months?
**Short Answer:**
> "Yes, absolutely. We have a clear phase-wise breakdown, known technologies, and realistic scope."

**Detailed Answer:**
> "Our timeline:
> - **Phase 1 (Jan):** Problem identification, proposal - DONE
> - **Phase 2 (Feb-Mar):** Architecture, database, basic API
> - **Phase 3 (Apr-May):** Full implementation, ML integration, testing
> - **Capstone (Jun-Aug):** Deployment, optimization, paper writing
> 
> The ML is straightforward (Random Forest ensemble), the architecture is standard (REST API), and we have 3 team members with clear roles. This is well within scope."

---

### Q17: What are the risks and how will you mitigate them?
**Short Answer:**
> "Main risks are learning curve and scope creep. We mitigate with tutorials and strict phase boundaries."

**Detailed Answer:**
| Risk | Probability | Mitigation |
|------|-------------|------------|
| Tech learning curve | Medium | Start with tutorials, simple features first |
| Scope creep | Medium | Strict phase-wise scope, no extras until core done |
| ML model poor accuracy | Low | Simple baseline model, can improve later |
| Team coordination | Low | Weekly meetings, shared repository, clear roles |
| Time overrun | Medium | Buffer time in schedule, prioritize core features |

---

### Q18: Do you need to spend any money?
**Short Answer:**
> "No, zero cost. All tools are free and open-source."

**Detailed Answer:**
| Item | Cost |
|------|------|
| Development tools (VS Code, Git) | Free |
| Frontend framework (React) | Free |
| Backend (Node.js) | Free |
| ML (Python, scikit-learn) | Free |
| Database (PostgreSQL) | Free |
| Hosting (Render/Vercel free tier) | Free |
| Design (Figma free plan) | Free |

---

## 🎓 ACADEMIC QUESTIONS

### Q19: What is the reference paper?
**Short Answer:**
> "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing by Wang & Li, published in Sensors journal, 2019."

**Detailed Answer:**
> "The reference paper proposes a hybrid heuristic algorithm combining PSO and ACO for task scheduling in fog computing environments. It evaluates the approach through MATLAB simulations, showing reduced delay and energy consumption. However, it lacks real-world implementation, user interface, and ML integration - which are our contributions."

---

### Q20: How is your project different from the paper?
**Short Answer:**
> "The paper only has simulation. We build real software with UI, ML prediction, and deployment."

**Detailed Answer:**
| Aspect | Paper | Our Project |
|--------|-------|-------------|
| Implementation | MATLAB simulation | Real web application |
| User interface | None | Full React dashboard |
| ML integration | No | Yes (execution time prediction) |
| Explainability | No | Visual explanation of decisions |
| Deployment | No | Docker + cloud deployment |
| Data persistence | No | PostgreSQL database |

---

## 💡 QUICK FIRE ROUND (1-2 word answers)

| Question | Answer |
|----------|--------|
| Frontend framework? | React |
| Backend language? | Node.js/TypeScript |
| ML language? | Python |
| ML library? | scikit-learn |
| Database? | PostgreSQL |
| Type of ML? | Regression |
| ML model? | Random Forest (with XGBoost/GB alternatives) |
| Deployment? | Docker |
| Team size? | 3 members |
| Duration? | 6-9 months |
| Cost? | Zero |
| Is this AI project? | No, full-stack with ML assist |

---

## 🔥 CONFIDENCE BOOSTERS

### If you don't know an answer:
> "That's a good question. I haven't explored that specific aspect yet, but I can look into it and get back to you."

### If asked about something out of scope:
> "That's beyond our current scope, but it could be a good future enhancement."

### If asked to justify simplicity:
> "Simplicity is intentional. Our goal is a working, explainable system, not unnecessary complexity. Simple systems are easier to maintain, debug, and explain."

---

*Practice these answers out loud. Confidence comes from preparation!*
