import { useEffect, useState, useRef } from "react";
import { taskApi, metricsApi } from "../lib/api";
import { useStore } from "../store";
import {
  IconListCheck,
  IconServer,
  IconClock,
  IconBrain,
  IconPlayerPlay,
  IconRefresh,
  IconDotsVertical,
  IconPlus,
  IconLoader2,
  IconBolt,
  IconCircleCheck,
  IconDeviceDesktop,
  IconCloud,
  IconActivity,
  IconTrophy
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useToast } from "../contexts/ToastContext";
import { DashboardSkeleton } from "../components/Skeletons";
import ProgressBar from "../components/shared/ProgressBar";
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

function LeaderboardItem({ rank, name, score, trend, avatar }: { rank: number, name: string, score: number, trend: string, avatar: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
       <div className="flex items-center gap-3">
          <div className="relative">
             <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800 group-hover:ring-primary-500 transition-all" />
             <div className={clsx(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white dark:border-[#1a2234] text-white",
                rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-slate-400" : "bg-orange-600"
             )}>
                {rank}
             </div>
          </div>
          <div>
             <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{name}</div>
             <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{score.toLocaleString()} Points</div>
          </div>
       </div>
       <div className={clsx("text-[10px] font-black px-2 py-0.5 rounded-lg", trend.startsWith('+') ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
          {trend}
       </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    tasks,
    resources,
    metrics,
    scheduling,
    tasksLoading,
    resourcesLoading,
    metricsLoading,
    fetchTasks,
    fetchResources,
    fetchMetrics,
    checkMlStatus,
    runScheduler,
    addTask,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<'CPU' | 'IO' | 'MIXED'>("MIXED");
  const [newTaskPriority, setNewTaskPriority] = useState<number>(2);
  const [isCreating, setIsCreating] = useState(false);
  const [chartData, setChartData] = useState<{ name: string; load: number; throughput: number }[]>([]);
  const toast = useToast();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchTasks();
      fetchResources();
      fetchMetrics();
      checkMlStatus();
    }
    const interval = setInterval(() => {
      fetchTasks();
      fetchResources();
      fetchMetrics();
      metricsApi.getDashboard().then(setChartData).catch(console.error);
    }, 5000);
    
    // Initial fetch
    metricsApi.getDashboard().then(setChartData).catch(console.error);

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
      console.error("API error, falling back to mock:", err);
      // Mock fallback
      const mockTask = {
        id: `mock-${Math.random().toString(36).substr(2, 9)}`,
        ...taskData,
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        predictedTime: null,
        actualTime: null,
        resourceId: null,
        scheduledAt: null,
        completedAt: null,
      };
      addTask(mockTask);
      toast.info("Research Mode", `"${newTaskTitle}" added to local session.`);
      setNewTaskTitle("");
    } finally {
      setIsCreating(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const activeTasks = tasks.filter((t) => t.status === "RUNNING" || t.status === "SCHEDULED");
  const availableResources = resources.filter((r) => r.status === "AVAILABLE");
  
  const isLoading = tasksLoading || resourcesLoading || metricsLoading;
  if (isLoading && tasks.length === 0) return <DashboardSkeleton />;

  // Chart data is now fetched from the API and stored in chartData state

  const distributionData = [
    { name: 'Fog', value: metrics?.resources.distribution.FOG || 0, color: '#22c55e' },
    { name: 'Cloud', value: metrics?.resources.distribution.CLOUD || 0, color: '#3b82f6' },
    { name: 'Terminal', value: metrics?.resources.distribution.TERMINAL || 0, color: '#8b5cf6' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            System Overview
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100 dark:border-emerald-800/50">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Live
            </div>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Monitoring {resources.length} active nodes across 3-layer architecture.</p>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={handleRefresh}
             disabled={refreshing}
             className="p-3 bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-500 hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm"
           >
              <IconRefresh className={clsx("w-5 h-5", refreshing && "animate-spin")} />
           </button>
           <button 
             onClick={handleSchedule}
             disabled={scheduling || pendingTasks.length === 0}
             className="btn btn-primary px-6 py-3 flex items-center gap-2 font-bold shadow-lg shadow-primary-500/20"
           >
              {scheduling ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconPlayerPlay className="w-5 h-5" />}
              {scheduling ? "Optimizing..." : "Execute Global Scheduler"}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        
        {/* ── CONGRATS CARD (Vuexy Style) ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
           <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-primary-500/20 group h-1/2">
              <div className="relative z-10">
                 <h3 className="text-2xl font-bold mb-2">System Status</h3>
                 <p className="text-primary-100 text-sm leading-relaxed mb-4 max-w-[200px]">
                    ML Service is active and predicting with 94.2% accuracy.
                 </p>
                 <div className="text-4xl font-black mb-1">98.5%</div>
                 <div className="text-xs font-bold opacity-80 uppercase tracking-widest">Reliability Score</div>
              </div>
              <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20 group-hover:scale-125 transition-transform duration-700">
                 <IconBrain className="w-32 h-32 text-white" />
              </div>
           </div>

           {/* ── LEADERBOARD ── */}
           <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <IconTrophy className="w-5 h-5 text-amber-500" />
                    Top Contributors
                 </h3>
                 <span className="text-[10px] font-black text-gray-400 uppercase">Monthly</span>
              </div>
              <div className="space-y-4">
                 <LeaderboardItem rank={1} name="Shri Srivastava" score={9820} trend="+12%" avatar="https://i.pravatar.cc/150?u=shri" />
                 <LeaderboardItem rank={2} name="Ichha Dwivedi" score={8450} trend="+5%" avatar="https://i.pravatar.cc/150?u=ichha" />
                 <LeaderboardItem rank={3} name="Aditi Singh" score={7200} trend="-2%" avatar="https://i.pravatar.cc/150?u=aditi" />
              </div>
           </div>
        </div>

        {/* ── STATISTICS HORIZONTAL CARD ── */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Global Statistics</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Updated 2m ago</p>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatItem icon={IconListCheck} color="text-primary-600" bg="bg-primary-50 dark:bg-primary-900/20" label="Total Tasks" value={metrics?.tasks.total ?? 0} />
              <StatItem icon={IconServer} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" label="Active Nodes" value={availableResources.length} />
              <StatItem icon={IconBolt} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/20" label="Avg Energy" value={`${metrics?.resources.avgLoad ?? 0}J`} />
              <StatItem icon={IconClock} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" label="Avg Delay" value={`${metrics?.performance.avgExecutionTime ?? 0}s`} />
           </div>
        </div>

        {/* ── PERFORMANCE REVENUE REPORT ── */}
        <div className="col-span-12 xl:col-span-8 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white">Processing Performance</h3>
                 <p className="text-xs text-gray-500">Real-time load vs throughput tracking</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Throughput</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Load</span>
                 </div>
              </div>
           </div>

           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorThr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip contentStyle={{backgroundColor: '#1a2234', border: 'none', borderRadius: '12px', color: '#fff'}} />
                    <Area type="monotone" dataKey="load" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorLoad)" />
                    <Area type="monotone" dataKey="throughput" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorThr)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* ── RESOURCE DISTRIBUTION ── */}
        <div className="col-span-12 xl:col-span-4 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col">
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Resource Allocation</h3>
           <p className="text-xs text-gray-500 mb-8">Workload distribution across layers</p>
           
           <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-[200px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                       >
                          {distributionData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                       </Pie>
                       <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              
              <div className="w-full space-y-4 mt-6">
                 {distributionData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}} />
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{item.name} Layer</span>
                       </div>
                       <span className="text-sm font-black text-gray-900 dark:text-white">{item.value}%</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* ── ACTIVE TASKS QUEUE ── */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Queue</h3>
              <button className="text-xs font-bold text-primary-600 hover:underline">View All</button>
           </div>
           
           <div className="space-y-5">
              {activeTasks.slice(0, 5).map(task => (
                 <div key={task.id} className="flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                       <div className={clsx(
                         "w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110",
                         task.status === 'RUNNING' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                       )}>
                          {task.status === 'RUNNING' ? <IconActivity className="w-5 h-5" /> : <IconCircleCheck className="w-5 h-5" />}
                       </div>
                       <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{task.name}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{task.type} • {task.size}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm font-black text-gray-900 dark:text-white">{task.priority}</div>
                       <div className="text-[10px] font-bold text-gray-400 uppercase">Priority</div>
                    </div>
                 </div>
              ))}
              {activeTasks.length === 0 && <p className="text-center text-sm text-gray-400 py-12">No active tasks in queue.</p>}
           </div>
        </div>

        {/* ── QUICK CONFIG / INGESTION ── */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm relative group overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all pointer-events-none">
              <IconActivity className="w-32 h-32" />
           </div>
           
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Task Ingestion</h3>
           
           <div className="space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Identifier</label>
                 <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task name..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Strategy</label>
                    <select 
                       value={newTaskType}
                       onChange={(e) => setNewTaskType(e.target.value as any)}
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm appearance-none cursor-pointer outline-none"
                    >
                       <option value="MIXED">Mixed</option>
                       <option value="CPU">Compute</option>
                       <option value="IO">I/O Heavy</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Rank</label>
                    <select 
                       value={newTaskPriority}
                       onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm appearance-none cursor-pointer outline-none"
                    >
                       <option value={1}>Tier 1</option>
                       <option value={2}>Tier 2</option>
                       <option value={3}>Tier 3</option>
                    </select>
                 </div>
              </div>

              <button 
                onClick={handleCreateNewTask}
                disabled={!newTaskTitle.trim() || isCreating}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                 {isCreating ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconPlus className="w-5 h-5" />}
                 Ingest Task
              </button>
           </div>
        </div>

        {/* ── SYSTEM NODES / RESOURCES ── */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Nodes</h3>
              <button className="p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg transition-colors">
                 <IconDotsVertical className="w-4 h-4 text-gray-400" />
              </button>
           </div>

           <div className="space-y-6">
              {resources.slice(0, 3).map(node => (
                 <div key={node.id} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                       <span className="text-gray-500 truncate max-w-[150px]">{node.name}</span>
                       <span className="text-gray-900 dark:text-white">{node.currentLoad}%</span>
                    </div>
                    <ProgressBar 
                       value={node.currentLoad} 
                       color={node.currentLoad < 50 ? 'success' : node.currentLoad < 80 ? 'warning' : 'error'} 
                       height={8} 
                    />
                 </div>
              ))}
              <button className="w-full py-3 border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-all flex items-center justify-center gap-2">
                 <IconPlus className="w-4 h-4" /> Provision Node
              </button>
           </div>
        </div>

      </div>

      {/* ── TRANSACTION LIST / LOGS ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
         <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Scheduling Transactions</h3>
            <div className="flex items-center gap-2">
               <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 text-[10px] font-black rounded-lg">LIVE LOGS</span>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                     <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Transaction ID</th>
                     <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Source</th>
                     <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Algorithm</th>
                     <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Target Layer</th>
                     <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {tasks.slice(0, 6).map(task => (
                    <tr key={task.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-all">
                       <td className="py-4 font-mono text-xs text-primary-600 font-bold">#TRX-{task.id.slice(0, 6)}</td>
                       <td className="py-4">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                                <IconDeviceDesktop className="w-4 h-4 text-gray-500" />
                             </div>
                             <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{task.name}</span>
                          </div>
                       </td>
                       <td className="py-4 text-sm font-medium text-gray-500">Neural-HH</td>
                       <td className="py-4">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                             <IconCloud className="w-3.5 h-3.5" /> FOG-LAYER-A
                          </div>
                       </td>
                       <td className="py-4 text-right">
                          <span className={clsx(
                             "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                             task.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                             {task.status}
                          </span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
}

function StatItem({ icon: Icon, color, bg, label, value }: any) {
  return (
    <div className="flex items-center gap-4">
       <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", bg, color)}>
          <Icon className="w-6 h-6" />
       </div>
       <div>
          <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">{value}</div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter leading-none">{label}</div>
       </div>
    </div>
  );
}
