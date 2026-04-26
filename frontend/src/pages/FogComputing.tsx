import { useState, useEffect } from 'react';
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
} from 'recharts';
import { fogApi, FogMetrics, FogNode, AlgorithmComparison } from '../lib/api';
import { 
  IconCloud, 
  IconSettings, 
  IconPlayerPlay, 
  IconRefresh, 
  IconChartBar, 
  IconDownload,
  IconCpu,
  IconBolt,
  IconShieldCheck,
  IconClock,
  IconChevronRight,
  IconDotsVertical
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';

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
  const [loading, setLoading] = useState(false);
  const [taskCount, setTaskCount] = useState(50);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('hh');
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchMetrics();
    fetchFogNodes();
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

  const runComparison = async () => {
    setLoading(true);
    try {
      const data = await fogApi.compare(taskCount);
      setComparison(data);
      toast.success('Comparison Complete', `Simulation run for ${taskCount} tasks across all algorithms.`);
    } catch (error) {
      toast.error('Simulation Failed', 'Could not complete algorithm comparison.');
    } finally {
      setLoading(false);
    }
  };

  const runSchedule = async () => {
    setLoading(true);
    try {
      const data = await fogApi.schedule(selectedAlgorithm) as ScheduleResult;
      setScheduleResult(data);
      toast.success('Schedule Optimized', `Allocated tasks using ${selectedAlgorithm.toUpperCase()} algorithm.`);
    } catch (error) {
      toast.error('Scheduling Failed', 'Could not run the selected algorithm.');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    setLoading(true);
    try {
      await fogApi.reset(taskCount);
      await Promise.all([
        fetchMetrics(),
        fetchFogNodes()
      ]);
      setScheduleResult(null);
      setComparison(null);
      toast.info('Simulation Reset', 'All metrics and node states have been cleared.');
    } catch (error) {
      toast.error('Reset Failed', 'Could not clear simulation state.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      let blob;
      let filename;
      if (format === 'csv') {
        blob = await fogApi.exportCsv();
        filename = `fog_metrics_${Date.now()}.csv`;
      } else {
        const data = await fogApi.exportJson();
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `fog_metrics_${Date.now()}.json`;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export Successful', `Downloaded metrics as ${format.toUpperCase()}.`);
    } catch (error) {
      toast.error('Export Failed', 'Could not generate report.');
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
    'cuOpt': m.completionTime.cuopt,
  }));

  const energyData = metrics.map(m => ({
    tasks: m.taskCount,
    'HH': m.energyConsumption.hh,
    'IPSO': m.energyConsumption.ipso,
    'IACO': m.energyConsumption.iaco,
    'Round Robin': m.energyConsumption.rr,
    'Min-Min': m.energyConsumption.minMin,
    'cuOpt': m.energyConsumption.cuopt,
  }));

  const reliabilityData = metrics.map(m => ({
    tasks: m.taskCount,
    'HH': m.reliability.hh,
    'IPSO': m.reliability.ipso,
    'IACO': m.reliability.iaco,
    'Round Robin': m.reliability.rr,
    'Min-Min': m.reliability.minMin,
    'cuOpt': m.reliability.cuopt,
  }));

  const radarData = comparison
    ? [
        {
          metric: 'Speed',
          HH: 100 - (comparison.hybridHeuristic.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
          IPSO: 100 - (comparison.ipso.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
          IACO: 100 - (comparison.iaco.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
          RR: 100 - (comparison.roundRobin.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
          MinMin: 100 - (comparison.minMin.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
          cuOpt: 100 - (comparison.cuopt.executionTimeMs / Math.max(comparison.hybridHeuristic.executionTimeMs, comparison.ipso.executionTimeMs, comparison.iaco.executionTimeMs, comparison.roundRobin.executionTimeMs, comparison.minMin.executionTimeMs, comparison.cuopt.executionTimeMs) * 100),
        },
        {
          metric: 'Low Delay',
          HH: 100 - (comparison.hybridHeuristic.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
          IPSO: 100 - (comparison.ipso.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
          IACO: 100 - (comparison.iaco.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
          RR: 100 - (comparison.roundRobin.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
          MinMin: 100 - (comparison.minMin.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
          cuOpt: 100 - (comparison.cuopt.totalDelay / Math.max(comparison.hybridHeuristic.totalDelay, comparison.ipso.totalDelay, comparison.iaco.totalDelay, comparison.roundRobin.totalDelay, comparison.minMin.totalDelay, comparison.cuopt.totalDelay) * 100),
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
          cuOpt: comparison.cuopt.reliability,
        },
      ]
    : [];

  return (
    <div className="max-w-[1600px] mx-auto pb-12 space-y-8 animate-fade-in">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Fog Node Scheduler
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-full uppercase tracking-widest">Hybrid Heuristic</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Optimizing task allocation across edge nodes using IPSO & IACO.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExport('csv')}
            className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-4 py-2"
          >
            <IconDownload className="w-4 h-4 text-gray-400" /> Export CSV
          </button>
          <button 
            onClick={resetSimulation}
            disabled={loading}
            className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-4 py-2"
          >
            <IconRefresh className={clsx("w-4 h-4 text-gray-400", loading && "animate-spin")} /> Reset
          </button>
        </div>
      </div>

      {/* ── CONTROLS & CONFIG ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
           <div className="md:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Task Batch Size</label>
              <div className="relative">
                <IconDotsVertical className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={taskCount}
                  onChange={(e) => setTaskCount(parseInt(e.target.value) || 50)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  min={10} max={500}
                />
              </div>
           </div>

           <div className="md:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Primary Algorithm</label>
              <div className="relative">
                <IconSettings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedAlgorithm}
                  onChange={(e) => setSelectedAlgorithm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer"
                >
                  <option value="hh">Hybrid Heuristic (HH)</option>
                  <option value="ipso">IPSO Only</option>
                  <option value="iaco">IACO Only</option>
                  <option value="rr">Round Robin</option>
                  <option value="min-min">Min-Min</option>
                </select>
              </div>
           </div>

           <div className="md:col-span-2 flex gap-3">
              <button
                onClick={runSchedule}
                disabled={loading}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2 py-2.5 font-bold shadow-lg shadow-primary-500/20"
              >
                <IconPlayerPlay className="w-4 h-4" /> Run Simulation
              </button>
              <button
                onClick={runComparison}
                disabled={loading}
                className="flex-1 btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 py-2.5 font-bold shadow-lg shadow-purple-500/20 border-none"
              >
                <IconChartBar className="w-4 h-4" /> Compare All
              </button>
           </div>
        </div>
      </div>

      {/* ── LIVE RESULTS ── */}
      {scheduleResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
           <ResultCard label="Total Delay" value={`${scheduleResult.metrics.totalDelay.toFixed(2)}s`} icon={IconClock} color="blue" />
           <ResultCard label="Energy Used" value={`${scheduleResult.metrics.totalEnergy.toFixed(2)}J`} icon={IconBolt} color="amber" />
           <ResultCard label="Reliability" value={`${scheduleResult.metrics.reliability}%`} icon={IconShieldCheck} color="green" />
           <ResultCard label="Compute Time" value={`${scheduleResult.metrics.executionTimeMs}ms`} icon={IconBolt} color="purple" />
        </div>
      )}

      {/* ── ANALYSIS & VISUALIZATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Radar Comparison */}
        <div className="lg:col-span-1 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Algorithm Spectrum</h3>
           {comparison ? (
             <div className="h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart data={radarData}>
                   <PolarGrid stroke="#e2e8f0" className="dark:stroke-gray-700" />
                   <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 100]} axisLine={false} tick={false} />
                   <Radar name="HH" dataKey="HH" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                   <Radar name="IPSO" dataKey="IPSO" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                   <Radar name="IACO" dataKey="IACO" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                   <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
           ) : (
             <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 space-y-4">
               <IconChartBar className="w-12 h-12 opacity-20" />
               <p className="text-sm">Run "Compare All" to see spectrum analysis</p>
             </div>
           )}
        </div>

        {/* Performance Trends */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Completion Time vs Complexity</h3>
           <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={completionTimeData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                 <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Line type="monotone" dataKey="HH" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
                 <Line type="monotone" dataKey="IPSO" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                 <Line type="monotone" dataKey="Round Robin" stroke="#94a3b8" strokeWidth={1} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Energy Consumption */}
         <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Energy Consumption Efficiency</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="HH" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="IPSO" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Min-Min" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Reliability Distribution */}
         <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Service Reliability (%)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reliabilityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="stepAfter" dataKey="HH" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                  <Line type="stepAfter" dataKey="IPSO" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* ── FOG NODES TABLE ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Fog Nodes</h3>
            <p className="text-sm text-gray-500">Real-time resource utilization across the edge network.</p>
          </div>
          <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold rounded-lg uppercase tracking-wider">{fogNodes.length} Nodes</span>
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
              {fogNodes.map((node) => (
                <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                          <IconCloud className="w-4 h-4 text-primary-600" />
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
                              "h-full transition-all duration-500",
                              Number(node.currentLoadPercent) > 80 ? "bg-red-500" : Number(node.currentLoadPercent) > 50 ? "bg-amber-500" : "bg-primary-500"
                            )}
                            style={{ width: `${node.currentLoadPercent}%` }}
                          />
                       </div>
                       <span className="text-[10px] font-bold text-gray-500 min-w-[30px]">{node.currentLoadPercent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Online
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ALGORITHM INSIGHTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InfoCard 
          title="IPSO Strategy" 
          subtitle="Global Optimization" 
          description="Adaptive inertia weight with contraction factor for fast convergence. Ideal for broad exploration of the solution space."
          icon={IconCpu}
          color="indigo"
          id="ipso"
        />
        <InfoCard 
          title="IACO Strategy" 
          subtitle="Local Refinement" 
          description="Regulatory factor for path selection and pheromone updates. Provides high-precision local search for optimal allocation."
          icon={IconSettings}
          color="cyan"
          id="iaco"
        />
        <InfoCard 
          title="Hybrid Advantage" 
          subtitle="Best of Both Worlds" 
          description="Combines IPSO's speed with IACO's precision to minimize delay/energy while maintaining reliability."
          icon={IconBolt}
          color="purple"
          id="hybrid"
        />
      </div>

    </div>
  );
}

function ResultCard({ label, value, icon: Icon, color }: any) {
  const colors = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-blue-500",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-l-amber-500",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-l-green-500",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-l-purple-500",
  };

  return (
    <div className={clsx("bg-white dark:bg-[#1a2234] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm border-l-4", (colors as any)[color])}>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
        <Icon className="w-5 h-5 opacity-50" stroke={1.5} />
      </div>
      <p className="text-3xl font-black tracking-tight text-gray-900 dark:text-white font-mono">{value}</p>
    </div>
  );
}

function InfoCard({ title, subtitle, description, icon: Icon, color, id }: any) {
  const colors = {
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    cyan: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-[#1a2234] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className={clsx("p-3 rounded-xl", (colors as any)[color])}>
          <Icon className="w-6 h-6" stroke={1.5} />
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
        Read More <IconChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
