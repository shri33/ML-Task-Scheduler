const fs = require('fs');

let f1 = 'src/routes/experiments.routes.ts';
if (fs.existsSync(f1)) {
    let t1 = fs.readFileSync(f1, 'utf8');
    t1 = t1.replace(/priority:\s*Math\.floor\(Math\.random\(\) \* 5\) \+ 1,?(?!.*memoryRequirement)/g, 'priority: Math.floor(Math.random() * 5) + 1, memoryRequirement: 128, vramRequirement: 0, startupOverhead: 1,');
    fs.writeFileSync(f1, t1);
}

let f2 = 'src/routes/fog.routes.ts';
if (fs.existsSync(f2)) {
    let t2 = fs.readFileSync(f2, 'utf8');
    t2 = t2.replace(/currentLoad: n.currentLoad(?!\s*, *totalMemory)/g, 'currentLoad: n.currentLoad, totalMemory: 8192, totalVram: 0, baseLatency: 10, egressCostPerMb: 0.05');
    t2 = t2.replace(/priority: priority \|\| 3(?!.*memoryRequirement)/g, 'priority: priority || 3, memoryRequirement: 128, vramRequirement: 0, startupOverhead: 1');
    fs.writeFileSync(f2, t2);
}

let f3 = 'src/scripts/benchmark.ts';
if (fs.existsSync(f3)) {
    let t3 = fs.readFileSync(f3, 'utf8');
    t3 = t3.replace(/priority:\s*Math\.floor\(Math\.random\(\) \* 5\) \+ 1,?(?!.*memoryRequirement)/g, 'priority: Math.floor(Math.random() * 5) + 1, memoryRequirement: 128, vramRequirement: 0, startupOverhead: 1,');
    fs.writeFileSync(f3, t3);
}

let f4 = 'src/scripts/run_experiments.ts';
if (fs.existsSync(f4)) {
    let t4 = fs.readFileSync(f4, 'utf8');
    t4 = t4.replace(/priority:\s*Math\.floor\(Math\.random\(\) \* 5\) \+ 1,?(?!.*memoryRequirement)/g, 'priority: Math.floor(Math.random() * 5) + 1, memoryRequirement: 128, vramRequirement: 0, startupOverhead: 1,');
    fs.writeFileSync(f4, t4);
}
