import { useState, useEffect, useCallback } from 'react';
import { aiApi, experimentsApi, fogApi, ExperimentResult } from '../lib/api';
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
  AreaChart,
  Area,
} from 'recharts';
import { 
  IconFlask, 
  IconPlayerPlay, 
  IconDownload, 
  IconCircleCheck, 
  IconCircleX, 
  IconLoader2, 
  IconBolt, 
  IconShield, 
  IconClock, 
  IconFileTypeJs,
  IconInfoCircle,
  IconExternalLink,
  IconChartBar,
  IconDotsVertical,
  IconSettings,
  IconPlus
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import ExperimentWizard from '../components/ExperimentWizard';

const ALGO_COLORS: Record<string, string> = {
  HH: '#8b5cf6',
  IPSO: '#3b82f6',
  IACO: '#06b6d4',
  RR: '#f43f5e',
  MinMin: '#10b981',
  FCFS: '#94a3b8',
  cuOpt: '#76b900', // NVIDIA Green
};

type ExperimentType = 'all' | 'energy' | 'reliability_taskcount' | 'reliability_tolerance' | 'completion_time';

export default function Experiments() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentType>('all');
  const [iterations, setIterations] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [showScenarioGenerator, setShowScenarioGenerator] = useState(false);
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  useEffect(() => {
    experimentsApi.getResults().then(r => {
      if (r && Array.isArray(r.files)) {
        setSavedFiles(r.files);
      }
    }).catch(() => {});
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
    <div className="max-w-[1600px] mx-auto pb-12 space-y-8 animate-fade-in">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Experimental Laboratory
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full uppercase tracking-widest">Research Mode</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Reproducing Figure 5–8 benchmarks from Juan Wang & Di Li (2019).</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-all shadow-lg shadow-primary-500/20 active:scale-95"
          >
            <IconPlus className="w-4 h-4" />
            New Experiment
          </button>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 shadow-sm flex items-center gap-2">
            <IconInfoCircle className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Reference: Sensors 2019</span>
          </div>
          <a 
            href="https://doi.org/10.3390/s19051023" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all flex items-center justify-center"
          >
             <IconExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
      
      {/* ── AI SCENARIO GENERATOR MODAL ── */}
      {showScenarioGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-8 max-w-xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl animate-scale-up">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                 <IconPlus className="w-6 h-6 text-primary-500" />
                 AI Scenario Generator
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Describe a research scenario, and Nova will generate a specialized batch of synthetic tasks using SDG (Synthetic Data Generation).</p>
              
              <div className="space-y-4">
                 <textarea 
                   value={scenarioDescription}
                   onChange={e => setScenarioDescription(e.target.value)}
                   placeholder="e.g., Generate a high-priority medical emergency scenario with large data processing tasks..."
                   className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-4 focus:ring-primary-500/10 outline-none transition-all resize-none"
                 />
                 
                 <div className="flex gap-3">
                    <button 
                      onClick={() => setShowScenarioGenerator(false)}
                      className="flex-1 px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        setIsGeneratingScenario(true);
                        try {
                          const generatedTasks = await aiApi.generateScenario(scenarioDescription);
                          // Inject into Fog Lab
                          await fogApi.addBulkTasks(generatedTasks);
                          
                          setShowScenarioGenerator(false);
                          setScenarioDescription('');
                          
                          // Success notification (simulated here since we don't have a direct hook, 
                          // but the user will see it in the Fog page)
                          alert(`Success! Nova generated ${generatedTasks.length} tasks for this scenario.`);
                          window.location.href = '/fog-computing';
                        } catch (e) {
                          console.error(e);
                          alert('Failed to generate scenario. Please check your API key.');
                        } finally {
                          setIsGeneratingScenario(false);
                        }
                      }}
                      disabled={isGeneratingScenario || !scenarioDescription.trim()}
                      className="flex-[2] px-6 py-3 rounded-2xl bg-primary-600 text-white font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      {isGeneratingScenario ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconBolt className="w-5 h-5" />}
                      Generate Scenario
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <ExperimentWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />


      {/* ── CONTROLS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
             <IconFlask className="w-32 h-32" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Experiment Configurator</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Benchmark Type</label>
              <select
                value={selectedExperiment}
                onChange={e => setSelectedExperiment(e.target.value as ExperimentType)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer"
              >
                <option value="all">Comprehensive Analysis</option>
                <option value="energy">Energy Consumption (Fig. 6)</option>
                <option value="completion_time">Completion Time (Fig. 5)</option>
                <option value="reliability_taskcount">Reliability Bench (Fig. 7)</option>
                <option value="reliability_tolerance">Tolerance Stress (Fig. 8)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Sample Iterations</label>
              <input
                type="number"
                min={1}
                max={10}
                value={iterations}
                onChange={e => setIterations(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
              />
            </div>

            <button
              onClick={runExperiment}
              disabled={loading}
              className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary-500/20"
            >
              {loading ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconPlayerPlay className="w-5 h-5" />}
              {loading ? 'Simulating...' : 'Execute Benchmark'}
            </button>
          </div>

          {error && <p className="mt-4 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}
        </div>

        <div className="lg:col-span-1 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-xl shadow-primary-500/20 flex flex-col justify-between">
           <div>
              <h3 className="text-xl font-bold mb-2">Simulation Status</h3>
              <p className="text-primary-100 text-sm leading-relaxed mb-6">
                {loading ? 'Currently running complex heuristic calculations across 10 virtual fog nodes.' : 'System ready for next experimental batch.'}
              </p>
           </div>
           <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold opacity-80">
                 <span>{loading ? 'Simulation Progress' : 'Last Run Status'}</span>
                 <span>{loading ? '45%' : 'Complete'}</span>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                 <div className={clsx("h-full bg-white transition-all duration-1000", loading ? "w-[45%] animate-pulse" : "w-full")} />
              </div>
           </div>
        </div>
      </div>

      {/* ── VALIDATION CHECKS ── */}
      {result?.validation && (
        <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <IconShield className="w-5 h-5 text-emerald-500" />
              Scientific Validation Checklist
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(result.validation).map(([key, passed]) => (
                <div 
                  key={key} 
                  className={clsx(
                    "flex items-center gap-3 p-4 rounded-xl border transition-all",
                    passed ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 border-red-100 text-red-700"
                  )}
                >
                   {passed ? <IconCircleCheck className="w-5 h-5" /> : <IconCircleX className="w-5 h-5" />}
                   <span className="text-xs font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* ── BENCHMARK CHARTS ── */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           <ExperimentCard 
              title="Completion Time Bench (Fig. 5)" 
              subtitle="Total delay (s) for 10 fog nodes" 
              icon={IconClock} 
              iconColor="text-blue-500"
           >
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={completionChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'RR', 'MinMin', 'cuOpt'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={3} dot={{ r: 4, fill: ALGO_COLORS[alg], strokeWidth: 2, stroke: '#fff' }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
           </ExperimentCard>

           <ExperimentCard 
              title="Energy Consumption Bench (Fig. 6)" 
              subtitle="Total energy (Joules) per batch" 
              icon={IconBolt} 
              iconColor="text-amber-500"
           >
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={energyChartData}>
                  <defs>
                    <linearGradient id="colorHH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ALGO_COLORS.HH} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={ALGO_COLORS.HH} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Area type="monotone" dataKey="HH" stroke={ALGO_COLORS.HH} strokeWidth={3} fillOpacity={1} fill="url(#colorHH)" />
                  <Line type="monotone" dataKey="IPSO" stroke={ALGO_COLORS.IPSO} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="RR" stroke={ALGO_COLORS.RR} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
           </ExperimentCard>

           <ExperimentCard 
              title="Reliability Bench (Fig. 7)" 
              subtitle="% tasks completed within max tolerance" 
              icon={IconShield} 
              iconColor="text-emerald-500"
           >
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={reliabilityTasksData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tasks" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'cuOpt'].map(alg => (
                    <Line key={alg} type="monotone" dataKey={alg} stroke={ALGO_COLORS[alg]} strokeWidth={3} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
           </ExperimentCard>

           <ExperimentCard 
              title="Tolerance Stress Test (Fig. 8)" 
              subtitle="Reliability vs Max Tolerance Time (s)" 
              icon={IconSettings} 
              iconColor="text-purple-500"
           >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={toleranceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="tolerance" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  {['HH', 'IPSO', 'IACO', 'cuOpt'].map(alg => (
                    <Bar key={alg} dataKey={alg} fill={ALGO_COLORS[alg]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
           </ExperimentCard>
        </div>
      )}

      {/* ── FOOTER ASSETS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-1 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
               <IconFileTypeJs className="w-4 h-4 text-primary-600" />
               Generated Result Logs
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
               {savedFiles.map(f => (
                 <div key={f} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-transparent hover:border-primary-100 transition-all group">
                    <span className="text-xs font-mono text-gray-500 group-hover:text-primary-600 truncate">{f}</span>
                    <IconDownload className="w-4 h-4 text-gray-300 group-hover:text-primary-500 cursor-pointer" />
                 </div>
               ))}
               {savedFiles.length === 0 && <p className="text-xs text-gray-400 italic">No logs generated yet.</p>}
            </div>
         </div>

         <div className="lg:col-span-2 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl text-primary-600">
                  <IconChartBar className="w-8 h-8" />
               </div>
               <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Batch Export Results</h4>
                  <p className="text-sm text-gray-500">Aggregate all simulation results into a consolidated research paper format.</p>
               </div>
            </div>
            <div className="flex gap-3">
               <button 
                 onClick={() => setShowScenarioGenerator(true)}
                 className="btn btn-secondary bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 px-6 font-bold flex items-center gap-2"
               >
                  <IconFlask className="w-4 h-4" /> AI Scenario
               </button>
               <button className="btn btn-secondary bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 font-bold flex items-center gap-2">
                  <IconDownload className="w-4 h-4" /> Prepare Report
               </button>
            </div>
         </div>
       </div>

      <ExperimentWizard 
        isOpen={showWizard} 
        onClose={() => setShowWizard(false)} 
      />
    </div>
  );
}

function ExperimentCard({ title, subtitle, icon: Icon, iconColor, children }: any) {
  return (
    <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all">
       <div className="flex items-start justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
               <Icon className={clsx("w-5 h-5", iconColor)} />
               {title}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
             <IconDotsVertical className="w-5 h-5" />
          </button>
       </div>
       {children}
    </div>
  );
}
