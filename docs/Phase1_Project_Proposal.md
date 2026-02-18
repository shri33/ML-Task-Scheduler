Study Project -- Phase 1 Document
(Problem Identification & Planning)
Course Title:
BCS ZC241T - Study Project
Project Title:
Intelligent Task Allocation and Scheduling System with ML-Assisted Optimization
Student Name(s):
Shri Srivastava, Ichha Dwivedi, Aditi Singh
Student ID(s):
2023ebcs593, 2023ebcs125, 2023ebcs498
Group Number:
80
Project Advisor / Supervisor:
Swapnil Saurav
Date of Submission:
February 2, 2026

1. Project Idea Summary
Title of Project
Intelligent Task Allocation and Scheduling System with Machine Learning-Assisted Execution Time Prediction
Abstract
This project aims to develop a full-stack web application that intelligently allocates computational tasks to available resources using a research-based scheduling algorithm enhanced with machine learning predictions. The system converts academic research on task scheduling (Wang & Li, 2019) into a practical, deployable application with a user-friendly interface. The anticipated outcome is a working system that demonstrates 20-25% improvement in task completion time compared to traditional scheduling approaches, along with visual explainability of scheduling decisions.
2. Project Background and Motivation
Problem Statement
In distributed computing environments, efficiently allocating multiple computational tasks to limited resources is a critical challenge. Current solutions fall into two extremes:
•	Simple algorithms (FCFS, Round-Robin): Easy to implement but suboptimal, leading to 25-40% performance degradation due to ignoring task priorities and resource states.
•	Enterprise systems (Kubernetes, OpenStack): Highly sophisticated but require extensive infrastructure, expertise, and are inaccessible to small organizations and educational institutions.
The Gap: No production-ready, user-friendly system exists that combines intelligent scheduling with machine learning prediction for practical, deployable real-world use cases that are also accessible and educational.
Motivation
The motivation behind this project stems from:
•	Academic Foundation: The research paper "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing" (Wang & Li, 2019) proposes effective scheduling algorithms but only provides simulation results without real-world implementation.
•	Practical Need: There is a growing demand for intelligent resource management in cloud computing, fog computing, and edge computing environments.
•	Educational Value: Students and practitioners need accessible systems to understand and experiment with scheduling algorithms and ML integration.
•	Career Relevance: Building a full-stack system with ML integration provides hands-on experience valuable for software engineering careers.
Potential Impact: The solution will bridge the gap between academic research and practical implementation, providing an educational tool for understanding intelligent scheduling while being extensible for real-world applications.
3. Educational Value and Course Alignment
Relevance to Course Objectives
This project aligns with the course objectives through:
•	Software Development Lifecycle: Complete implementation from requirements gathering to deployment
•	Full-Stack Development: Integration of frontend, backend, and ML components
•	Algorithm Design: Implementation of research-based scheduling algorithms
•	Machine Learning Integration: Practical application of ML in software systems
•	Performance Optimization: Analysis and improvement of system efficiency
Learning Outcomes
Expected learning outcomes include:
•	Technical Skills: React, Node.js, Express, PostgreSQL, Python, scikit-learn, Docker
•	Analytical Skills: Algorithm analysis, performance evaluation, data modeling
•	Design Skills: System architecture, database design, API design, UI/UX design
•	DevOps: Containerization, CI/CD pipelines, version control practices
•	Documentation: Technical writing, API documentation, user guides
4. Objectives
Primary Objectives
•	Design and implement a real-time task scheduling system that converts academic research into a functional, deployable web application.
•	Develop a heuristic-based scheduler that outperforms baseline algorithms (FCFS, Round-Robin) by at least 20% in average task completion time.
•	Integrate machine learning for execution time prediction using regression models (Linear Regression/Random Forest) to improve scheduling accuracy.
•	Create a user-friendly web interface that allows users to submit tasks, monitor resources, and visualize scheduling decisions with explainability.
•	Compare and evaluate intelligent scheduling vs. baseline scheduling with quantifiable metrics (latency, throughput, resource utilization).
Secondary Objectives
•	Implement real-time updates using WebSocket’s for live task status monitoring.
•	Containerize the application using Docker for consistent deployment.
•	Create comprehensive API documentation using Open API/Swagger standards.
•	Develop automated testing with >80% code coverage.
•	Prepare the system for cloud deployment in the capstone phase.
5. Research and Analysis
Existing Solutions
Current task scheduling solutions include:
•	Basic Algorithms: FCFS, Round-Robin, and Shortest Job First are simple but ignore priorities and resource states, leading to suboptimal performance.
•	Enterprise Solutions: Kubernetes, OpenStack, and AWS ECS provide sophisticated scheduling but require significant infrastructure and expertise.
•	Academic Research: Many papers propose advanced algorithms but lack production-ready implementations.
Limitations: No middle-ground solution exists that is both intelligent and accessible for educational or small-scale deployment.
Functional Requirements
Key functionalities the system should support:
•	Task Management: Create, view, update, and delete tasks with priority and deadline
•	Resource Management: Monitor resource capacity, load, and availability
•	Scheduler Engine: Heuristic-based, priority-aware scheduling algorithm
•	ML Prediction Module: Execution time prediction using regression models
•	Web Dashboard: Task submission, resource monitoring, performance visualization
•	Performance Comparison: Intelligent vs. baseline algorithm comparison
•	RESTful API: Complete API for all operations (25+ endpoints)
•	Real-time Updates: WebSocket-based live status updates
Non-Functional Requirements
•	Usability: Intuitive interface with minimal learning curve
•	Performance: Sub-second response time for task scheduling decisions
•	Security: Basic authentication and authorization mechanisms
•	Scalability: Support for 100+ concurrent tasks
•	Maintainability: Clean code architecture with comprehensive documentation
Feasibility Analysis
•	Technical Feasibility: All required technologies (React, Node.js, Python, PostgreSQL) are mature and well-documented with extensive community support.
•	Time Feasibility: 12-week timeline is adequate for development, testing, and documentation with proper sprint planning.
•	Resource Constraints: Development can be performed on standard laptops; cloud resources are optional and cost-effective for testing.
6. Project Scope and Expected Deliverables
Scope Definition
In Scope
•	Task Management: Create, view, update, and delete tasks with priority and deadline
•	Resource Management: Monitor resource capacity, load, and availability
•	Scheduler Engine: Heuristic-based, priority-aware scheduling algorithm
•	ML Prediction Module: Execution time prediction using regression models
•	Web Dashboard: Task submission, resource monitoring, performance visualization
•	Performance Comparison: Intelligent vs. baseline algorithm comparison
•	RESTful API: Complete API for all operations (25+ endpoints)
•	Real-time Updates: WebSocket-based live status updates
•	Containerization: Docker setup for deployment
Out of Scope (Limitations)
•	Distributed consensus algorithms (Raft, Paxos)
•	GPU/Tensor processing acceleration
•	Multi-cloud federation
•	Commercial-grade security (beyond basic authentication)
•	Advanced reinforcement learning models
•	Production deployment (reserved for Capstone phase)
Assumptions and Constraints
•	Tasks are independent and non-preemptive
•	Resources are homogeneous for initial implementation
•	Network latency is minimal within the system
•	Development limited to 12-week semester timeline
Deliverables (Phase 1)
Software Solution
•	Frontend Application: React-based dashboard with task management and visualization
•	Backend API: Node.js/Express RESTful API with scheduler engine
•	ML Service: Python/Flask microservice for execution time prediction
•	Database: PostgreSQL schema for tasks, resources, and history
•	Docker Setup: Containerized deployment configuration
Documentation
•	Project proposal document (this document)
•	Problem definition and objectives
•	Literature review / background study
•	High-level system overview
•	Technical Documentation: Architecture diagrams, API specifications, database schema
•	User Manual: Step-by-step guide for using the application
•	Installation Guide: Setup instructions for development and deployment
Additional Assets
•	Presentation Slides: Project overview and demonstration slides
•	Demo Video: 5–10-minute video showcasing system functionality
•	GitHub Repository: Complete source code with documentation
•	Figma Prototype: UI/UX wireframes and interactive prototype
7. Preliminary Project Timeline and Milestones
Proposed Schedule
Phase	Duration	Activities	Deliverables
Phase 1: Planning	Week 1-3 (Jan 2026)	Problem identification, literature review, technology selection, proposal writing	Project Proposal, GitHub repo setup
Phase 2: Design	Week 4-5 (Feb 2026)	System architecture, database design, API specification, UI wireframes	SRS Document, Architecture diagrams
Phase 3: Development	Week 6-9 (Mar-Apr 2026)	Frontend, backend, ML service implementation, integration	Working prototype
Phase 4: Testing	Week 10-11 (May 2026)	Unit testing, integration testing, and performance evaluation	Test reports, bug fixes
Phase 5: Documentation	Week 12 (May 2026)	Final documentation, presentation preparation	Complete documentation
Capstone	Jun-Aug 2026	Cloud deployment, optimization, and paper writing	Deployed application
Key Milestones
Milestone	Target Date	Success Criteria
Proposal Approval	Jan 15, 2026	Supervisor sign-off on project proposal
Architecture Complete	Feb 15, 2026	SRS document and architecture diagrams approved
Backend API Ready	Mar 15, 2026	All API endpoints are functional with tests
ML Service Integrated	Apr 1, 2026	The prediction service is working with the scheduler
Frontend Complete	Apr 15, 2026	Dashboard fully functional
Testing Complete	May 15, 2026	>80% test coverage, all critical bugs fixed
Final Submission	May 31, 2026	Complete system with documentation
8. Team Structure and Collaboration
Roles and Responsibilities
Team Approach
Our team follows a collaborative, full-stack approach where all members contribute to all aspects of the project - frontend, backend, and machine learning. This ensures comprehensive learning, better code understanding, and shared ownership of the entire system.
Team Members
•	Shri Srivastava (2023ebcs593) - Team Leader
•	Ichha Dwivedi (2023ebcs125)
•	Aditi Singh (2023ebcs498)
Shared Responsibilities
All team members will work collectively on:
•	Frontend Development: Development of a React application, including dashboard components, UI/UX design, implementation of responsive layouts, and sophisticated state management.
•	Backend Development: Implementation of Node.js/Express-based RESTful APIs, development of a dedicated scheduler engine, comprehensive database design utilizing PostgreSQL and Prisma, and implementation of WebSocket technology for real-time communication.
•	Machine Learning: Development of machine learning models using Python and scikit-learn, establishment of a Flask API for serving predictions, extensive feature engineering, and rigorous model training and validation procedures.
•	DevOps & Testing: Application of Docker for containerization, establishment of continuous integration/continuous deployment (CI/CD) pipelines via GitHub Actions, comprehensive unit and integration testing, and dedicated performance testing.
•	Documentation: Creation of thorough technical documentation, detailed API documentation, user guides, and comprehensive inline code comments.
Collaboration Tools
•	WhatsApp Group: Daily quick updates, questions, and file sharing
•	Weekly Video Calls: Weekly/daily progress review, planning, problem-solving
•	GitHub Issues: Bug tracking, feature requests as needed
•	Status Reports: Weekly written progress updates to the supervisor
•	GitHub Repository: Private repository with Git Flow branching strategy
•	Code Reviews: All pull requests require at least one team member review
•	Task Management: GitHub Projects with 2-week sprints
9. Risk and Challenge Analysis
Identified Risks
•	Technical Complexity: Integrating multiple technologies (React, Node.js, Python, PostgreSQL) may present challenges
•	Algorithm Performance: Achieving the target 20% improvement over baseline may require iterative optimization
•	ML Model Accuracy: Training data quality and quantity may affect prediction accuracy
•	Time Constraints: 12-week timeline is tight for full-stack development with ML integration
•	Team Coordination: Ensuring consistent collaboration and avoiding integration conflicts
Mitigation Strategies
Algorithm Convergence Issues:
Use validated parameters from Wang and Li (2019), including 50 PSO/ACO iterations. Begin with small-scale tests (5 tasks, 3 servers) before scaling to 15 tasks and 5 servers. Implement Min-Min as a fallback and use unit tests to confirm at least a 40% makespan improvement over FCFS.
Integration Bugs:
Adopt modular development (algorithm → API → frontend). Use daily Git commits, Postman for API testing, and browser developer tools for WebSocket debugging. Allocate a 20%-time buffer for iterative integration and debugging.
Time Overruns:
Follow the defined timeline (Phase 1 documentation; prototype by Week 5). Prioritize an MVP consisting of the core hybrid heuristic scheduler and dashboard. Track weekly milestones using GitHub Issues.
Data/API Unavailability:
Rely on simulated datasets from the reference paper (15 tasks, 5 servers). Generate synthetic IoT data using Python scripts. Design APIs to support future MQTT-based real-time data integration
10. Supervisor Review and Approval
Advisor Feedback
All team members will work across the complete technology stack to ensure holistic system understanding and avoid siloed development.
PostgreSQL is adopted as the database system to align with the reference research paper and to strengthen practical database implementation skills.
Supervisor Comments
The supervisor appreciated the project proposal and acknowledged it as an innovative and forward-looking research direction. The concept aligns well with current academic and practical developments in intelligent systems and demonstrates strong potential for real-world impact. The supervisor expressed full support for continuing the project and encouraged the team to proceed with implementation and research.
Recommendations
The supervisor recommended that all team members actively participate in every layer of the project to gain complete technical exposure and avoid specialization silos.

Signature: Swapnil Saurav

Date: 31st January 2026
References
1. Wang, J., & Li, D. (2019). "Task Scheduling Based on a Hybrid Heuristic Algorithm for Smart Production Line with Fog Computing." Sensors, 19(5), 1023. DOI: 10.3390/s19051023
2. Buyya, R., Ranjan, R., & Calheiros, R. N. (2009). "Cloud computing: A taxonomy of platforms and infrastructure." Journal of Network and Computer Applications, 32(1), 11-24.
3. Pedregosa, F., et al. (2011). "Scikit-learn: Machine learning in Python." Journal of Machine Learning Research, 12, 2825-2830.
Submitted by Team Byte_hogs | BITS Pilani | 2026
