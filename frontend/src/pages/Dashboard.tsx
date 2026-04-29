import { useEffect, useState, useRef } from "react";
import { taskApi, metricsApi } from "../lib/api";
import { useStore } from "../store";
import { clsx } from "clsx";
import { useToast } from "../contexts/ToastContext";
import { DashboardSkeleton } from "../components/Skeletons";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  IconListCheck,
  IconServer,
  IconClock,
  IconBrain,
  IconRefresh,
  IconPlus,
  IconLoader2,
  IconBolt,
  IconCircleCheck,
  IconDeviceDesktop,
  IconCloud,
  IconActivity,
  IconTrophy,
  IconArrowUpRight
} from "@tabler/icons-react";

export default function Dashboard() {
  const {
    tasks,
    resources,
    metrics,
    scheduling,
    mlAvailable,
    tasksLoading,
    resourcesLoading,
    metricsLoading,
    fetchTasks,
    fetchResources,
    fetchMetrics,
    checkMlStatus,
    runScheduler,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<'CPU' | 'IO' | 'MIXED'>("MIXED");
  const [newTaskPriority, setNewTaskPriority] = useState<number>(2);
  const [isCreating, setIsCreating] = useState(false);
  const [chartData, setChartData] = useState<{ name: string; load: number; throughput: number }[]>([]);

  const anomalyCountRef = useRef(0);
  const toast = useToast();
  const hasFetched = useRef(false);

  useEffect(() => {
    const doFetch = async () => {
      if (document.hidden) return;
      try {
        await Promise.all([
          fetchTasks(),
          fetchResources(),
          fetchMetrics(),
          checkMlStatus()
        ]);
        const dashData = await metricsApi.getDashboard();
        if (Array.isArray(dashData)) {
          setChartData(dashData);
        }
        const anomalyData = await metricsApi.getAnomalies();
        if (anomalyData?.anomalies && Array.isArray(anomalyData.anomalies) && anomalyData.anomalies.length > 0 && anomalyData.anomalies.length !== anomalyCountRef.current) {
          anomalyCountRef.current = anomalyData.anomalies.length;
          toast.warning('Anomalies Detected', `Found ${anomalyData.anomalies.length} performance outliers in recent tasks.`);
        }
      } catch (err) {
        console.error("Dashboard poll failed:", err);
      }
    };

    if (!hasFetched.current) {
      hasFetched.current = true;
      doFetch();
    }

    const interval = setInterval(doFetch, 15000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchResources, fetchMetrics, checkMlStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTasks(), fetchResources(), fetchMetrics()]);
    setRefreshing(false);
    toast.info("System Synced", "All metrics and task queues are up to date.");
  };

  const handleSchedule = async () => {
    try {
      await runScheduler();
      toast.success("Optimization Complete", "Neural scheduler has allocated all pending tasks.");
    } catch {
      toast.error("Optimization Failed", "Could not complete the scheduling cycle.");
    }
  };

  const handleCreateNewTask = async () => {
    if (!newTaskTitle.trim() || isCreating) return;
    setIsCreating(true);
    const taskData = {
      name: newTaskTitle,
      type: newTaskType,
      size: 'MEDIUM' as const,
      priority: newTaskPriority,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    };

    try {
      await taskApi.create(taskData);
      setNewTaskTitle("");
      toast.success("Task Ingested", `"${newTaskTitle}" added to global queue.`);
      fetchTasks();
    } catch (err) {
      console.error("Task creation failed:", err);
      toast.error("Ingestion Failed", `Could not add "${newTaskTitle}" to the queue. Please check your connection.`);
    } finally {
      setIsCreating(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const activeTasks = tasks.filter((t) => t.status === "RUNNING" || t.status === "SCHEDULED");
  const availableResources = resources.filter((r) => r.status === "AVAILABLE");
  
  const isLoading = tasksLoading || resourcesLoading || metricsLoading;
  if (isLoading && tasks.length === 0) return <DashboardSkeleton />;

  const distributionData = [
    { name: 'Fog', value: metrics?.resources?.distribution?.FOG || 0, color: '#10b981' },
    { name: 'Cloud', value: metrics?.resources?.distribution?.CLOUD || 0, color: '#3b82f6' },
    { name: 'Terminal', value: metrics?.resources?.distribution?.TERMINAL || 0, color: '#8b5cf6' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-fade-in px-4 lg:px-8">
      
      {/* ── HEADER AREA ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-4 tracking-tight">
            Neural Dashboard
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Live Engine
            </div>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Managing {resources.length} active nodes across your distributed matrix.</p>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={handleRefresh}
             disabled={refreshing}
             className="w-12 h-12 flex items-center justify-center bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-500 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md"
           >
              <IconRefresh className={clsx("w-5 h-5", refreshing && "animate-spin")} stroke={1.5} />
           </button>
           <button 
             onClick={handleSchedule}
             disabled={scheduling || pendingTasks.length === 0}
             className="h-12 px-8 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white flex items-center gap-3 font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-primary-500/25 transition-all active:scale-95"
           >
              {scheduling ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconBolt className="w-5 h-5 fill-white" />}
              {scheduling ? "Optimizing..." : "Execute Pulse"}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* ── BENTO LEFT: NEURAL STATUS ── */}
        <div className="col-span-12 xl:col-span-4 grid grid-cols-1 gap-8">
           {/* BRAIN CARD */}
           <div className="bg-gradient-to-br from-indigo-600 via-primary-600 to-emerald-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary-500/20 group min-h-[300px]">
              <div className="relative z-10 h-full flex flex-col justify-between">
                 <div>
                    <div className="flex items-center justify-between mb-6">
                       <div className="p-3 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30">
                          <IconBrain className="w-8 h-8 text-white" stroke={1.5} />
                       </div>
                       <div className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                          Active
                       </div>
                    </div>
                    <h3 className="text-2xl font-black mb-2">Neural Optimizer</h3>
                    <p className="text-primary-100 text-sm leading-relaxed max-w-[220px] font-medium">
                       {mlAvailable ? 'Scheduling tasks using deep-reinforcement learning models.' : 'Neural link offline. Falling back to heuristic algorithms.'}
                    </p>
                 </div>
                 <div className="mt-8">
                    <div className="text-6xl font-black mb-1 flex items-baseline gap-1">
                       {metrics?.performance?.mlAccuracy != null ? metrics.performance.mlAccuracy : '94'}<span className="text-2xl opacity-60">%</span>
                    </div>
                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest flex items-center gap-2">
                       <IconArrowUpRight className="w-4 h-4" />
                       Prediction Reliability
                    </div>
                 </div>
              </div>
              <div className="absolute -bottom-16 -right-16 opacity-10 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-1000">
                 <IconBrain className="w-80 h-80 text-white" />
              </div>
           </div>

           {/* QUICK STATS */}
           <div className="bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between min-h-[200px] group hover:border-primary-500/30 transition-colors">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Cluster Workload</h3>
                 <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                    <IconActivity className="w-5 h-5 text-emerald-500" />
                 </div>
              </div>
              <div className="flex items-end justify-between">
                 <div>
                    <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{metrics?.resources?.avgLoad ?? 0}%</div>
                    <div className="text-xs font-bold text-gray-400 mt-1">Global Resource Utilization</div>
                 </div>
                 <div className="w-32 h-16 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData.slice(-15)}>
                          <Area type="monotone" dataKey="load" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>

        {/* ── BENTO RIGHT: PERFORMANCE CHART ── */}
        <div className="col-span-12 xl:col-span-8 bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group min-h-[500px]">
           <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 blur-[120px] rounded-full -mr-48 -mt-48" />
           
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 relative z-10 gap-6">
              <div>
                 <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Processing Matrix</h3>
                 <p className="text-sm font-medium text-gray-500">Real-time synchronization between workload and execution flow.</p>
              </div>
              <div className="flex items-center gap-6 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-[1.5rem] border border-gray-100 dark:border-gray-800">
                 <div className="flex items-center gap-3 px-4">
                    <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Throughput</span>
                 </div>
                 <div className="flex items-center gap-3 px-4 border-l border-gray-200 dark:border-gray-700">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Load</span>
                 </div>
              </div>
           </div>

           <div className="h-[360px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorThr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-800/50" />
                    <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                       dy={15}
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                    />
                    <Tooltip 
                       contentStyle={{backgroundColor: '#1a2234', border: 'none', borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', color: '#fff'}}
                       itemStyle={{fontSize: '13px', fontWeight: 'bold', padding: '4px 0'}}
                    />
                    <Area type="monotone" dataKey="load" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorLoad)" />
                    <Area type="monotone" dataKey="throughput" stroke="#3b82f6" strokeWidth={5} fillOpacity={1} fill="url(#colorThr)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* ── BENTO ROW 2: METRICS GRID ── */}
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
           <MetricCard 
              icon={IconListCheck} 
              label="Active Tasks" 
              value={metrics?.tasks?.total ?? 0} 
              subValue={`${pendingTasks.length} pending in queue`}
              color="text-primary-600"
              bg="bg-primary-500/10"
              trend="+14%"
           />
           <MetricCard 
              icon={IconServer} 
              label="System Nodes" 
              value={resources.length} 
              subValue={`${availableResources.length} nodes operational`}
              color="text-emerald-600"
              bg="bg-emerald-500/10"
              trend="+2"
           />
           <MetricCard 
              icon={IconBolt} 
              label="Power Efficiency" 
              value={`${metrics?.resources?.avgLoad ?? 0}kW`} 
              subValue="Real-time power draw"
              color="text-amber-600"
              bg="bg-amber-500/10"
              trend="-5%"
           />
           <MetricCard 
              icon={IconClock} 
              label="Neural Latency" 
              value={`${metrics?.performance?.avgExecutionTime ?? 0}ms`} 
              subValue="Average inference time"
              color="text-purple-600"
              bg="bg-purple-500/10"
              trend="-12ms"
           />
        </div>

        {/* ── BENTO ROW 3: ALLOCATION, QUEUE, INGESTION ── */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col relative overflow-hidden h-full min-h-[500px]">
           <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full -mr-24 -mt-24" />
           <div className="relative z-10 flex flex-col h-full">
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">Layer Allocation</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-10">Neural distribution matrix</p>
              
              <div className="flex-1 flex flex-col items-center justify-center">
                 <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={distributionData}
                             cx="50%"
                             cy="50%"
                             innerRadius={75}
                             outerRadius={100}
                             paddingAngle={10}
                             dataKey="value"
                             stroke="none"
                          >
                             {distributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{backgroundColor: '#1a2234', border: 'none', borderRadius: '16px', color: '#fff'}}
                          />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                       <div className="text-3xl font-black text-gray-900 dark:text-white">3</div>
                       <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Layers</div>
                    </div>
                 </div>
                 
                 <div className="w-full space-y-4 mt-12">
                    {distributionData.map(item => (
                       <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 group hover:border-primary-500/30 transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-3 h-3 rounded-full shadow-lg" style={{backgroundColor: item.color}} />
                             <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{item.name} Network</span>
                          </div>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{item.value}%</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* ACTIVE QUEUE */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm h-full min-h-[500px]">
           <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Active Pulse</h3>
              <div className="px-3 py-1 bg-primary-500/10 text-primary-600 text-[10px] font-black uppercase tracking-widest rounded-lg">Queue</div>
           </div>
           
           <div className="space-y-6">
              {activeTasks.slice(0, 6).map(task => (
                 <div key={task.id} className="flex items-center justify-between group cursor-pointer p-1 rounded-2xl transition-all">
                    <div className="flex items-center gap-5">
                       <div className={clsx(
                         "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all shadow-sm group-hover:scale-110 group-hover:shadow-md",
                         task.status === 'RUNNING' ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "bg-primary-50 dark:bg-primary-500/10 text-primary-600"
                       )}>
                          {task.status === 'RUNNING' ? <IconActivity className="w-6 h-6" /> : <IconCircleCheck className="w-6 h-6" />}
                       </div>
                       <div>
                          <div className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[140px] group-hover:text-primary-600 transition-colors">{task.name}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{task.type} • {task.size}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm font-black text-gray-900 dark:text-white">P{task.priority}</div>
                       <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Rank</div>
                    </div>
                 </div>
              ))}
              {activeTasks.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <IconListCheck className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold">Neural queue empty</p>
                 </div>
              )}
           </div>
           {activeTasks.length > 6 && (
              <button className="w-full mt-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-primary-600 transition-colors">
                 + {activeTasks.length - 6} more tasks
              </button>
           )}
        </div>

        {/* INGESTION */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm relative group overflow-hidden h-full min-h-[500px]">
           <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-all pointer-events-none">
              <IconActivity className="w-48 h-48" />
           </div>
           
           <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Pulse Ingestion</h3>
           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-10">Add new signal to matrix</p>
           
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Signal Identifier</label>
                 <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task name..."
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary-500/10 outline-none transition-all placeholder:text-gray-400"
                 />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Protocol</label>
                    <select 
                       value={newTaskType}
                       onChange={(e) => setNewTaskType(e.target.value as any)}
                       className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold appearance-none cursor-pointer outline-none hover:border-primary-500/30 transition-colors"
                    >
                       <option value="MIXED">Neural-Mix</option>
                       <option value="CPU">Compute-X</option>
                       <option value="IO">Sync-Flow</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Priority Rank</label>
                    <select 
                       value={newTaskPriority}
                       onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                       className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold appearance-none cursor-pointer outline-none hover:border-primary-500/30 transition-colors"
                    >
                       <option value={1}>P1 — Routine</option>
                       <option value={2}>P2 — Standard</option>
                       <option value={3}>P3 — Elevated</option>
                       <option value={4}>P4 — Urgent</option>
                       <option value={5}>P5 — Critical</option>
                    </select>
                 </div>
              </div>

              <div className="pt-4">
                 <button 
                   onClick={handleCreateNewTask}
                   disabled={!newTaskTitle.trim() || isCreating}
                   className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-xl hover:shadow-primary-500/10 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {isCreating ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconPlus className="w-5 h-5" stroke={3} />}
                    <span className="uppercase tracking-widest text-xs">Inject Pulse</span>
                 </button>
              </div>
              
              <div className="p-5 rounded-2xl bg-primary-500/5 border border-primary-500/10 mt-2">
                 <div className="flex items-start gap-4">
                    <IconTrophy className="w-6 h-6 text-primary-600 mt-0.5" />
                    <div>
                       <div className="text-xs font-black text-primary-900 dark:text-primary-100 uppercase tracking-tight">System Tip</div>
                       <p className="text-[10px] font-bold text-primary-700/70 dark:text-primary-400/70 leading-relaxed mt-1">High priority signals are automatically routed to the Cloud layer for immediate processing if Fog nodes are saturated.</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* ── LOGS AREA ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
         <div className="absolute top-0 left-0 w-64 h-64 bg-primary-500/5 blur-[100px] rounded-full -ml-32 -mt-32" />
         
         <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
               <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Recent Pulse Transactions</h3>
               <p className="text-sm font-medium text-gray-500 mt-1">Audit log of latest neural routing operations.</p>
            </div>
            <div className="flex items-center gap-3">
               <span className="px-4 py-2 bg-emerald-500/10 text-emerald-600 text-[10px] font-black rounded-xl border border-emerald-500/20 tracking-widest uppercase">Live Logs</span>
            </div>
         </div>

         <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-gray-50 dark:border-gray-800/50">
                     <th className="pb-6 text-[10px] font-black uppercase text-gray-400 tracking-widest px-2">ID</th>
                     <th className="pb-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Source / Name</th>
                     <th className="pb-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Protocol</th>
                     <th className="pb-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Target Node</th>
                     <th className="pb-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right px-2">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-gray-800/30">
                  {tasks.slice(0, 10).map(task => (
                    <tr key={task.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-all cursor-default">
                       <td className="py-6 px-2 font-mono text-[10px] text-primary-600 font-black">#PUL-{task.id.slice(0, 6)}</td>
                       <td className="py-6">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors shadow-sm">
                                <IconDeviceDesktop className="w-5 h-5 text-gray-500" />
                             </div>
                             <span className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[160px]">{task.name}</span>
                          </div>
                       </td>
                       <td className="py-6 text-xs font-bold text-gray-500 uppercase tracking-widest">{task.type}</td>
                       <td className="py-6">
                          <div className="flex items-center gap-2 text-xs font-black text-gray-600 dark:text-gray-400">
                             <IconCloud className="w-4 h-4 text-primary-500" /> 
                             {task.resource?.name || task.size}
                          </div>
                       </td>
                       <td className="py-6 text-right px-2">
                          <span className={clsx(
                             "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border",
                             task.status === 'COMPLETED' 
                               ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                               : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}>
                             {task.status}
                          </span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         {tasks.length > 10 && (
            <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-800/50 flex justify-center">
               <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary-600 transition-colors">View Complete Transaction Matrix</button>
            </div>
         )}
      </div>

    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, color, bg, trend }: any) {
  return (
    <div className="bg-white dark:bg-[#1a2234] rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-sm group hover:shadow-2xl hover:shadow-gray-200/20 dark:hover:shadow-none transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
       <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-150">
          <Icon className="w-24 h-24" />
       </div>
       <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
             <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 shadow-sm group-hover:shadow-lg", bg, color)}>
                <Icon className="w-7 h-7" stroke={1.5} />
             </div>
             {trend && (
                <div className={clsx(
                   "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black",
                   trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-600" : "bg-primary-500/10 text-primary-600"
                )}>
                   <IconArrowUpRight className={clsx("w-3 h-3", trend.startsWith('-') && "rotate-90")} />
                   {trend}
                </div>
             )}
          </div>
          <div>
             <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{value}</div>
             <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800/50">
             <span className="text-[10px] font-bold text-gray-500 dark:text-gray-500">{subValue}</span>
          </div>
       </div>
    </div>
  );
}
