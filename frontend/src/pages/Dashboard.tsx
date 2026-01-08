import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  ListTodo,
  Server,
  Clock,
  Brain,
  TrendingUp,
  Play,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
import { DashboardSkeleton } from '../components/Skeletons';

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
  const toast = useToast();

  useEffect(() => {
    fetchTasks();
    fetchResources();
    fetchMetrics();
    checkMlStatus();
  }, [fetchTasks, fetchResources, fetchMetrics, checkMlStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTasks(), fetchResources(), fetchMetrics()]);
    setRefreshing(false);
    toast.info('Data refreshed', 'All data has been updated.');
  };

  const handleSchedule = async () => {
    try {
      await runScheduler();
      toast.success('Scheduler complete', 'Tasks have been scheduled.');
    } catch (error) {
      toast.error('Scheduling failed', 'Could not schedule tasks.');
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const availableResources = resources.filter((r) => r.status === 'AVAILABLE');
  const isLoading = tasksLoading || resourcesLoading || metricsLoading;

  if (isLoading && tasks.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of task scheduling and resource allocation
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw
              className={clsx('h-4 w-4', refreshing && 'animate-spin')}
            />
            Refresh
          </button>
          <button
            onClick={handleSchedule}
            disabled={scheduling || pendingTasks.length === 0}
            className="btn btn-primary flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {scheduling ? 'Scheduling...' : 'Run Scheduler'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={metrics?.tasks.total || 0}
          subtitle={`${metrics?.tasks.pending || 0} pending`}
          icon={ListTodo}
          color="blue"
        />
        <StatCard
          title="Active Resources"
          value={`${availableResources.length}/${resources.length}`}
          subtitle={`${Math.round(metrics?.resources.avgLoad || 0)}% avg load`}
          icon={Server}
          color="green"
        />
        <StatCard
          title="Avg Execution Time"
          value={`${metrics?.performance.avgExecutionTime || 0}s`}
          subtitle="per task"
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="ML Accuracy"
          value={`${metrics?.performance.mlAccuracy || 0}%`}
          subtitle={mlAvailable ? 'ML Service Active' : 'Fallback Mode'}
          icon={Brain}
          color={mlAvailable ? 'emerald' : 'amber'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pending Tasks
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pendingTasks.length} tasks waiting
            </span>
          </div>
          <div className="space-y-3">
            {pendingTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{task.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {task.type} • {task.size} • Priority {task.priority}
                  </p>
                </div>
                <PriorityBadge priority={task.priority} />
              </div>
            ))}
            {pendingTasks.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No pending tasks
              </p>
            )}
          </div>
        </div>

        {/* Resource Utilization */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resource Utilization
            </h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {resources.slice(0, 5).map((resource) => (
              <div key={resource.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {resource.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(resource.currentLoad)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={clsx(
                      'h-2 rounded-full transition-all',
                      resource.currentLoad < 50
                        ? 'bg-green-500'
                        : resource.currentLoad < 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${resource.currentLoad}%` }}
                  />
                </div>
              </div>
            ))}
            {resources.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No resources configured
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ML Status Banner */}
      <div
        className={clsx(
          'rounded-lg p-4 flex items-center gap-3',
          mlAvailable 
            ? 'bg-green-50 dark:bg-green-900/20' 
            : 'bg-amber-50 dark:bg-amber-900/20'
        )}
      >
        <Brain
          className={clsx(
            'h-6 w-6',
            mlAvailable ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
          )}
        />
        <div>
          <p
            className={clsx(
              'font-medium',
              mlAvailable ? 'text-green-900 dark:text-green-200' : 'text-amber-900 dark:text-amber-200'
            )}
          >
            {mlAvailable
              ? 'ML Service Connected'
              : 'Running in Fallback Mode'}
          </p>
          <p
            className={clsx(
              'text-sm',
              mlAvailable ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'
            )}
          >
            {mlAvailable
              ? 'Predictions are powered by the ML model for optimal scheduling'
              : 'Using heuristic-based predictions. Start the ML service for better accuracy.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'emerald' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={clsx('p-3 rounded-lg', colors[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    2: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    3: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300',
    4: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300',
    5: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',
  };

  const labels: Record<number, string> = {
    1: 'Low',
    2: 'Normal',
    3: 'Medium',
    4: 'High',
    5: 'Critical',
  };

  return (
    <span
      className={clsx(
        'px-2 py-1 rounded-full text-xs font-medium',
        colors[priority]
      )}
    >
      {labels[priority]}
    </span>
  );
}
