const fs = require('fs');

const filesToFixTasks = [
    'src/__tests__/fogComputing.service.test.ts',
    'src/routes/experiments.routes.ts',
    'src/routes/fog.routes.ts',
    'src/scripts/benchmark.ts',
    'src/scripts/demo-data.ts',
    'src/scripts/run_experiments.ts'
];
filesToFixTasks.forEach(f => {
    if (!fs.existsSync(f)) return;
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/priority:\s*(\d+)/g, 'priority: $1, memoryRequirement: 128, vramRequirement: 0, startupOverhead: 1');
    fs.writeFileSync(f, text);
});

const filesToFixNodes = [
    'src/__tests__/fogComputing.service.test.ts',
    'src/routes/fog.routes.ts',
    'src/scripts/demo-data.ts'
];
filesToFixNodes.forEach(f => {
    if (!fs.existsSync(f)) return;
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/currentLoad:\s*([\d.]+)/g, 'currentLoad: $1, totalMemory: 8192, totalVram: 0, baseLatency: 10, egressCostPerMb: 0.05');
    text = text.replace(/costPerUnit:\s*([\d.]+)(?!, baseLatency)/g, 'costPerUnit: $1, baseLatency: 10, egressCostPerMb: 0.05');
    fs.writeFileSync(f, text);
});

let sched = 'src/services/scheduler.service.ts';
if (fs.existsSync(sched)) {
    let t = fs.readFileSync(sched, 'utf8');
    t = t.replace(/resourceLoad:\s*resource\.currentLoad(\s*)}/g, 'resourceLoad: resource.currentLoad, startupOverhead: 1$1}');
    fs.writeFileSync(sched, t);
}
