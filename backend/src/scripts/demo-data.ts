/**
 * Demo Data Script - Pre-populated Scenarios for Demonstration
 * Creates realistic fog computing scenarios for presentation
 * 
 * Usage: npx ts-node src/scripts/demo-data.ts
 */

import {
  HybridHeuristicScheduler,
  roundRobinSchedule,
  ipsoOnlySchedule,
  iacoOnlySchedule,
  minMinSchedule,
  Task,
  FogNode,
  TerminalDevice,
} from '../services/fogComputing.service';

// ==================== DEMO SCENARIOS ====================

interface DemoScenario {
  name: string;
  description: string;
  fogNodes: FogNode[];
  devices: TerminalDevice[];
  tasks: Task[];
}

/**
 * Scenario 1: Smart Factory Production Line
 * Real-time monitoring and fault detection tasks
 */
function createSmartFactoryScenario(): DemoScenario {
  const fogNodes: FogNode[] = [
    { id: 'fog-assembly', name: 'Assembly Line Server', computingResource: 2.5e9, storageCapacity: 256, networkBandwidth: 100, currentLoad: 0.3 },
    { id: 'fog-quality', name: 'Quality Control Node', computingResource: 2.0e9, storageCapacity: 128, networkBandwidth: 80, currentLoad: 0.2 },
    { id: 'fog-packaging', name: 'Packaging Unit', computingResource: 1.5e9, storageCapacity: 64, networkBandwidth: 60, currentLoad: 0.4 },
    { id: 'fog-warehouse', name: 'Warehouse Gateway', computingResource: 1.8e9, storageCapacity: 512, networkBandwidth: 100, currentLoad: 0.15 },
    { id: 'fog-main', name: 'Main Control Hub', computingResource: 3.0e9, storageCapacity: 1024, networkBandwidth: 150, currentLoad: 0.5 },
  ];

  const devices: TerminalDevice[] = [
    { id: 'dev-robot1', name: 'Robotic Arm #1', transmissionPower: 0.15, idlePower: 0.05, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-robot2', name: 'Robotic Arm #2', transmissionPower: 0.15, idlePower: 0.05, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-agv1', name: 'AGV Transport #1', transmissionPower: 0.1, idlePower: 0.03, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 5000 },
    { id: 'dev-agv2', name: 'AGV Transport #2', transmissionPower: 0.1, idlePower: 0.03, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 4500 },
    { id: 'dev-sensor1', name: 'Temperature Sensor Array', transmissionPower: 0.05, idlePower: 0.01, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-camera1', name: 'Vision Inspection System', transmissionPower: 0.2, idlePower: 0.08, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-tablet1', name: 'Operator Tablet #1', transmissionPower: 0.08, idlePower: 0.02, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 3000 },
    { id: 'dev-cnc1', name: 'CNC Machine Controller', transmissionPower: 0.12, idlePower: 0.04, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
  ];

  const tasks: Task[] = [
    { id: 'task-fault-detect', name: 'Real-time Fault Detection', dataSize: 35, computationIntensity: 400, maxToleranceTime: 5, expectedCompletionTime: 2, terminalDeviceId: 'dev-sensor1', priority: 5 },
    { id: 'task-quality-check', name: 'Quality Inspection Analysis', dataSize: 45, computationIntensity: 350, maxToleranceTime: 10, expectedCompletionTime: 5, terminalDeviceId: 'dev-camera1', priority: 4 },
    { id: 'task-inventory', name: 'Inventory Management Update', dataSize: 20, computationIntensity: 200, maxToleranceTime: 30, expectedCompletionTime: 10, terminalDeviceId: 'dev-tablet1', priority: 2 },
    { id: 'task-robot-path', name: 'Robot Path Optimization', dataSize: 15, computationIntensity: 500, maxToleranceTime: 3, expectedCompletionTime: 1, terminalDeviceId: 'dev-robot1', priority: 5 },
    { id: 'task-agv-route', name: 'AGV Route Planning', dataSize: 25, computationIntensity: 350, maxToleranceTime: 8, expectedCompletionTime: 3, terminalDeviceId: 'dev-agv1', priority: 4 },
    { id: 'task-temp-monitor', name: 'Temperature Anomaly Detection', dataSize: 10, computationIntensity: 250, maxToleranceTime: 2, expectedCompletionTime: 1, terminalDeviceId: 'dev-sensor1', priority: 5 },
    { id: 'task-production-sched', name: 'Production Schedule Update', dataSize: 30, computationIntensity: 300, maxToleranceTime: 15, expectedCompletionTime: 8, terminalDeviceId: 'dev-tablet1', priority: 3 },
    { id: 'task-cnc-adjust', name: 'CNC Parameter Adjustment', dataSize: 12, computationIntensity: 280, maxToleranceTime: 5, expectedCompletionTime: 2, terminalDeviceId: 'dev-cnc1', priority: 4 },
    { id: 'task-maintenance-pred', name: 'Predictive Maintenance Analysis', dataSize: 40, computationIntensity: 450, maxToleranceTime: 20, expectedCompletionTime: 12, terminalDeviceId: 'dev-robot2', priority: 3 },
    { id: 'task-energy-opt', name: 'Energy Consumption Optimization', dataSize: 28, computationIntensity: 320, maxToleranceTime: 25, expectedCompletionTime: 15, terminalDeviceId: 'dev-agv2', priority: 2 },
  ];

  return {
    name: 'Smart Factory Production Line',
    description: 'Real-time monitoring, fault detection, and production scheduling in a smart manufacturing environment',
    fogNodes,
    devices,
    tasks,
  };
}

/**
 * Scenario 2: Healthcare IoT Network
 * Patient monitoring and emergency response tasks
 */
function createHealthcareScenario(): DemoScenario {
  const fogNodes: FogNode[] = [
    { id: 'fog-icu', name: 'ICU Monitoring Hub', computingResource: 2.8e9, storageCapacity: 256, networkBandwidth: 120, currentLoad: 0.6 },
    { id: 'fog-emergency', name: 'Emergency Response Node', computingResource: 3.0e9, storageCapacity: 128, networkBandwidth: 150, currentLoad: 0.4 },
    { id: 'fog-pharmacy', name: 'Pharmacy Management', computingResource: 1.5e9, storageCapacity: 512, networkBandwidth: 80, currentLoad: 0.2 },
    { id: 'fog-imaging', name: 'Medical Imaging Server', computingResource: 4.0e9, storageCapacity: 2048, networkBandwidth: 200, currentLoad: 0.3 },
    { id: 'fog-records', name: 'Patient Records Gateway', computingResource: 2.0e9, storageCapacity: 1024, networkBandwidth: 100, currentLoad: 0.35 },
  ];

  const devices: TerminalDevice[] = [
    { id: 'dev-ecg1', name: 'ECG Monitor #1', transmissionPower: 0.08, idlePower: 0.02, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-ecg2', name: 'ECG Monitor #2', transmissionPower: 0.08, idlePower: 0.02, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-wearable1', name: 'Patient Wearable #1', transmissionPower: 0.05, idlePower: 0.01, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 2000 },
    { id: 'dev-wearable2', name: 'Patient Wearable #2', transmissionPower: 0.05, idlePower: 0.01, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 1800 },
    { id: 'dev-infusion', name: 'Smart Infusion Pump', transmissionPower: 0.06, idlePower: 0.02, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-xray', name: 'X-Ray Machine', transmissionPower: 0.25, idlePower: 0.1, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
  ];

  const tasks: Task[] = [
    { id: 'task-cardiac-alert', name: 'Cardiac Event Detection', dataSize: 8, computationIntensity: 500, maxToleranceTime: 1, expectedCompletionTime: 0.5, terminalDeviceId: 'dev-ecg1', priority: 5 },
    { id: 'task-vitals-analysis', name: 'Vital Signs Analysis', dataSize: 15, computationIntensity: 300, maxToleranceTime: 3, expectedCompletionTime: 1, terminalDeviceId: 'dev-wearable1', priority: 5 },
    { id: 'task-drug-interaction', name: 'Drug Interaction Check', dataSize: 5, computationIntensity: 400, maxToleranceTime: 2, expectedCompletionTime: 1, terminalDeviceId: 'dev-infusion', priority: 5 },
    { id: 'task-xray-analysis', name: 'X-Ray Image Analysis', dataSize: 50, computationIntensity: 600, maxToleranceTime: 30, expectedCompletionTime: 15, terminalDeviceId: 'dev-xray', priority: 3 },
    { id: 'task-patient-history', name: 'Patient History Retrieval', dataSize: 25, computationIntensity: 200, maxToleranceTime: 5, expectedCompletionTime: 2, terminalDeviceId: 'dev-wearable2', priority: 4 },
    { id: 'task-anomaly-detect', name: 'Health Anomaly Detection', dataSize: 12, computationIntensity: 450, maxToleranceTime: 2, expectedCompletionTime: 1, terminalDeviceId: 'dev-ecg2', priority: 5 },
  ];

  return {
    name: 'Healthcare IoT Network',
    description: 'Patient monitoring, emergency response, and medical data analysis in a hospital environment',
    fogNodes,
    devices,
    tasks,
  };
}

/**
 * Scenario 3: Smart City Traffic Management
 * Traffic optimization and emergency vehicle routing
 */
function createSmartCityScenario(): DemoScenario {
  const fogNodes: FogNode[] = [
    { id: 'fog-intersection1', name: 'Intersection Hub North', computingResource: 2.0e9, storageCapacity: 128, networkBandwidth: 100, currentLoad: 0.45 },
    { id: 'fog-intersection2', name: 'Intersection Hub South', computingResource: 2.0e9, storageCapacity: 128, networkBandwidth: 100, currentLoad: 0.5 },
    { id: 'fog-parking', name: 'Smart Parking Gateway', computingResource: 1.5e9, storageCapacity: 256, networkBandwidth: 80, currentLoad: 0.3 },
    { id: 'fog-emergency', name: 'Emergency Services Hub', computingResource: 3.0e9, storageCapacity: 512, networkBandwidth: 150, currentLoad: 0.2 },
    { id: 'fog-central', name: 'Central Traffic Control', computingResource: 4.0e9, storageCapacity: 1024, networkBandwidth: 200, currentLoad: 0.55 },
  ];

  const devices: TerminalDevice[] = [
    { id: 'dev-camera1', name: 'Traffic Camera #1', transmissionPower: 0.15, idlePower: 0.05, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-camera2', name: 'Traffic Camera #2', transmissionPower: 0.15, idlePower: 0.05, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-sensor1', name: 'Road Sensor Array #1', transmissionPower: 0.08, idlePower: 0.02, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
    { id: 'dev-ambulance', name: 'Ambulance GPS Tracker', transmissionPower: 0.1, idlePower: 0.03, isMobile: true, delayWeight: 0.7, energyWeight: 0.3, residualEnergy: 10000 },
    { id: 'dev-parking', name: 'Parking Sensor Network', transmissionPower: 0.06, idlePower: 0.015, isMobile: false, delayWeight: 1.0, energyWeight: 0, residualEnergy: Infinity },
  ];

  const tasks: Task[] = [
    { id: 'task-congestion', name: 'Congestion Prediction', dataSize: 30, computationIntensity: 400, maxToleranceTime: 5, expectedCompletionTime: 2, terminalDeviceId: 'dev-camera1', priority: 4 },
    { id: 'task-signal-opt', name: 'Traffic Signal Optimization', dataSize: 20, computationIntensity: 350, maxToleranceTime: 3, expectedCompletionTime: 1, terminalDeviceId: 'dev-sensor1', priority: 5 },
    { id: 'task-emergency-route', name: 'Emergency Vehicle Routing', dataSize: 15, computationIntensity: 500, maxToleranceTime: 2, expectedCompletionTime: 1, terminalDeviceId: 'dev-ambulance', priority: 5 },
    { id: 'task-parking-avail', name: 'Parking Availability Update', dataSize: 10, computationIntensity: 200, maxToleranceTime: 10, expectedCompletionTime: 5, terminalDeviceId: 'dev-parking', priority: 2 },
    { id: 'task-accident-detect', name: 'Accident Detection', dataSize: 25, computationIntensity: 450, maxToleranceTime: 2, expectedCompletionTime: 1, terminalDeviceId: 'dev-camera2', priority: 5 },
  ];

  return {
    name: 'Smart City Traffic Management',
    description: 'Traffic optimization, emergency routing, and parking management in an urban environment',
    fogNodes,
    devices,
    tasks,
  };
}

// ==================== DEMO RUNNER ====================

function runDemo(scenario: DemoScenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📍 SCENARIO: ${scenario.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📝 ${scenario.description}\n`);
  
  console.log(`🖥️  Fog Nodes (${scenario.fogNodes.length}):`);
  scenario.fogNodes.forEach(node => {
    console.log(`   • ${node.name}: ${(node.computingResource / 1e9).toFixed(1)} GHz, ${node.networkBandwidth} Mbps`);
  });
  
  console.log(`\n📱 Terminal Devices (${scenario.devices.length}):`);
  scenario.devices.forEach(device => {
    const type = device.isMobile ? '📲 Mobile' : '🖥️  Static';
    console.log(`   • ${device.name} (${type})`);
  });
  
  console.log(`\n📋 Tasks (${scenario.tasks.length}):`);
  scenario.tasks.forEach(task => {
    const priorityStars = '⭐'.repeat(task.priority);
    console.log(`   • ${task.name} [${task.dataSize}Mb, max ${task.maxToleranceTime}s] ${priorityStars}`);
  });

  console.log(`\n🔄 Running Scheduling Algorithms...\n`);

  // Run all algorithms
  const results: { [key: string]: { delay: number; energy: number; reliability: number; time: number } } = {};

  let start = Date.now();
  const hhScheduler = new HybridHeuristicScheduler(scenario.tasks, scenario.fogNodes, scenario.devices);
  const hhResult = hhScheduler.schedule();
  results['HH (Hybrid Heuristic)'] = { delay: hhResult.totalDelay, energy: hhResult.totalEnergy, reliability: hhResult.reliability, time: Date.now() - start };

  start = Date.now();
  const ipsoResult = ipsoOnlySchedule(scenario.tasks, scenario.fogNodes, scenario.devices);
  results['IPSO Only'] = { delay: ipsoResult.totalDelay, energy: ipsoResult.totalEnergy, reliability: ipsoResult.reliability, time: Date.now() - start };

  start = Date.now();
  const iacoResult = iacoOnlySchedule(scenario.tasks, scenario.fogNodes, scenario.devices);
  results['IACO Only'] = { delay: iacoResult.totalDelay, energy: iacoResult.totalEnergy, reliability: iacoResult.reliability, time: Date.now() - start };

  start = Date.now();
  const rrResult = roundRobinSchedule(scenario.tasks, scenario.fogNodes, scenario.devices);
  results['Round-Robin'] = { delay: rrResult.totalDelay, energy: rrResult.totalEnergy, reliability: rrResult.reliability, time: Date.now() - start };

  start = Date.now();
  const mmResult = minMinSchedule(scenario.tasks, scenario.fogNodes, scenario.devices);
  results['Min-Min'] = { delay: mmResult.totalDelay, energy: mmResult.totalEnergy, reliability: mmResult.reliability, time: Date.now() - start };

  // Print results table
  console.log('┌─────────────────────┬───────────────┬───────────────┬─────────────┬──────────┐');
  console.log('│ Algorithm           │ Total Delay   │ Total Energy  │ Reliability │ Time     │');
  console.log('├─────────────────────┼───────────────┼───────────────┼─────────────┼──────────┤');
  
  Object.entries(results).forEach(([name, data]) => {
    const delay = data.delay.toFixed(2).padStart(10) + 's';
    const energy = data.energy.toFixed(2).padStart(10) + 'J';
    const reliability = (data.reliability.toFixed(1) + '%').padStart(9);
    const time = (data.time + 'ms').padStart(6);
    console.log(`│ ${name.padEnd(19)} │ ${delay} │ ${energy} │ ${reliability} │ ${time} │`);
  });
  
  console.log('└─────────────────────┴───────────────┴───────────────┴─────────────┴──────────┘');

  // Print task allocations for HH
  console.log('\n📊 HH Task Allocations:');
  const detailedResults = hhScheduler.getDetailedResults(hhResult);
  detailedResults.forEach(result => {
    const task = scenario.tasks.find(t => t.id === result.taskId);
    const fogNode = scenario.fogNodes.find(f => f.id === result.fogNodeId);
    if (task && fogNode) {
      console.log(`   ${task.name.padEnd(30)} → ${fogNode.name.padEnd(25)} (${result.totalDelay.toFixed(3)}s)`);
    }
  });

  // Calculate and print improvements
  const hhVsRR = ((rrResult.totalDelay - hhResult.totalDelay) / rrResult.totalDelay * 100).toFixed(1);
  console.log(`\n✅ HH vs Round-Robin: ${parseFloat(hhVsRR) >= 0 ? '+' : ''}${hhVsRR}% delay improvement`);

  return { scenario: scenario.name, results, allocations: hhResult.allocations };
}

// ==================== MAIN EXECUTION ====================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        FOG COMPUTING DEMO - Pre-populated Scenarios                  ║');
  console.log('║        Based on Wang & Li (2019) Research Paper                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const scenarios = [
    createSmartFactoryScenario(),
    createHealthcareScenario(),
    createSmartCityScenario(),
  ];

  const allResults = scenarios.map(scenario => runDemo(scenario));

  // Final Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 DEMO SUMMARY');
  console.log('═'.repeat(70));
  
  allResults.forEach(result => {
    const hh = result.results['HH (Hybrid Heuristic)'];
    const rr = result.results['Round-Robin'];
    const improvement = ((rr.delay - hh.delay) / rr.delay * 100).toFixed(1);
    console.log(`\n${result.scenario}:`);
    console.log(`   HH Delay: ${hh.delay.toFixed(2)}s | RR Delay: ${rr.delay.toFixed(2)}s | Improvement: ${improvement}%`);
    console.log(`   HH Reliability: ${hh.reliability.toFixed(1)}% | RR Reliability: ${rr.reliability.toFixed(1)}%`);
  });

  console.log('\n✅ Demo complete! All scenarios executed successfully.');
}

main().catch(console.error);

export { createSmartFactoryScenario, createHealthcareScenario, createSmartCityScenario, runDemo };
