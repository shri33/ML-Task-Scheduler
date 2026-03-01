# Experiment Results

This directory stores output from the experiment framework that reproduces
Figures 5–8 from Wang & Li (2019): *"Task Scheduling Based on a Hybrid
Heuristic Algorithm for Smart Production Line with Fog Computing"*.

## Directory Structure

```
results/
├── energy/                          # Figure 6
│   ├── energy_vs_taskcount.csv
│   └── energy_vs_taskcount.json
├── completion_time/                 # Figure 5
│   └── completion_time_vs_taskcount.csv
├── reliability_taskcount/           # Figure 7
│   ├── reliability_vs_taskcount.csv
│   └── reliability_vs_taskcount.json
├── reliability_tolerance/           # Figure 8
│   ├── reliability_vs_tolerance.csv
│   └── reliability_vs_tolerance.json
├── summary_report.json              # Aggregated summary
└── simulation_log.json              # Single-run simulation log
```

## How to Generate

### Via CLI (inside backend container or locally)
```bash
# All experiments
npm run experiments:all

# Individual experiments
npm run experiments:energy
npm run experiments:reliability-tasks
npm run experiments:reliability-tolerance

# Single simulation
npm run simulate -- --tasks 200 --nodes 10 --algo HH
```

### Via API
```bash
curl -X POST http://localhost:3001/api/v1/experiments/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"experiment_type": "all", "iterations": 3}'
```

### Via Frontend
Navigate to **Experiments** page and click "Run Experiment".
