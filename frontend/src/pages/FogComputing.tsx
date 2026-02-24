import { useState, useEffect } from 'react';
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
} from 'recharts';
import { fogApi, FogMetrics, FogNode, AlgorithmComparison } from '../lib/api';

interface ToleranceReliability {
  maxToleranceTime: number;
  reliability: { hh: number; ipso: number; iaco: number; rr: number };
}

interface ScheduleResult {
  algorithm: string;
  metrics: {
    totalDelay: number;
    totalEnergy: number;
    reliability: number;
    executionTimeMs: number;
  };
  assignments: Array<{
    taskId: string;
    nodeId: string;
    delay: number;
    energy: number;
  }>;
}

export default function FogComputing() {
  const [metrics, setMetrics] = useState<FogMetrics[]>([]);
  const [comparison, setComparison] = useState<AlgorithmComparison | null>(null);
  const [fogNodes, setFogNodes] = useState<FogNode[]>([]);
  const [toleranceData, setToleranceData] = useState<ToleranceReliability[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskCount, setTaskCount] = useState(50);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('hh');
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);

  useEffect(() => {
    fetchMetrics();
    fetchFogNodes();
    fetchToleranceReliability();
  }, []);

  const fetchMetrics = async () => {
    try {
      const data = await fogApi.getMetrics();
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchFogNodes = async () => {
    try {
      const data = await fogApi.getNodes();
      setFogNodes(data);
    } catch (error) {
      console.error('Failed to fetch fog nodes:', error);
    }
  };

  const fetchToleranceReliability = async () => {
    try {
      const data = await fogApi.getToleranceReliability();
      setToleranceData(data.metrics as ToleranceReliability[]);
    } catch (error) {
      console.error('Failed to fetch tolerance-reliability:', error);
    }
  };

  const runComparison = async () => {
    setLoading(true);
    try {
      const data = await fogApi.compare(taskCount);
      setComparison(data);
    } catch (error) {
      console.error('Failed to run comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSchedule = async () => {
    setLoading(true);
    try {
      const data = await fogApi.schedule(selectedAlgorithm) as ScheduleResult;
      setScheduleResult(data);
    } catch (error) {
      console.error('Failed to run schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    setLoading(true);
    try {
      await fogApi.reset(taskCount);
      await fetchMetrics();
      await fetchFogNodes();
      await fetchToleranceReliability();
      setScheduleResult(null);
      setComparison(null);
    } catch (error) {
      console.error('Failed to reset:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chart data transformations
  const completionTimeData = metrics.map(m => ({
    tasks: m.taskCount,
    'HH': m.completionTime.hh,
    'IPSO': m.completionTime.ipso,
    'IACO': m.completionTime.iaco,
    'Round Robin': m.completionTime.rr,
    'Min-Min': m.completionTime.minMin,
  }));

  const energyData = metrics.map(m => ({
    tasks: m.taskCount,
    'HH': m.energyConsumption.hh,
    'IPSO': m.energyConsumption.ipso,
    'IACO': m.energyConsumption.iaco,
    'Round Robin': m.energyConsumption.rr,
    'Min-Min': m.energyConsumption.minMin,
  }));

  const reliabilityData = metrics.map(m => ({
    tasks: m.taskCount,
    'HH': m.reliability.hh,
    'IPSO': m.reliability.ipso,
    'IACO': m.reliability.iaco,
    'Round Robin': m.reliability.rr,
    'Min-Min': m.reliability.minMin,
  }));

  const toleranceChartData = toleranceData.map(m => ({
    time: m.maxToleranceTime,
    'HH': m.reliability.hh,
    'IPSO': m.reliability.ipso,
    'IACO': m.reliability.iaco,
    'RR': m.reliability.rr,
  }));

  const radarData = comparison
    ? [
        {
          metric: 'Speed',
          HH: 100 - (comparison.hybridHeuristic.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs) * 100),
          IPSO: 100 - (comparison.ipso.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs) * 100),
          IACO: 100 - (comparison.iaco.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs) * 100),
          RR: 100 - (comparison.roundRobin.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs) * 100),
          MinMin: 100 - (comparison.minMin.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs) * 100),
        },
        {
          metric: 'Low Delay',
          HH: 100 - (comparison.hybridHeuristic.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay) * 100),
          IPSO: 100 - (comparison.ipso.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay) * 100),
          IACO: 100 - (comparison.iaco.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay) * 100),
          RR: 100 - (comparison.roundRobin.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay) * 100),
          MinMin: 100 - (comparison.minMin.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay) * 100),
        },
        {
          metric: 'Energy Efficiency',
          HH: 100 - (comparison.hybridHeuristic.totalEnergy / Math.max(comparison.hybridHeuristic.totalEnergy, comparison.ipso.totalEnergy, comparison.iaco.totalEnergy, comparison.roundRobin.totalEnergy, comparison.minMin.totalEnergy) * 100),
          IPSO: 100 - (comparison.ipso.totalEnergy / Math.max(comparison.hybridHeuristic.totalEnergy, comparison.ipso.totalEnergy, comparison.iaco.totalEnergy, comparison.roundRobin.totalEnergy, comparison.minMin.totalEnergy) * 100),
          IACO: 100 - (comparison.iaco.totalEnergy / Math.max(comparison.hybridHeuristic.totalEnergy, comparison.ipso.totalEnergy, comparison.iaco.totalEnergy, comparison.roundRobin.totalEnergy, comparison.minMin.totalEnergy) * 100),
          RR: 100 - (comparison.roundRobin.totalEnergy / Math.max(comparison.hybridHeuristic.totalEnergy, comparison.ipso.totalEnergy, comparison.iaco.totalEnergy, comparison.roundRobin.totalEnergy, comparison.minMin.totalEnergy) * 100),
          MinMin: 100 - (comparison.minMin.totalEnergy / Math.max(comparison.hybridHeuristic.totalEnergy, comparison.ipso.totalEnergy, comparison.iaco.totalEnergy, comparison.roundRobin.totalEnergy, comparison.minMin.totalEnergy) * 100),
        },
        {
          metric: 'Reliability',
          HH: comparison.hybridHeuristic.reliability,
          IPSO: comparison.ipso.reliability,
          IACO: comparison.iaco.reliability,
          RR: comparison.roundRobin.reliability,
          MinMin: comparison.minMin.reliability,
        },
      ]
    : [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl lg:text-3xl font-bold">Fog Computing Task Scheduler</h1>
        <p className="mt-2 opacity-90">
          Hybrid Heuristic (HH) Algorithm - Combining IPSO & IACO for optimal task scheduling
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full">IPSO: Improved Particle Swarm Optimization</span>
          <span className="bg-white/20 px-3 py-1 rounded-full">IACO: Improved Ant Colony Optimization</span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Count</label>
            <input
              type="number"
              value={taskCount}
              onChange={(e) => setTaskCount(parseInt(e.target.value) || 50)}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min={10}
              max={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Algorithm</label>
            <select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="hh">Hybrid Heuristic (HH)</option>
              <option value="ipso">IPSO Only</option>
              <option value="iaco">IACO Only</option>
              <option value="rr">Round Robin</option>
              <option value="min-min">Min-Min</option>
            </select>
          </div>
          <button
            onClick={runSchedule}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Schedule'}
          </button>
          <button
            onClick={runComparison}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            Compare All
          </button>
          <button
            onClick={resetSimulation}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            Reset
          </button>
          <div className="border-l border-gray-300 dark:border-gray-600 pl-4 flex gap-2">
            <a
              href="/api/fog/export/csv?type=all"
              download
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              📊 Export CSV
            </a>
            <a
              href="/api/fog/export/json"
              download
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm"
            >
              📋 Export JSON
            </a>
          </div>
        </div>
      </div>

      {/* Schedule Result */}
      {scheduleResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Schedule Result - {scheduleResult.algorithm}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Delay</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{scheduleResult.metrics.totalDelay.toFixed(2)}s</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Energy</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{scheduleResult.metrics.totalEnergy.toFixed(2)}J</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Reliability</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{scheduleResult.metrics.reliability}%</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Execution Time</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{scheduleResult.metrics.executionTimeMs}ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Algorithm Comparison */}
      {comparison && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Algorithm Comparison (Figure 5-7 from Paper)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* HH */}
            <div className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 p-4 rounded-lg border-2 border-purple-300 dark:border-purple-700">
              <h3 className="font-semibold text-purple-800 dark:text-purple-300 text-sm">HH (Hybrid)</h3>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>Delay: <span className="font-bold">{comparison.hybridHeuristic.totalDelay.toFixed(2)}s</span></p>
                <p>Energy: <span className="font-bold">{comparison.hybridHeuristic.totalEnergy.toFixed(2)}J</span></p>
                <p>Reliability: <span className="font-bold">{comparison.hybridHeuristic.reliability}%</span></p>
                <p>Time: <span className="font-bold">{comparison.hybridHeuristic.executionTimeMs}ms</span></p>
              </div>
            </div>
            {/* IPSO */}
            <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 text-sm">IPSO</h3>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>Delay: <span className="font-bold">{comparison.ipso.totalDelay.toFixed(2)}s</span></p>
                <p>Energy: <span className="font-bold">{comparison.ipso.totalEnergy.toFixed(2)}J</span></p>
                <p>Reliability: <span className="font-bold">{comparison.ipso.reliability}%</span></p>
                <p>Time: <span className="font-bold">{comparison.ipso.executionTimeMs}ms</span></p>
              </div>
            </div>
            {/* IACO */}
            <div className="bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:to-cyan-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-cyan-800 dark:text-cyan-300 text-sm">IACO</h3>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>Delay: <span className="font-bold">{comparison.iaco.totalDelay.toFixed(2)}s</span></p>
                <p>Energy: <span className="font-bold">{comparison.iaco.totalEnergy.toFixed(2)}J</span></p>
                <p>Reliability: <span className="font-bold">{comparison.iaco.reliability}%</span></p>
                <p>Time: <span className="font-bold">{comparison.iaco.executionTimeMs}ms</span></p>
              </div>
            </div>
            {/* RR */}
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm">Round Robin</h3>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>Delay: <span className="font-bold">{comparison.roundRobin.totalDelay.toFixed(2)}s</span></p>
                <p>Energy: <span className="font-bold">{comparison.roundRobin.totalEnergy.toFixed(2)}J</span></p>
                <p>Reliability: <span className="font-bold">{comparison.roundRobin.reliability}%</span></p>
                <p>Time: <span className="font-bold">{comparison.roundRobin.executionTimeMs}ms</span></p>
              </div>
            </div>
            {/* Min-Min */}
            <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 dark:text-green-300 text-sm">Min-Min</h3>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>Delay: <span className="font-bold">{comparison.minMin.totalDelay.toFixed(2)}s</span></p>
                <p>Energy: <span className="font-bold">{comparison.minMin.totalEnergy.toFixed(2)}J</span></p>
                <p>Reliability: <span className="font-bold">{comparison.minMin.reliability}%</span></p>
                <p>Time: <span className="font-bold">{comparison.minMin.executionTimeMs}ms</span></p>
              </div>
            </div>
          </div>
          
          {/* Radar Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="HH" dataKey="HH" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
                <Radar name="IPSO" dataKey="IPSO" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                <Radar name="IACO" dataKey="IACO" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                <Radar name="RR" dataKey="RR" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Radar name="MinMin" dataKey="MinMin" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Performance Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Completion Time Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Completion Time vs Task Count (Figure 5)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'bottom' }} />
                <YAxis label={{ value: 'Time (s)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="HH" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 6 }} />
                <Line type="monotone" dataKey="IPSO" stroke="#6366f1" strokeWidth={2} />
                <Line type="monotone" dataKey="IACO" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="Round Robin" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="Min-Min" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Consumption Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Energy Consumption vs Task Count (Figure 6)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tasks" />
                <YAxis label={{ value: 'Energy (J)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="HH" fill="#8b5cf6" />
                <Bar dataKey="IPSO" fill="#6366f1" />
                <Bar dataKey="IACO" fill="#06b6d4" />
                <Bar dataKey="Round Robin" fill="#3b82f6" />
                <Bar dataKey="Min-Min" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reliability Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Reliability vs Task Count Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Reliability vs Task Count (Figure 7)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reliabilityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tasks" label={{ value: 'Tasks', position: 'bottom' }} />
                <YAxis domain={[0, 100]} label={{ value: 'Reliability (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="HH" stroke="#8b5cf6" strokeWidth={3} />
                <Line type="monotone" dataKey="IPSO" stroke="#6366f1" strokeWidth={2} />
                <Line type="monotone" dataKey="IACO" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="Round Robin" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="Min-Min" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reliability vs Max Tolerance Time Chart (Figure 8) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Reliability vs Max Tolerance Time (Figure 8)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={toleranceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Max Tolerance Time (s)', position: 'bottom' }} />
                <YAxis domain={[0, 100]} label={{ value: 'Reliability (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="HH" stroke="#8b5cf6" strokeWidth={3} />
                <Line type="monotone" dataKey="IPSO" stroke="#6366f1" strokeWidth={2} />
                <Line type="monotone" dataKey="IACO" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="RR" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Fog Nodes Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Fog Nodes Status</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Node</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Computing (GHz)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bandwidth (Mbps)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Load</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fogNodes.map((node) => (
                <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{node.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{node.computingResourceGHz}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{node.networkBandwidthMbps}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${node.currentLoadPercent}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{node.currentLoadPercent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Algorithm Description */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Algorithm Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">IPSO (Improved PSO)</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li>Adaptive inertia weight with contraction factor</li>
              <li>Sigmoid function for binary particle conversion</li>
              <li>Fast convergence for global exploration</li>
              <li>Velocity clamping for stability</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">IACO (Improved ACO)</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li>Improved heuristic information formula</li>
              <li>Regulatory factor for path selection</li>
              <li>Enhanced pheromone update strategy</li>
              <li>High precision local optimization</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Hybrid Heuristic (HH)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The HH algorithm combines IPSO and IACO to achieve both fast convergence speed (from PSO) 
            and high solution accuracy (from ACO). PSO first explores the solution space rapidly, 
            then ACO refines the solution for optimal task-to-fog-node allocation, minimizing 
            both delay and energy consumption while maintaining reliability constraints.
          </p>
        </div>
      </div>
    </div>
  );
}
