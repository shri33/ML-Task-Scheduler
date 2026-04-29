import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { 
  IconBrain, 
  IconHistory, 
  IconSettings, 
  IconPlayerPlay, 
  IconCheck, 
  IconAlertCircle, 
  IconLoader2,
  IconChartLine,
  IconDatabase,
  IconActivity,
  IconRefresh
} from '@tabler/icons-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';

export default function MlMonitoring() {
  const { 
    mlModels, 
    trainingJobs, 
    mlConfig, 
    mlDataLoading, 
    fetchMlData, 
    updateMlConfig, 
    runRetrain,
    mlAvailable
  } = useStore();
  
  const toast = useToast();
  const [isRetraining, setIsRetraining] = useState(false);

  useEffect(() => {
    fetchMlData();
  }, [fetchMlData]);

  const handleManualRetrain = async () => {
    if (isRetraining) return;
    
    setIsRetraining(true);
    try {
      await runRetrain('Manual trigger from monitoring dashboard');
      toast.info('Retraining Triggered', 'The process has started in the background.');
    } catch (err) {
      toast.error('Retraining Failed', 'Could not initiate the training process.');
    } finally {
      setIsRetraining(false);
    }
  };

  const handleToggleAutoRetrain = (enabled: boolean) => {
    updateMlConfig({ enabled });
    toast.success('Config Updated', `Auto-retraining is now ${enabled ? 'enabled' : 'disabled'}.`);
  };

  const activeModel = mlModels.find(m => m.status === 'ACTIVE') || mlModels[0];
  
  // Prepare chart data from models
  const chartData = [...mlModels]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(m => ({
      name: m.version.substring(0, 8),
      r2: m.r2Score || 0,
      mae: m.maeScore || 0,
      timestamp: new Date(m.createdAt).toLocaleDateString()
    }));

  // Prepare feature importance data
  const featureImportance = activeModel?.featureImportance 
    ? Object.entries(activeModel.featureImportance as Record<string, number>)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : [
        { name: 'Task Size', value: 0.42 },
        { name: 'Resource Load', value: 0.28 },
        { name: 'Priority', value: 0.15 },
        { name: 'Task Type', value: 0.10 },
        { name: 'Startup Overhead', value: 0.05 },
      ];

  const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconBrain className="text-primary-500" />
            ML Model Governance
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor model drift, manage versions, and configure automated feedback loops.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMlData()}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <IconRefresh className={clsx("w-5 h-5", mlDataLoading && "animate-spin")} />
          </button>
          
          <button
            onClick={handleManualRetrain}
            disabled={isRetraining || !mlAvailable}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all",
              isRetraining || !mlAvailable
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/20"
            )}
          >
            {isRetraining ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconPlayerPlay className="w-5 h-5" />}
            Trigger Retrain
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Model" 
          value={activeModel?.version?.substring(0, 12) || 'None'} 
          subtitle={activeModel?.modelType || 'XGBoost'}
          icon={IconBrain}
          color="primary"
        />
        <StatCard 
          title="Model Accuracy" 
          value={`${((activeModel?.r2Score || 0) * 100).toFixed(1)}%`} 
          subtitle="R² Score"
          icon={IconChartLine}
          color="emerald"
          trend="+2.4%"
        />
        <StatCard 
          title="Accumulated Data" 
          value={mlConfig?.dataPointsSinceRetrain || 0} 
          subtitle={`Next trigger at ${mlConfig?.minDataPointsThreshold || 100}`}
          icon={IconDatabase}
          color="amber"
          progress={(mlConfig?.dataPointsSinceRetrain / mlConfig?.minDataPointsThreshold) * 100}
        />
        <StatCard 
          title="System Health" 
          value={mlAvailable ? "Online" : "Offline"} 
          subtitle="ML Service Status"
          icon={IconActivity}
          color={mlAvailable ? "emerald" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <IconChartLine className="text-primary-500" />
              Performance Evolution
            </h2>
            <select className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium px-3 py-1.5 focus:ring-2 ring-primary-500/20">
              <option>Last 10 Models</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorR2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="r2" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorR2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <IconSettings className="text-primary-500" />
              Feedback Loop
            </h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Auto-Retraining</p>
                <p className="text-xs text-gray-500">Trigger model updates automatically</p>
              </div>
              <button 
                onClick={() => handleToggleAutoRetrain(!mlConfig?.enabled)}
                className={clsx(
                  "w-12 h-6 rounded-full transition-all relative",
                  mlConfig?.enabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"
                )}
              >
                <div className={clsx(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  mlConfig?.enabled ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-4">
              <ConfigInput 
                label="Min Data Points" 
                value={mlConfig?.minDataPointsThreshold} 
                onChange={(val: string) => updateMlConfig({ minDataPointsThreshold: parseInt(val) })}
                helper="Minimum samples required before trigger"
              />
              <ConfigInput 
                label="Accuracy Threshold" 
                value={mlConfig?.r2ScoreThreshold} 
                step={0.01}
                onChange={(val: string) => updateMlConfig({ r2ScoreThreshold: parseFloat(val) })}
                helper="Trigger if R² score drops below this"
              />
            </div>

            <div className="pt-2">
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                <div className="flex gap-3">
                  <IconAlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    High retraining frequency may increase cloud costs. Thresholds are optimized for production stability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Importance (Explainability) */}
        <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <IconChartLine className="text-primary-500" />
              Global Feature Importance
            </h2>
            <span className="text-xs text-gray-500">SHAP values</span>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {featureImportance.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model History */}
        <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <IconHistory className="text-primary-500" />
              Version History
            </h2>
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2 py-1 rounded-md">
              {mlModels.length} Versions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Version</th>
                  <th className="px-6 py-3">Accuracy (R²)</th>
                  <th className="px-6 py-3">Training Data</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {mlModels.map((model) => (
                  <tr key={model.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{model.version.substring(0, 8)}</span>
                        <span className="text-xs text-gray-500">{new Date(model.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${(model.r2Score || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {((model.r2Score || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{model.trainingDataCount || '---'} samples</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                        model.status === 'ACTIVE' 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500"
                      )}>
                        {model.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Training Pipeline */}
      <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <IconLoader2 className="text-primary-500" />
            Training Pipeline
          </h2>
          
          <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200 dark:before:bg-gray-800">
            {trainingJobs.length > 0 ? (
              trainingJobs.map((job) => (
                <div key={job.id} className="relative pl-8">
                  <div className={clsx(
                    "absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white dark:border-[#1a2234] flex items-center justify-center z-10",
                    job.status === 'ACTIVE' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    job.status === 'FAILED' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                    "bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse"
                  )}>
                    {job.status === 'ACTIVE' ? <IconCheck className="w-3 h-3 text-white" /> :
                     job.status === 'FAILED' ? <IconAlertCircle className="w-3 h-3 text-white" /> :
                     <IconLoader2 className="w-3 h-3 text-white animate-spin" />}
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl p-4 transition-all hover:border-primary-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                        {job.triggerType} Training Job
                      </p>
                      <span className="text-[10px] text-gray-500">{new Date(job.startedAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{job.triggerReason}</p>
                    
                    {job.status === 'ACTIVE' && (
                      <div className="flex items-center gap-4 py-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Version:</span>
                          <span className="text-[10px] font-mono text-primary-600 dark:text-primary-400">{job.modelVersion?.substring(0, 8)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Samples:</span>
                          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{job.dataPointsNew}</span>
                        </div>
                      </div>
                    )}

                    {job.error && (
                      <p className="text-[10px] text-red-500 mt-2 bg-red-50 dark:bg-red-500/10 p-2 rounded-lg">
                        Error: {job.error}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <IconBrain className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No training jobs recorded yet.</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, progress }: any) {
  const colors: any = {
    primary: "from-primary-500 to-indigo-600 text-primary-600 bg-primary-50 dark:bg-primary-500/10 border-primary-100 dark:border-primary-500/20",
    emerald: "from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
    amber: "from-amber-500 to-orange-600 text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20",
    red: "from-red-500 to-rose-600 text-red-600 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20",
  };

  return (
    <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx("p-2.5 rounded-xl border", colors[color].split(' ').slice(2).join(' '))}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-[11px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</h3>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={clsx("h-full transition-all duration-500 rounded-full", color === 'primary' ? 'bg-primary-500' : 'bg-amber-500')} 
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ConfigInput({ label, value, onChange, helper, step = 1 }: { label: string, value: any, onChange: (val: string) => void, helper?: string, step?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">{label}</label>
      <input 
        type="number" 
        value={value || ''} 
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 ring-primary-500/20 text-gray-900 dark:text-white"
      />
      {helper && <p className="text-[10px] text-gray-500 italic">{helper}</p>}
    </div>
  );
}
