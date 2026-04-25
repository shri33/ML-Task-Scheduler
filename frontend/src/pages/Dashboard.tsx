import { useEffect, useState, useRef, type ComponentType } from "react";
import { useStore } from "../store";
import {
  ListTodo,
  Server,
  Clock,
  Brain,
  TrendingUp,
  Play,
  RefreshCw,
  CalendarDays,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "../contexts/ToastContext";
import { DashboardSkeleton } from "../components/Skeletons";
import { PriorityBadge } from "../components/shared/Badges";

// Mini sparkline SVG component
function Sparkline({ color = "#6366f1" }) {
  const points = [
    [0, 28],
    [8, 22],
    [16, 26],
    [24, 14],
    [32, 18],
    [40, 10],
    [48, 16],
    [56, 8],
    [64, 14],
    [72, 6],
  ];
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ");
  const fill =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") +
    ` L72,36 L0,36 Z`;

  return (
    <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
      <path d={fill} fill={color} fillOpacity="0.12" />
      <path
        d={path}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(
        ([x, y], i) =>
          i === points.length - 1 && (
            <circle key={i} cx={x} cy={y} r="3" fill={color} />
          ),
      )}
    </svg>
  );
}

export default function Dashboard() {
  const {
    tasks,
    resources,
    metrics,
    mlAvailable,
    scheduling,
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
  const [isTaskInputFocused, setIsTaskInputFocused] = useState(false);
  const toast = useToast();
  const hasFetched = useRef(false);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const emojiRowRef = useRef<HTMLDivElement>(null);

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
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchResources, fetchMetrics, checkMlStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTasks(), fetchResources(), fetchMetrics()]);
    setRefreshing(false);
    toast.info("Data refreshed", "All data has been updated.");
  };

  const handleSchedule = async () => {
    try {
      await runScheduler();
      toast.success("Scheduler complete", "Tasks have been scheduled.");
    } catch {
      toast.error("Scheduling failed", "Could not schedule tasks.");
    }
  };

  const emojis = ["🎉", "😍", "😊", "🔥", "😉", "😎", "🙄"];

  const handleEmojiPick = (emoji: string) => {
    setNewTaskTitle((prev) => `${prev}${emoji}`);
    newTaskInputRef.current?.focus();
  };

  const handleEmojiScroll = (direction: "left" | "right") => {
    const row = emojiRowRef.current;
    if (!row) return;

    const scrollAmount = row.clientWidth * 0.7;
    row.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleCreateNewTask = () => {
    if (!newTaskTitle.trim()) return;
    toast.success("Task draft created", `New task: ${newTaskTitle}`);
    setNewTaskTitle("");
    setIsTaskInputFocused(false);
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const availableResources = resources.filter((r) => r.status === "AVAILABLE");
  const isLoading = tasksLoading || resourcesLoading || metricsLoading;

  if (isLoading && tasks.length === 0) return <DashboardSkeleton />;

  return (
    <main>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-4 xl:gap-6">
        <div className="bg-gray-200 dark:bg-black/30 p-7 min-h-full w-full">
          <div className="space-y-6 ">
            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Dashboard
                </h2>
                <p className="text-sm text-gray-400 dark:text-white-900 mt-1">
                  Overview of task scheduling and resource allocation
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", refreshing && "animate-spin")}
                  />
                  Refresh
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={scheduling || pendingTasks.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Play className="h-4 w-4" />
                  {scheduling ? "Scheduling..." : "Run Scheduler"}
                </button>
              </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Total Tasks"
                value={metrics?.tasks.total ?? 0}
                trend={`${metrics?.tasks.pending ?? 0} pending`}
                sparkColor="#6366f1"
                icon={ListTodo}
                iconBg="bg-blue-50 dark:bg-black/30"
                iconColor="text-blue-500 dark:text-blue-400"
              />
              <StatCard
                title="Active Resources"
                value={`${availableResources.length}/${resources.length}`}
                trend={`${Math.round(metrics?.resources.avgLoad ?? 0)}% avg load`}
                sparkColor="#22c55e"
                icon={Server}
                iconBg="bg-green-50 dark:bg-green-900/20"
                iconColor="text-green-500 dark:text-green-400"
              />
              <StatCard
                title="Avg Execution Time"
                value={`${metrics?.performance.avgExecutionTime ?? 0}s`}
                trend="per task"
                sparkColor="#a855f7"
                icon={Clock}
                iconBg="bg-purple-50 dark:bg-purple-900/20"
                iconColor="text-purple-500 dark:text-purple-400"
              />
              <StatCard
                title="ML Accuracy"
                value={`${metrics?.performance.mlAccuracy ?? 0}%`}
                trend={mlAvailable ? "ML Service Active" : "Fallback Mode"}
                sparkColor={mlAvailable ? "#10b981" : "#f59e0b"}
                icon={Brain}
                iconBg={
                  mlAvailable
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : "bg-amber-50 dark:bg-amber-900/20"
                }
                iconColor={
                  mlAvailable
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-amber-500 dark:text-amber-400"
                }
              />
            </div>

            {/* ── Main Content Grid ── */}
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-8">
                {/* Pending Tasks */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mt-4 shadow-sm border border-gray-100 dark:border-gray-700/60">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Pending Tasks
                    </h3>
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                      {pendingTasks.length} waiting
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {pendingTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {/* Play-style icon like Octom */}
                          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                            <Play className="h-3.5 w-3.5 text-white fill-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {task.name}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {task.type} • {task.size} • Priority{" "}
                              {task.priority}
                            </p>
                          </div>
                        </div>
                        <PriorityBadge priority={task.priority} showLabel />
                      </div>
                    ))}
                    {pendingTasks.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                        No pending tasks
                      </p>
                    )}
                  </div>
                </div>

                {/* Resource Utilization */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/60">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Resource Utilization
                    </h3>
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-5">
                    {resources.slice(0, 5).map((resource) => (
                      <div key={resource.id}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {resource.name}
                          </span>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            {Math.round(resource.currentLoad)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={clsx(
                              "h-2 rounded-full transition-all duration-500",
                              resource.currentLoad < 50
                                ? "bg-green-500"
                                : resource.currentLoad < 80
                                  ? "bg-yellow-400"
                                  : "bg-red-500",
                            )}
                            style={{ width: `${resource.currentLoad}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {resources.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                        No resources configured
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Today's Section (outside gray box, right side) */}
        <div className="p-4 sm:p-5 w-full">
  {/* ===== Schedule ===== */}
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
        Today's Schedule
      </h3>

      <div className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 p-1">
        <button className="h-7 w-7 sm:h-8 sm:w-8 grid place-items-center rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
          <MoreVertical className="h-4 w-4" />
        </button>
        <button className="h-7 w-7 sm:h-8 sm:w-8 grid place-items-center rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    </div>

    <div className="flex items-center justify-between text-xs sm:text-sm">
      <p className="text-sky-500 dark:text-sky-300 font-medium truncate">
        Call with Client
      </p>
      <button className="text-blue-500 dark:text-blue-300 font-semibold whitespace-nowrap">
        + Invite
      </button>
    </div>
  </section>

  {/* ===== New Task ===== */}
  <section className="border-t border-gray-100 dark:border-gray-700 pt-5 mt-5 space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-100">
        New Task
      </h4>
      <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
    </div>

    <div>
      <label className="text-xs sm:text-sm text-slate-400 dark:text-slate-300">
        Task Title
      </label>

      <input
        ref={newTaskInputRef}
        type="text"
        value={newTaskTitle}
        onChange={(e) => setNewTaskTitle(e.target.value)}
        onFocus={() => setIsTaskInputFocused(true)}
        onBlur={() => setIsTaskInputFocused(false)}
        placeholder={isTaskInputFocused ? "" : "Create task"}
        className="mt-2 w-full rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm sm:text-base text-indigo-900 dark:text-indigo-100 outline-none border border-transparent focus:border-indigo-300"
      />

      <button
        onClick={handleCreateNewTask}
        disabled={!newTaskTitle.trim()}
        className="mt-3 inline-flex items-center rounded-xl bg-indigo-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-indigo-600 transition"
      >
        Create New
      </button>
    </div>

    {/* Emoji Scroll */}
    <div className="flex items-center no-scrollbar justify-between pt-2">
      <button
        onClick={() => handleEmojiScroll("left")}
        className="text-indigo-400 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <div
        ref={emojiRowRef}
        className="flex items-center gap-2 text-lg sm:text-xl overflow-x-auto no-scrollbar whitespace-nowrap w-[180px] sm:w-[240px]"
      >
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiPick(emoji)}
            className="flex-none w-10 sm:w-12 text-center hover:scale-110 transition"
          >
            {emoji}
          </button>
        ))}
      </div>

      <button
        onClick={() => handleEmojiScroll("right")}
        className="text-indigo-400 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  </section>

  {/* ===== Messages ===== */}
  <section className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
    <h4 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-3">
      Messages
    </h4>

    <div className="space-y-4">
      {[
        {
          initials: "CM",
          name: "Cris Morich",
          text: "Hi Angelina! How are You?",
          color: "bg-amber-200",
        },
        {
          initials: "CH",
          name: "Charmie",
          text: "Do you need that design?",
          color: "bg-rose-200",
        },
        {
          initials: "JM",
          name: "Jason Mandala",
          text: "What is the price of hourly...",
          color: "bg-cyan-200",
        },
        {
          initials: "CC",
          name: "Charlie Chu",
          text: "Awesome design!!",
          color: "bg-orange-200",
        },
      ].map((msg) => (
        <div key={msg.name} className="flex items-center gap-3">
          <span
            className={clsx(
              "h-9 w-9 sm:h-11 sm:w-11 rounded-full grid place-items-center text-[10px] sm:text-xs font-bold text-gray-700 border border-white shadow-sm",
              msg.color
            )}
          >
            {msg.initials}
          </span>

          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-indigo-900 dark:text-indigo-100 truncate">
              {msg.name}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 truncate">
              {msg.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  </section>
</div>
      </div>
                  {/* ── ML Status Banner ── */}
            <div
              className={clsx(
                "rounded-2xl px-5 py-4 m-6 flex items-center gap-4 border",
                mlAvailable
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40",
              )}
            >
              <div
                className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  mlAvailable
                    ? "bg-emerald-100 dark:bg-emerald-900/40"
                    : "bg-amber-100 dark:bg-amber-900/40",
                )}
              >
                <Brain
                  className={clsx(
                    "h-5 w-5",
                    mlAvailable
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                />
              </div>
              <div>
                <p
                  className={clsx(
                    "text-sm font-bold",
                    mlAvailable
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-amber-900 dark:text-amber-200",
                  )}
                >
                  {mlAvailable
                    ? "ML Service Connected"
                    : "Running in Fallback Mode"}
                </p>
                <p
                  className={clsx(
                    "text-xs mt-0.5",
                    mlAvailable
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400",
                  )}
                >
                  {mlAvailable
                    ? "Predictions powered by ML model for optimal scheduling"
                    : "Using heuristic-based predictions. Start ML service for better accuracy."}
                </p>
              </div>
            </div>
    </main>
  );
}

// ── StatCard ──────────────────────────────────────────────
type StatCardProps = {
  title: string;
  value: string | number;
  trend: string;
  sparkColor: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
};

function StatCard({
  title,
  value,
  trend,
  sparkColor,
  icon: Icon,
  iconBg,
  iconColor,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/60 hover:shadow-md transition-shadow">
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {title}
        </p>
        <div
          className={clsx(
            "w-9 h-9 rounded-xl flex items-center justify-center",
            iconBg,
          )}
        >
          <Icon className={clsx("h-4.5 w-4.5", iconColor)} />
        </div>
      </div>

      {/* Big value */}
      <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">
        {value}
      </p>

      {/* Bottom row: trend text + sparkline */}
      <div className="flex items-end justify-between mt-3">
        <p className="text-xs font-semibold text-green-500">{trend}</p>
        <Sparkline color={sparkColor} />
      </div>
    </div>
  );
}
