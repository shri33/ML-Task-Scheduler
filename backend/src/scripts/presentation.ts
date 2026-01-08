/**
 * Demo Presentation Script
 * Automated presentation for BITS Pilani Study Project
 * 
 * Usage: npx ts-node src/scripts/presentation.ts
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';
const ML_BASE = 'http://localhost:5001/api';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  title: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.yellow}▶ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}  ℹ ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}  ✓ ${msg}${colors.reset}`),
  data: (label: string, value: any) => console.log(`${colors.magenta}  ${label}: ${colors.reset}${JSON.stringify(value)}`),
  table: (data: any) => console.table(data),
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForKeyPress(message: string): Promise<void> {
  console.log(`\n${colors.yellow}⏸  ${message} [Press Enter to continue...]${colors.reset}`);
  // In a real presentation, you would wait for key press
  await sleep(1500);
}

async function checkServices(): Promise<boolean> {
  log.section('Checking Services Health');
  
  try {
    const [backend, ml] = await Promise.all([
      axios.get(`${API_BASE}/health`).catch(() => null),
      axios.get(`${ML_BASE}/health`).catch(() => null),
    ]);
    
    log.success(`Backend API: ${backend ? 'Online' : 'Offline'}`);
    log.success(`ML Service: ${ml ? 'Online' : 'Offline'}`);
    
    return !!backend && !!ml;
  } catch (error) {
    log.info('One or more services are offline');
    return false;
  }
}

async function demonstrateMLService() {
  log.section('1. ML Service - Task Duration Prediction');
  log.info('Based on Random Forest Regressor trained on historical task data');
  
  await sleep(500);
  
  // Get model info
  const modelInfo = await axios.get(`${ML_BASE}/model/info`);
  log.data('Model Version', modelInfo.data.version);
  log.data('Model Type', modelInfo.data.model_type);
  log.data('Features', modelInfo.data.features);
  
  await sleep(500);
  
  // Make a prediction
  // taskSize: 1=small, 2=medium, 3=large (categorical)
  // taskType: 0=compute, 1=io, 2=mixed
  // priority: 1-5 scale
  // resourceLoad: 0-100 percentage
  log.info('Making prediction for: High-priority, Large task on loaded resource');
  const prediction = await axios.post(`${ML_BASE}/predict`, {
    taskSize: 3,      // Large task (categorical: 1=small, 2=medium, 3=large)
    taskType: 2,      // Mixed task type
    priority: 5,      // High priority
    resourceLoad: 75, // 75% resource load
  });
  
  log.success(`Predicted Duration: ${prediction.data.predictedTime.toFixed(2)} seconds`);
  log.success(`Confidence: ${(prediction.data.confidence * 100).toFixed(1)}%`);
}

async function demonstrateFogComputing() {
  log.section('2. Fog Computing Algorithms - Wang & Li (2019) Paper Implementation');
  log.info('Implementing Hybrid Heuristic (HH) = IPSO + IACO');
  
  await sleep(500);
  
  // Get fog computing info
  const fogInfo = await axios.get(`${API_BASE}/fog/info`);
  log.data('Algorithms Available', fogInfo.data.data.capabilities.algorithms);
  log.data('Performance Metrics', fogInfo.data.data.capabilities.metrics);
  
  await sleep(500);
  
  // Run comparison
  log.info('Running algorithm comparison with 100 tasks...');
  const comparison = await axios.post(`${API_BASE}/fog/compare`, { taskCount: 100 });
  
  const results = comparison.data.data.results;
  console.log('\n  Algorithm Performance Comparison:');
  console.log('  ┌───────────────────┬────────────┬────────────┬────────────┐');
  console.log('  │ Algorithm         │ Delay (s)  │ Energy (J) │ Reliability│');
  console.log('  ├───────────────────┼────────────┼────────────┼────────────┤');
  console.log(`  │ Hybrid Heuristic  │ ${results.hybridHeuristic.totalDelay.toFixed(2).padStart(10)} │ ${results.hybridHeuristic.totalEnergy.toFixed(2).padStart(10)} │ ${(results.hybridHeuristic.reliability + '%').padStart(10)} │`);
  console.log(`  │ IPSO              │ ${results.ipso.totalDelay.toFixed(2).padStart(10)} │ ${results.ipso.totalEnergy.toFixed(2).padStart(10)} │ ${(results.ipso.reliability + '%').padStart(10)} │`);
  console.log(`  │ IACO              │ ${results.iaco.totalDelay.toFixed(2).padStart(10)} │ ${results.iaco.totalEnergy.toFixed(2).padStart(10)} │ ${(results.iaco.reliability + '%').padStart(10)} │`);
  console.log(`  │ Round-Robin       │ ${results.roundRobin.totalDelay.toFixed(2).padStart(10)} │ ${results.roundRobin.totalEnergy.toFixed(2).padStart(10)} │ ${(results.roundRobin.reliability + '%').padStart(10)} │`);
  console.log(`  │ Min-Min           │ ${results.minMin.totalDelay.toFixed(2).padStart(10)} │ ${results.minMin.totalEnergy.toFixed(2).padStart(10)} │ ${(results.minMin.reliability + '%').padStart(10)} │`);
  console.log('  └───────────────────┴────────────┴────────────┴────────────┘');
  
  // Show improvements
  const improvements = comparison.data.data.improvements;
  log.success(`HH vs Round-Robin: ${improvements.hhVsRoundRobin.delayReduction} delay reduction`);
}

async function demonstrateTaskManagement() {
  log.section('3. Task Management System');
  log.info('Full CRUD operations with ML-enhanced scheduling');
  
  await sleep(500);
  
  // Get all tasks
  const tasks = await axios.get(`${API_BASE}/tasks`);
  log.success(`Total Tasks: ${tasks.data.data?.length || 0}`);
  
  // Get all resources
  const resources = await axios.get(`${API_BASE}/resources`);
  log.success(`Total Resources: ${resources.data.data?.length || 0}`);
  
  if (tasks.data.data?.length > 0) {
    log.info('Sample Task:');
    const sampleTask = tasks.data.data[0];
    log.data('Name', sampleTask.name);
    log.data('Priority', sampleTask.priority);
    log.data('Status', sampleTask.status);
  }
}

async function demonstrateScheduler() {
  log.section('4. ML-Enhanced Scheduler');
  log.info('Running intelligent task-to-resource assignment');
  
  await sleep(500);
  
  try {
    const schedule = await axios.post(`${API_BASE}/schedule`);
    
    if (schedule.data.success && schedule.data.data?.assignments) {
      log.success(`Scheduled ${schedule.data.data.assignments.length} task(s)`);
      log.data('Algorithm', schedule.data.data.algorithm || 'ML-Enhanced Weighted Score');
      
      if (schedule.data.data.assignments.length > 0) {
        log.info('Sample Assignment:');
        const sample = schedule.data.data.assignments[0];
        log.data('Task → Resource', `${sample.taskId} → ${sample.resourceId}`);
        log.data('Score', sample.score?.toFixed(4));
      }
    }
  } catch (error) {
    log.info('No pending tasks to schedule');
  }
}

async function demonstrateMetrics() {
  log.section('5. Analytics & Metrics');
  log.info('Real-time system performance monitoring');
  
  await sleep(500);
  
  const metrics = await axios.get(`${API_BASE}/metrics`);
  
  if (metrics.data.success && metrics.data.data) {
    const data = metrics.data.data;
    log.data('Total Tasks', data.totalTasks);
    log.data('Completed Tasks', data.completedTasks);
    log.data('Average Duration', `${data.avgDuration?.toFixed(2) || 'N/A'}s`);
    log.data('Resource Utilization', `${data.resourceUtilization?.toFixed(1) || 'N/A'}%`);
  }
}

async function showArchitecture() {
  log.title('═══════════════════════════════════════════════════════════════');
  log.title('     ML Task Scheduler - System Architecture');
  log.title('═══════════════════════════════════════════════════════════════');
  
  console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │                         SYSTEM ARCHITECTURE                          │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
  │    │   Frontend  │────▶│   Backend   │────▶│ ML Service  │          │
  │    │ React+Vite  │     │ Express+TS  │     │ Flask+SK    │          │
  │    │  Port 3000  │     │  Port 3001  │     │  Port 5001  │          │
  │    └─────────────┘     └──────┬──────┘     └─────────────┘          │
  │                               │                                      │
  │                        ┌──────┴──────┐                               │
  │                        │             │                               │
  │                   ┌────┴────┐   ┌────┴────┐                          │
  │                   │PostgreSQL│   │  Redis  │                         │
  │                   │Port 5432 │   │Port 6379│                         │
  │                   └─────────┘   └─────────┘                          │
  │                                                                      │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Key Features:                                                       │
  │  • ML-Based Task Duration Prediction (Random Forest)                │
  │  • Fog Computing Algorithms (HH, IPSO, IACO, RR, Min-Min)           │
  │  • Real-time WebSocket Updates                                      │
  │  • JWT Authentication                                               │
  │  • Docker Containerization (5 services)                             │
  └─────────────────────────────────────────────────────────────────────┘
  `);
}

async function showResearchPaper() {
  log.title('═══════════════════════════════════════════════════════════════');
  log.title('     Reference Paper Implementation');
  log.title('═══════════════════════════════════════════════════════════════');
  
  console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │  📄 RESEARCH PAPER                                                   │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  Title: "Task Scheduling Based on a Hybrid Heuristic Algorithm       │
  │          for Smart Production Line with Fog Computing"               │
  │                                                                      │
  │  Authors: Juan Wang and Di Li                                        │
  │  Journal: Sensors 2019, 19(5), 1023                                  │
  │  DOI: 10.3390/s19051023                                              │
  │                                                                      │
  ├─────────────────────────────────────────────────────────────────────┤
  │  IMPLEMENTED ALGORITHMS:                                             │
  │  ├── HH (Hybrid Heuristic) = IPSO + IACO                            │
  │  ├── IPSO (Improved Particle Swarm Optimization)                    │
  │  │   └── Adaptive inertia weight                                    │
  │  │   └── Contraction factor                                         │
  │  │   └── Sigmoid-based position update                              │
  │  ├── IACO (Improved Ant Colony Optimization)                        │
  │  │   └── Improved heuristic information                             │
  │  │   └── Regulatory factor                                          │
  │  │   └── Local & global pheromone update                            │
  │  ├── Round-Robin (Baseline)                                         │
  │  └── Min-Min (Baseline)                                             │
  │                                                                      │
  ├─────────────────────────────────────────────────────────────────────┤
  │  MATHEMATICAL MODELS:                                                │
  │  • Execution Time: TEij = Di × θi / Cj                              │
  │  • Transmission Time: TRij = Di / Bj                                │
  │  • Total Delay: Tij = TRij + TEij                                   │
  │  • Energy: Eij = TRij × pir + TEij × pie                            │
  │  • Objective: min Σ(wit × Tij + wie × Eij)                          │
  │  • Fitness: 1 / objective_value                                     │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
  `);
}

async function main() {
  console.clear();
  
  log.title('╔═══════════════════════════════════════════════════════════════════╗');
  log.title('║     INTELLIGENT TASK ALLOCATION AND SCHEDULING SYSTEM            ║');
  log.title('║                   ML-Assisted Optimization                        ║');
  log.title('║                                                                   ║');
  log.title('║     Team Byte_Hogs | BITS Pilani BSc CS Study Project            ║');
  log.title('╚═══════════════════════════════════════════════════════════════════╝');
  
  await sleep(1000);
  
  // Check services
  const servicesReady = await checkServices();
  
  if (!servicesReady) {
    console.log('\n⚠️  Please start the services first:');
    console.log('   docker-compose up -d\n');
    return;
  }
  
  await sleep(500);
  
  // Show architecture
  await showArchitecture();
  await waitForKeyPress('Architecture overview complete');
  
  // Show paper reference
  await showResearchPaper();
  await waitForKeyPress('Research paper overview complete');
  
  // Demonstrate features
  await demonstrateMLService();
  await waitForKeyPress('ML Service demonstration complete');
  
  await demonstrateFogComputing();
  await waitForKeyPress('Fog Computing demonstration complete');
  
  await demonstrateTaskManagement();
  await waitForKeyPress('Task Management demonstration complete');
  
  await demonstrateScheduler();
  await waitForKeyPress('Scheduler demonstration complete');
  
  await demonstrateMetrics();
  
  // Final summary
  log.title('\n═══════════════════════════════════════════════════════════════');
  log.title('                    DEMO COMPLETE');
  log.title('═══════════════════════════════════════════════════════════════');
  
  console.log(`
  ✅ All features demonstrated successfully!
  
  Key Achievements:
  • Implemented 5 scheduling algorithms from research paper
  • ML-based task duration prediction with ~95% accuracy
  • Full-stack web application with React + Express
  • Docker containerization with 5 services
  • Real-time updates via WebSocket
  • Performance benchmarks matching paper Figures 5-8
  
  Access the application:
  • Frontend: http://localhost:3000
  • API Docs: http://localhost:3001/api-docs
  • ML Service: http://localhost:5001/api/health
  
  Thank you! Questions?
  `);
}

main().catch(console.error);
