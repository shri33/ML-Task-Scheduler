import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { experimentsApi, ExperimentResult } from '../lib/api';
import {
  FlaskConical,
  Play,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Shield,
  Clock,
  FileJson,
} from 'lucide-react';

const ALGO_COLORS: Record<string, string> = {
  HH: '#10b981',
  IPSO: '#3b82f6',
  IACO: '#f59e0b',
  RR: '#ef4444',
  MinMin: '#8b5cf6',
  FCFS: '#6b7280',
};

type ExperimentType = 'all' | 'energy' | 'reliability_taskcount' | 'reliability_tolerance' | 'completion_time';

export default function Experiments() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentType>('all');
  const [iterations, setIterations] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);

  // Load previously saved files
  useEffect(() => {
    experimentsApi.getResults().then(r => setSavedFiles(r.files)).catch(() => {});
  }, [result]);

  const runExperiment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentsApi.run(selectedExperiment, iterations);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Experiment failed');
    } finally {
      setLoading(false);
    }
  }, [selectedExperiment, iterations]);

  // Transform data for charts
  const energyChartData = result?.taskCountResults?.map(r => ({
    tasks: r.taskCount,
    HH: r.hh.energy,
    IPSO: r.ipso.energy,
    IACO: r.iaco.energy,
    RR: r.rr.energy,
    MinMin: r.minMin.energy,
  }));

  const completionChartData = result?.taskCountResults?.map(r => ({
    tasks: r.taskCount,
    HH: r.hh.delay,
    IPSO: r.ipso.delay,
    IACO: r.iaco.delay,
    RR: r.rr.delay,
    MinMin: r.minMin.delay,
  }));

  const reliabilityTasksData = result?.taskCountResults?.map(r => ({
    tasks: r.taskCount,
    HH: r.hh.reliability,
    IPSO: r.ipso.reliability,
    IACO: r.iaco.reliability,
    RR: r.rr.reliability,
    MinMin: r.minMin.reliability,
  }));

  const toleranceData = result?.toleranceResults?.map(r => ({
    tolerance: r.maxToleranceTime,
    HH: r.hh,
    IPSO: r.ipso,
    IACO: r.iaco,
    RR: r.rr,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="h-7 w-7 text-primary-600" />
            Experiments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Reproduce Figures 5–8 from Wang &amp; Li (2019) – Hybrid Heuristic Algorithm for Fog Computing
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Run Experiment</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Experiment Type
            </label>
            <select
              value={selectedExperiment}
              onChange={e => setSelectedExperiment(e.target.value as ExperimentType)}
              className="block w-64 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
            >
              <option value="all">All Experiments</option>
              <option value="energy">Energy Consumption (Figure 6)</option>
              <option value="completion_time">Completion Time (Figure 5)</option>
              <option value="reliability_taskcount">Reliability vs Tasks (Figure 7)</option>
              <option value="reliability_tolerance">Reliability vs Tolerance (Figure 8)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Iterations
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={iterations}
              onChange={e => setIterations(Number(e.target.value))}
              className="block w-24 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
            />
          </div>
          <button
            onClick={runExperiment}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {loading ? 'Running…' : 'Run Experiment'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        {result && (
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Runtime: <strong>{result.runtimeSeconds}s</strong></span>
            <span>Files exported: <strong>{result.exportedFiles.length}</strong></span>
          </div>
        )}
      </div>

      {/* Validation Checklist */}
      {result?.validation && Object.keys(result.validation).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            Validation Checklist
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(result.validation).map(([key, passed]) => (
              <div
                key={key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  passed
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}
              >
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {key.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Figure 5: Completion Time */}
          {completionChartData && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Completion Time vs Task Count (Figure 5)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Total delay (seconds) for varying numbers of tasks on 10 fog nodes
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={completionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Delay (s)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'RR', 'MinMin'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Figure 6: Energy Consumption */}
          {energyChartData && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Energy Consumption vs Task Count (Figure 6)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Total energy (Joules) — HH should be lowest, RR highest
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={energyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Energy (J)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'RR', 'MinMin'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Figure 7: Reliability vs Task Count */}
          {reliabilityTasksData && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Reliability vs Task Count (Figure 7)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                % tasks completed within max tolerance time — decreases as task count rises
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={reliabilityTasksData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Reliability (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'RR', 'MinMin'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Figure 8: Reliability vs Tolerance */}
          {toleranceData && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Reliability vs Tolerance Time (Figure 8)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                200 tasks, tolerance 10–100s — reliability increases with more tolerance
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={toleranceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tolerance" label={{ value: 'Tolerance (s)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Reliability (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'RR'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Runtime Performance */}
      {result?.taskCountResults && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Scheduler Runtime (ms)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={result.taskCountResults.map(r => ({
              tasks: r.taskCount,
              HH: r.hh.time,
              IPSO: r.ipso.time,
              IACO: r.iaco.time,
              RR: r.rr.time,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {['HH', 'IPSO', 'IACO', 'RR'].map(alg => (
                <Bar key={alg} dataKey={alg} fill={ALGO_COLORS[alg]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Exported Files */}
      {savedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary-600" />
            Saved Result Files
          </h3>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {savedFiles.map(f => (
              <li key={f} className="flex items-center gap-2">
                <Download className="h-3 w-3" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
