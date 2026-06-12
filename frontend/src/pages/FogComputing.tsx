import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from 'recharts';
import {
  fogApi,
  FogMetrics,
  FogNode,
  AlgorithmComparison,
  FogInfo,
  FogTerminalDevice,
  FogTask,
  FogScheduleResult,
  ToleranceReliabilityMetric,
} from '../lib/api';
import {
  Cloud,
  Settings,
  Play,
  RefreshCw,
  BarChart2,
  Download,
  Cpu,
  Zap,
  ShieldCheck,
  Clock,
  ChevronRight,
  Smartphone,
  Server,
  Loader2,
  Layers,
  FileJson,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';

const ALGO_COLORS: Record<string, string> = {
  HH: '#8b5cf6',
  IPSO: '#3b82f6',
  IACO: '#06b6d4',
  FCFS: '#94a3b8',
  'Round Robin': '#f43f5e',
  'Min-Min': '#10b981',
};

const CHART_ALGOS = ['HH', 'IPSO', 'IACO', 'FCFS', 'Round Robin', 'Min-Min'] as const;

function formatResidualEnergy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '∞';
  return `${value.toFixed(0)} mAh`;
}

function metricsToChartRow(m: FogMetrics, field: 'completionTime' | 'energyConsumption' | 'reliability') {
  const data = m[field];
  return {
    tasks: m.taskCount,
    HH: data.hh,
    IPSO: data.ipso,
    IACO: data.iaco,
    FCFS: data.fcfs,
    'Round Robin': data.rr,
    'Min-Min': data.minMin,
  };
}

export default function FogComputing() {
  const [fogInfo, setFogInfo] = useState<FogInfo | null>(null);
  const [metrics, setMetrics] = useState<FogMetrics[]>([]);
  const [toleranceMetrics, setToleranceMetrics] = useState<ToleranceReliabilityMetric[]>([]);
  const [comparison, setComparison] = useState<AlgorithmComparison | null>(null);
  const [fogNodes, setFogNodes] = useState<FogNode[]>([]);
  const [terminalDevices, setTerminalDevices] = useState<FogTerminalDevice[]>([]);
  const [fogTasks, setFogTasks] = useState<FogTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [toleranceLoading, setToleranceLoading] = useState(false);
  const [taskCount, setTaskCount] = useState(50);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('hh');
  const [scheduleResult, setScheduleResult] = useState<FogScheduleResult | null>(null);
  const toast = useToast();

  const fetchFogInfo = useCallback(async () => {
    try {
      const data = await fogApi.getInfo();
      setFogInfo(data);
    } catch (error) {
      console.error('Failed to fetch fog info:', error);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const data = await fogApi.getMetrics();
      if (data?.metrics) setMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      toast.error('Metrics Failed', 'Could not load benchmark charts.');
    } finally {
      setMetricsLoading(false);
    }
  }, [toast]);

  const fetchToleranceMetrics = useCallback(async () => {
    try {
      setToleranceLoading(true);
      const data = await fogApi.getToleranceReliability();
      if (data?.metrics) setToleranceMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch tolerance metrics:', error);
    } finally {
      setToleranceLoading(false);
    }
  }, []);

  const fetchFogNodes = useCallback(async () => {
    try {
      const data = await fogApi.getNodes();
      if (Array.isArray(data)) setFogNodes(data);
    } catch (error) {
      console.error('Failed to fetch fog nodes:', error);
    }
  }, []);

  const fetchTerminalDevices = useCallback(async () => {
    try {
      const data = await fogApi.getDevices();
      if (Array.isArray(data)) setTerminalDevices(data);
    } catch (error) {
      console.error('Failed to fetch terminal devices:', error);
    }
  }, []);

  const fetchFogTasks = useCallback(async () => {
    try {
      const data = await fogApi.getTasks();
      if (Array.isArray(data)) setFogTasks(data);
    } catch (error) {
      console.error('Failed to fetch fog tasks:', error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchFogInfo(),
      fetchFogNodes(),
      fetchTerminalDevices(),
      fetchFogTasks(),
    ]);
  }, [fetchFogInfo, fetchFogNodes, fetchTerminalDevices, fetchFogTasks]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const loadBenchmarkCharts = async () => {
    setChartsLoading(true);
    try {
      await fetchMetrics();
      await fetchToleranceMetrics();
      setChartsLoaded(true);
      toast.success('Charts Ready', 'Benchmark data loaded (Figures 5–8).');
    } catch {
      toast.error('Charts Failed', 'Could not load benchmark charts. Try again.');
    } finally {
      setChartsLoading(false);
    }
  };

  const runComparison = async () => {
    setLoading(true);
    try {
      const data = await fogApi.compare(taskCount);
      setComparison(data);
      toast.success('Comparison Complete', `Benchmarked ${taskCount} tasks across all 6 algorithms in ${data.totalComparisonTimeMs}ms.`);
    } catch {
      toast.error('Simulation Failed', 'Could not complete algorithm comparison.');
    } finally {
      setLoading(false);
    }
  };

  const runSchedule = async () => {
    setLoading(true);
    try {
      const data = await fogApi.schedule(selectedAlgorithm);
      setScheduleResult(data);
      await fetchFogNodes();
      toast.success('Schedule Optimized', `Allocated ${data.summary.tasksScheduled} tasks using ${data.algorithm}.`);
    } catch {
      toast.error('Scheduling Failed', 'Could not run the selected algorithm.');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    setLoading(true);
    try {
      await fogApi.reset(taskCount);
      await refreshAll();
      setMetrics([]);
      setToleranceMetrics([]);
      setChartsLoaded(false);
      setScheduleResult(null);
      setComparison(null);
      toast.info('Simulation Reset', 'Fog environment has been reinitialized.');
    } catch {
      toast.error('Reset Failed', 'Could not clear simulation state. Admin role may be required.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') {
        const blob = await fogApi.exportCsv();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fog_benchmark_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const data = await fogApi.exportJson();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fog_benchmark_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast.success('Export Successful', `Downloaded benchmark data as ${format.toUpperCase()}.`);
    } catch {
      toast.error('Export Failed', 'Could not generate report.');
    }
  };

  const completionTimeData = useMemo(() => metrics.map(m => metricsToChartRow(m, 'completionTime')), [metrics]);
  const energyData = useMemo(() => metrics.map(m => metricsToChartRow(m, 'energyConsumption')), [metrics]);
  const reliabilityData = useMemo(() => metrics.map(m => metricsToChartRow(m, 'reliability')), [metrics]);
  const toleranceChartData = useMemo(
    () =>
      toleranceMetrics.map(m => ({
        tolerance: m.maxToleranceTime,
        HH: m.reliability.hh,
        IPSO: m.reliability.ipso,
        IACO: m.reliability.iaco,
        'Round Robin': m.reliability.rr,
      })),
    [toleranceMetrics]
  );

  const radarData = useMemo(() => {
    if (!comparison?.results) return [];
    const r = comparison.results;
    const allResults = [r.hybridHeuristic, r.ipso, r.iaco, r.fcfs, r.roundRobin, r.minMin];
    const maxExec = Math.max(...allResults.map(x => x.executionTimeMs));
    const maxDelay = Math.max(...allResults.map(x => x.totalDelay));
    const maxEnergy = Math.max(...allResults.map(x => x.totalEnergy));

    return [
      {
        metric: 'Speed',
        HH: 100 - (r.hybridHeuristic.executionTimeMs / maxExec) * 100,
        IPSO: 100 - (r.ipso.executionTimeMs / maxExec) * 100,
        IACO: 100 - (r.iaco.executionTimeMs / maxExec) * 100,
        FCFS: 100 - (r.fcfs.executionTimeMs / maxExec) * 100,
        RR: 100 - (r.roundRobin.executionTimeMs / maxExec) * 100,
        MinMin: 100 - (r.minMin.executionTimeMs / maxExec) * 100,
      },
      {
        metric: 'Low Delay',
        HH: 100 - (r.hybridHeuristic.totalDelay / maxDelay) * 100,
        IPSO: 100 - (r.ipso.totalDelay / maxDelay) * 100,
        IACO: 100 - (r.iaco.totalDelay / maxDelay) * 100,
        FCFS: 100 - (r.fcfs.totalDelay / maxDelay) * 100,
        RR: 100 - (r.roundRobin.totalDelay / maxDelay) * 100,
        MinMin: 100 - (r.minMin.totalDelay / maxDelay) * 100,
      },
      {
        metric: 'Energy Efficiency',
        HH: 100 - (r.hybridHeuristic.totalEnergy / maxEnergy) * 100,
        IPSO: 100 - (r.ipso.totalEnergy / maxEnergy) * 100,
        IACO: 100 - (r.iaco.totalEnergy / maxEnergy) * 100,
        FCFS: 100 - (r.fcfs.totalEnergy / maxEnergy) * 100,
        RR: 100 - (r.roundRobin.totalEnergy / maxEnergy) * 100,
        MinMin: 100 - (r.minMin.totalEnergy / maxEnergy) * 100,
      },
      {
        metric: 'Reliability',
        HH: r.hybridHeuristic.reliability,
        IPSO: r.ipso.reliability,
        IACO: r.iaco.reliability,
        FCFS: r.fcfs.reliability,
        RR: r.roundRobin.reliability,
        MinMin: r.minMin.reliability,
      },
    ];
  }, [comparison]);

  const comparisonTableRows = useMemo(() => {
    if (!comparison?.results) return [];
    const labels: { key: keyof AlgorithmComparison['results']; label: string }[] = [
      { key: 'hybridHeuristic', label: 'Hybrid (HH)' },
      { key: 'ipso', label: 'IPSO' },
      { key: 'iaco', label: 'IACO' },
      { key: 'fcfs', label: 'FCFS' },
      { key: 'roundRobin', label: 'Round-Robin' },
      { key: 'minMin', label: 'Min-Min' },
    ];
    return labels.map(({ key, label }) => ({
      label,
      ...comparison.results[key],
    }));
  }, [comparison]);

  return (
    <div className="max-w-[1600px] mx-auto pb-12 space-y-8 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Fog Node Scheduler
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-full uppercase tracking-widest">
              Hybrid Heuristic
            </span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            3-layer fog architecture — terminal devices, fog nodes, and cloud — optimized via IPSO &amp; IACO (Wang &amp; Li, 2019).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-4 py-2"
          >
            <Download className="w-4 h-4 text-gray-400" /> Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-4 py-2"
          >
            <FileJson className="w-4 h-4 text-gray-400" /> Export JSON
          </button>
          <button
            onClick={resetSimulation}
            disabled={loading}
            className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-4 py-2"
          >
            <RefreshCw className={clsx('w-4 h-4 text-gray-400', loading && 'animate-spin')} /> Reset
          </button>
        </div>
      </div>

      {/* ── SYSTEM OVERVIEW & 3-LAYER ARCHITECTURE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-500" />
            3-Layer Fog Architecture
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ArchLayer
              icon={Smartphone}
              title="Terminal Layer"
              subtitle="IoT / Edge Devices"
              count={fogInfo?.currentState.terminalDevices ?? terminalDevices.length}
              color="cyan"
              description="Sensors, cameras, robot arms generating tasks"
            />
            <ArchLayer
              icon={Cloud}
              title="Fog Layer"
              subtitle="Edge Compute Nodes"
              count={fogInfo?.currentState.fogNodes ?? fogNodes.length}
              color="purple"
              description="HH/IPSO/IACO scheduling across fog nodes"
            />
            <ArchLayer
              icon={Server}
              title="Cloud Layer"
              subtitle="Central Orchestration"
              count={fogInfo?.currentState.pendingTasks ?? fogTasks.length}
              color="indigo"
              description="Task queue, ML predictions, analytics"
            />
          </div>
          {fogInfo && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-bold text-gray-700 dark:text-gray-300">{fogInfo.algorithm}</span>
              {' — '}
              {fogInfo.reference}
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-purple-500/20">
          <h3 className="text-lg font-bold mb-4">System Status</h3>
          <div className="space-y-4">
            <StatusRow label="Fog Nodes" value={fogNodes.length} />
            <StatusRow label="Terminal Devices" value={terminalDevices.length} />
            <StatusRow label="Pending Tasks" value={fogTasks.length} />
            <StatusRow label="Algorithms" value={fogInfo?.capabilities.algorithms.length ?? 6} />
          </div>
          {fogInfo?.capabilities.features && (
            <div className="mt-5 pt-4 border-t border-white/20">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Capabilities</p>
              <div className="flex flex-wrap gap-1.5">
                {fogInfo.capabilities.features.slice(0, 3).map(f => (
                  <span key={f} className="px-2 py-0.5 bg-white/15 rounded text-[10px] font-medium">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
              Task Batch Size
            </label>
            <input
              type="number"
              value={taskCount}
              onChange={e => setTaskCount(parseInt(e.target.value) || 50)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
              min={10}
              max={500}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
              Primary Algorithm
            </label>
            <div className="relative">
              <Settings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedAlgorithm}
                onChange={e => setSelectedAlgorithm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer"
              >
                <option value="hh">Hybrid Heuristic (HH)</option>
                <option value="ipso">IPSO</option>
                <option value="iaco">IACO</option>
                <option value="fcfs">FCFS</option>
                <option value="rr">Round Robin</option>
                <option value="min-min">Min-Min</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              onClick={runSchedule}
              disabled={loading || chartsLoading}
              className="flex-1 min-w-[140px] btn btn-primary flex items-center justify-center gap-2 py-2.5 font-bold shadow-lg shadow-primary-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Simulation
            </button>
            <button
              onClick={runComparison}
              disabled={loading || chartsLoading}
              className="flex-1 min-w-[140px] btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 py-2.5 font-bold shadow-lg shadow-purple-500/20 border-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
              Compare All 6
            </button>
            <button
              onClick={loadBenchmarkCharts}
              disabled={loading || chartsLoading}
              className="flex-1 min-w-[140px] btn btn-secondary flex items-center justify-center gap-2 py-2.5 font-bold"
            >
              {chartsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {chartsLoaded ? 'Reload Charts' : 'Load Charts'}
            </button>
          </div>
        </div>
      </div>

      {/* ── LIVE SCHEDULE RESULTS ── */}
      {scheduleResult && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ResultCard label="Total Delay" value={`${scheduleResult.metrics.totalDelay.toFixed(2)}s`} icon={Clock} color="blue" />
            <ResultCard label="Energy Used" value={`${scheduleResult.metrics.totalEnergy.toFixed(2)}J`} icon={Zap} color="amber" />
            <ResultCard label="Reliability" value={`${scheduleResult.metrics.reliability.toFixed(1)}%`} icon={ShieldCheck} color="green" />
            <ResultCard label="Compute Time" value={`${scheduleResult.executionTimeMs}ms`} icon={Cpu} color="purple" />
          </div>
          <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-wrap gap-6 text-sm">
            <span><strong className="text-gray-900 dark:text-white">{scheduleResult.summary.tasksScheduled}</strong> tasks scheduled</span>
            <span><strong className="text-gray-900 dark:text-white">{scheduleResult.summary.fogNodesUsed}</strong> fog nodes used</span>
            <span>Avg delay: <strong className="text-gray-900 dark:text-white">{scheduleResult.summary.avgDelayPerTask.toFixed(3)}s</strong></span>
            <span>Avg energy: <strong className="text-gray-900 dark:text-white">{scheduleResult.summary.avgEnergyPerTask.toFixed(3)}J</strong></span>
            <span className="text-primary-600 dark:text-primary-400 font-bold">{scheduleResult.algorithm}</span>
          </div>
        </div>
      )}

      {/* ── COMPARISON TABLE & IMPROVEMENTS ── */}
      {comparison && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                Live Algorithm Comparison
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {comparison.testParameters.taskCount} tasks · {comparison.testParameters.fogNodeCount} fog nodes · {comparison.testParameters.deviceCount} devices
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] uppercase font-bold text-gray-500 tracking-widest border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4">Algorithm</th>
                    <th className="px-6 py-4">Delay (s)</th>
                    <th className="px-6 py-4">Energy (J)</th>
                    <th className="px-6 py-4">Reliability (%)</th>
                    <th className="px-6 py-4">Runtime (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {comparisonTableRows.map((row, i) => (
                    <tr key={row.label} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-900/40', i === 0 && 'bg-purple-50/50 dark:bg-purple-900/10')}>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{row.label}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{row.totalDelay.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{row.totalEnergy.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{row.reliability.toFixed(1)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{row.executionTimeMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ImprovementCard
              title="HH vs Round-Robin"
              delay={comparison.improvements.hhVsRoundRobin.delayReduction}
              energy={comparison.improvements.hhVsRoundRobin.energyReduction}
              reliability={comparison.improvements.hhVsRoundRobin.reliabilityGain}
            />
            <ImprovementCard
              title="HH vs FCFS"
              delay={comparison.improvements.hhVsFCFS.delayReduction}
              energy={comparison.improvements.hhVsFCFS.energyReduction}
              reliability={comparison.improvements.hhVsFCFS.reliabilityGain}
            />
            <ImprovementCard
              title="HH vs Min-Min"
              delay={comparison.improvements.hhVsMinMin.delayReduction}
              energy={comparison.improvements.hhVsMinMin.energyReduction}
              reliability={comparison.improvements.hhVsMinMin.reliabilityGain}
            />
          </div>
        </div>
      )}

      {/* ── CHARTS ROW 1: Radar + Completion Time ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Algorithm Spectrum</h3>
          {comparison ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} axisLine={false} tick={false} />
                  <Radar name="HH" dataKey="HH" stroke={ALGO_COLORS.HH} fill={ALGO_COLORS.HH} fillOpacity={0.5} />
                  <Radar name="IPSO" dataKey="IPSO" stroke={ALGO_COLORS.IPSO} fill={ALGO_COLORS.IPSO} fillOpacity={0.2} />
                  <Radar name="IACO" dataKey="IACO" stroke={ALGO_COLORS.IACO} fill={ALGO_COLORS.IACO} fillOpacity={0.2} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartPlaceholder message='Run "Compare All 6" to see spectrum analysis' />
          )}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Completion Time vs Task Count</h3>
          <p className="text-xs text-gray-500 mb-4">Figure 5 — Wang &amp; Li (2019)</p>
          {metricsLoading || chartsLoading ? (
            <ChartLoading />
          ) : !chartsLoaded ? (
            <ChartPlaceholder message='Click "Load Charts" to generate Figures 5–7 (takes 1–2 min)' />
          ) : completionTimeData.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={completionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {CHART_ALGOS.map(alg => (
                    <Line
                      key={alg}
                      type="monotone"
                      dataKey={alg}
                      stroke={ALGO_COLORS[alg]}
                      strokeWidth={alg === 'HH' ? 3 : 2}
                      dot={{ r: alg === 'HH' ? 4 : 3, fill: ALGO_COLORS[alg] }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartPlaceholder message="No benchmark data available" />
          )}
        </div>
      </div>

      {/* ── CHARTS ROW 2: Energy + Reliability ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Energy Consumption</h3>
          <p className="text-xs text-gray-500 mb-4">Figure 6 — Total energy (Joules)</p>
          {metricsLoading || chartsLoading ? (
            <ChartLoading />
          ) : !chartsLoaded ? (
            <ChartPlaceholder message='Click "Load Charts" to view energy benchmarks' />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energyData}>
                  <defs>
                    <linearGradient id="energyHH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ALGO_COLORS.HH} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={ALGO_COLORS.HH} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="HH" stroke={ALGO_COLORS.HH} strokeWidth={3} fill="url(#energyHH)" />
                  {CHART_ALGOS.filter(a => a !== 'HH').map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={2} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Service Reliability</h3>
          <p className="text-xs text-gray-500 mb-4">Figure 7 — % tasks within max tolerance time</p>
          {metricsLoading || chartsLoading ? (
            <ChartLoading />
          ) : !chartsLoaded ? (
            <ChartPlaceholder message='Click "Load Charts" to view reliability benchmarks' />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reliabilityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  {CHART_ALGOS.map(alg => (
                    <Line
                      key={alg}
                      type="monotone"
                      dataKey={alg}
                      stroke={ALGO_COLORS[alg]}
                      strokeWidth={alg === 'HH' ? 3 : 2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── FIGURE 8: Tolerance vs Reliability ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Reliability vs Maximum Tolerance Time</h3>
        <p className="text-xs text-gray-500 mb-4">Figure 8 — 200 tasks, tolerance 10–100s (Wang &amp; Li, 2019)</p>
        {toleranceLoading || chartsLoading ? (
          <ChartLoading />
        ) : !chartsLoaded ? (
          <ChartPlaceholder message='Click "Load Charts" to view Figure 8 tolerance analysis' />
        ) : toleranceChartData.length > 0 ? (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toleranceChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                <XAxis dataKey="tolerance" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} label={{ value: 'Tolerance (s)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend />
                {(['HH', 'IPSO', 'IACO', 'Round Robin'] as const).map(alg => (
                  <Bar key={alg} dataKey={alg} fill={ALGO_COLORS[alg]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartPlaceholder message="Tolerance benchmark data unavailable" />
        )}
      </div>

      {/* ── FOG NODES TABLE ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Fog Nodes</h3>
            <p className="text-sm text-gray-500">Real-time resource utilization across the edge network.</p>
          </div>
          <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold rounded-lg uppercase tracking-wider">
            {fogNodes.length} Nodes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] uppercase font-bold text-gray-500 tracking-widest border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Edge Node</th>
                <th className="px-6 py-4">Compute Capability</th>
                <th className="px-6 py-4">Network Speed</th>
                <th className="px-6 py-4">Current Load</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {fogNodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">No fog nodes registered</td>
                </tr>
              ) : (
                fogNodes.map(node => (
                  <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                          <Cloud className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{node.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">{node.computingResourceGHz} GHz</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">{node.networkBandwidthMbps} Mbps</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full transition-all duration-500',
                              Number(node.currentLoadPercent) > 80 ? 'bg-red-500' : Number(node.currentLoadPercent) > 50 ? 'bg-amber-500' : 'bg-primary-500'
                            )}
                            style={{ width: `${node.currentLoadPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 min-w-[30px]">{node.currentLoadPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Online
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TERMINAL DEVICES + FOG TASKS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Terminal Devices</h3>
            <p className="text-sm text-gray-500">{terminalDevices.length} IoT endpoints generating tasks</p>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/90">
                <tr className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                  <th className="px-6 py-3">Device</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Energy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {terminalDevices.slice(0, 15).map(device => (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{device.name}</td>
                    <td className="px-6 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        device.isMobile ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {device.isMobile ? 'Mobile' : 'Fixed'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-500">
                      {formatResidualEnergy(device.residualEnergy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pending Fog Tasks</h3>
            <p className="text-sm text-gray-500">{fogTasks.length} tasks awaiting scheduling</p>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/90">
                <tr className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                  <th className="px-6 py-3">Task</th>
                  <th className="px-6 py-3">Data Size</th>
                  <th className="px-6 py-3">Tolerance</th>
                  <th className="px-6 py-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {fogTasks.slice(0, 15).map(task => (
                  <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{task.name}</td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-500">{task.dataSizeMb ?? `${task.dataSize.toFixed(1)} MB`}</td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-500">{task.maxToleranceTimeSec ?? `${task.maxToleranceTime}s`}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded">
                        P{task.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ALGORITHM INSIGHTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InfoCard
          title="IPSO Strategy"
          subtitle="Global Optimization"
          description="Adaptive inertia weight with contraction factor for fast convergence. Ideal for broad exploration of the solution space."
          icon={Cpu}
          color="indigo"
          id="ipso"
        />
        <InfoCard
          title="IACO Strategy"
          subtitle="Local Refinement"
          description="Regulatory factor for path selection and pheromone updates. Provides high-precision local search for optimal allocation."
          icon={Settings}
          color="cyan"
          id="iaco"
        />
        <InfoCard
          title="Hybrid Advantage"
          subtitle="Best of Both Worlds"
          description="Combines IPSO's speed with IACO's precision to minimize delay/energy while maintaining reliability."
          icon={Zap}
          color="purple"
          id="hybrid"
        />
      </div>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      <p className="text-sm">Running benchmark simulations…</p>
    </div>
  );
}

function ChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 space-y-4">
      <BarChart2 className="w-12 h-12 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ArchLayer({ icon: Icon, title, subtitle, count, color, description }: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  count: number;
  color: 'cyan' | 'purple' | 'indigo';
  description: string;
}) {
  const colors = {
    cyan: 'from-cyan-500 to-blue-600',
    purple: 'from-purple-500 to-indigo-600',
    indigo: 'from-indigo-500 to-violet-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
      <div className={clsx('w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-3', colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{subtitle}</p>
      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>
      <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{count}</p>
      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm opacity-80">{label}</span>
      <span className="text-xl font-black">{value}</span>
    </div>
  );
}

function ImprovementCard({ title, delay, energy, reliability }: {
  title: string;
  delay: string;
  energy?: string;
  reliability: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1a2234] rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-3">{title}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Delay reduction</span>
          <span className="font-bold text-emerald-600">{delay}</span>
        </div>
        {energy && (
          <div className="flex justify-between">
            <span className="text-gray-500">Energy reduction</span>
            <span className="font-bold text-emerald-600">{energy}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Reliability gain</span>
          <span className="font-bold text-blue-600">{reliability}</span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: 'blue' | 'amber' | 'green' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-blue-500',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-l-amber-500',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-l-green-500',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-l-purple-500',
  };

  return (
    <div className={clsx('bg-white dark:bg-[#1a2234] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm border-l-4', colors[color])}>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
        <Icon className="w-5 h-5 opacity-50" strokeWidth={1.5} />
      </div>
      <p className="text-3xl font-black tracking-tight text-gray-900 dark:text-white font-mono">{value}</p>
    </div>
  );
}

function InfoCard({ title, subtitle, description, icon: Icon, color, id }: {
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: 'indigo' | 'cyan' | 'purple';
  id: string;
}) {
  const colors = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-[#1a2234] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className={clsx('p-3 rounded-xl', colors[color])}>
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-xs font-bold text-primary-500 uppercase tracking-widest">{subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      <Link
        to={`/algorithm-details/${id}`}
        className="mt-4 flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest"
      >
        Read More <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
