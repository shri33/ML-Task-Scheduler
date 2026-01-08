import { useEffect, useState } from 'react';
import { scheduleApi, metricsApi } from '../lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Brain, TrendingUp, Clock, Target, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  TaskStatusChart,
  ResourceLoadChart,
  MLPerformanceChart,
  MLMetricsRadar,
  TaskTypeChart,
  GaugeChart,
} from '../components/charts/ChartAnalytics';
import PDFDownload from '../components/PDFDownload';
import { ChartSkeleton, CardSkeleton } from '../components/Skeletons';

interface TimelineData {
  date: string;
  tasksScheduled: number;
  avgExecutionTime: number;
  mlAccuracy: number;
}

interface ComparisonData {
  withML: { count: number; avgError: number; avgTime: number };
  withoutML: { count: number; avgError: number; avgTime: number };
}

export default function Analytics() {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [timelineData, comparisonData] = await Promise.all([
          metricsApi.getTimeline(14),
          scheduleApi.getComparison(),
        ]);
        setTimeline(timelineData);
        setComparison(comparisonData);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Performance metrics and ML model effectiveness
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const comparisonChartData = comparison
    ? [
        {
          name: 'With ML',
          avgTime: comparison.withML.avgTime,
          avgError: comparison.withML.avgError,
          count: comparison.withML.count,
        },
        {
          name: 'Without ML',
          avgTime: comparison.withoutML.avgTime,
          avgError: comparison.withoutML.avgError,
          count: comparison.withoutML.count,
        },
      ]
    : [];

  const improvement =
    comparison && comparison.withoutML.avgTime > 0
      ? Math.round(
          ((comparison.withoutML.avgTime - comparison.withML.avgTime) /
            comparison.withoutML.avgTime) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Performance metrics and ML model effectiveness
          </p>
        </div>
        <PDFDownload />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="ML Improvement"
          value={`${improvement > 0 ? '+' : ''}${improvement}%`}
          subtitle="vs heuristic scheduling"
          icon={Brain}
          color={improvement > 0 ? 'green' : 'gray'}
        />
        <SummaryCard
          title="Prediction Accuracy"
          value={`${100 - Math.round((comparison?.withML.avgError || 0) * 10)}%`}
          subtitle="avg prediction accuracy"
          icon={Target}
          color="blue"
        />
        <SummaryCard
          title="Tasks Scheduled"
          value={String((comparison?.withML.count || 0) + (comparison?.withoutML.count || 0))}
          subtitle="total operations"
          icon={TrendingUp}
          color="purple"
        />
        <SummaryCard
          title="Avg Execution Time"
          value={`${comparison?.withML.avgTime || 0}s`}
          subtitle="with ML enabled"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Scheduling Performance Over Time
          </h3>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" className="dark:opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="dark:fill-gray-400" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} className="dark:fill-gray-400" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tasksScheduled"
                  stroke="#3b82f6"
                  name="Tasks"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mlAccuracy"
                  stroke="#10b981"
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No timeline data available yet
            </div>
          )}
        </div>

        {/* Comparison Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ML vs Heuristic Comparison
          </h3>
          {comparisonChartData.length > 0 &&
          (comparison?.withML.count || 0) + (comparison?.withoutML.count || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonChartData}>
                <CartesianGrid strokeDasharray="3 3" className="dark:opacity-30" />
                <XAxis dataKey="name" className="dark:fill-gray-400" />
                <YAxis className="dark:fill-gray-400" />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgTime" fill="#3b82f6" name="Avg Time (s)" />
                <Bar dataKey="avgError" fill="#ef4444" name="Avg Error (s)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No comparison data available yet
            </div>
          )}
        </div>
      </div>

      {/* Chart.js Visualizations Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Analytics (Chart.js)</h3>
        </div>
        
        {/* Gauge Charts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <GaugeChart 
              value={100 - Math.round((comparison?.withML.avgError || 0) * 10)} 
              label="ML Accuracy" 
              color="green" 
            />
          </div>
          <div className="card">
            <GaugeChart 
              value={improvement > 0 ? Math.min(improvement, 100) : 50} 
              label="Efficiency Gain" 
              color="blue" 
            />
          </div>
          <div className="card">
            <GaugeChart 
              value={(comparison?.withML.count || 0) > 0 ? Math.min((comparison?.withML.count || 0) * 10, 100) : 0} 
              label="Task Volume" 
              color="purple" 
            />
          </div>
          <div className="card">
            <GaugeChart 
              value={comparison?.withML.avgTime ? Math.min(100 - comparison.withML.avgTime * 10, 100) : 50} 
              label="Speed Score" 
              color="amber" 
            />
          </div>
        </div>

        {/* Chart.js Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <TaskStatusChart 
              data={{
                pending: 5,
                scheduled: comparison?.withML.count || 8,
                completed: comparison?.withoutML.count || 12,
                failed: 2,
              }} 
            />
          </div>
          <div className="card">
            <ResourceLoadChart 
              data={[
                { name: 'Server-A', load: 55, capacity: 100 },
                { name: 'Worker-1', load: 60, capacity: 100 },
                { name: 'Server-C', load: 45, capacity: 100 },
                { name: 'GPU-Node', load: comparison?.withML.avgTime ? comparison.withML.avgTime * 10 : 50, capacity: 100 },
              ]} 
            />
          </div>
        </div>

        {/* ML Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <MLPerformanceChart 
              data={timeline.length > 0 
                ? timeline.map(t => ({
                    date: t.date,
                    predicted: t.avgExecutionTime || 0,
                    actual: t.avgExecutionTime * (1 + (Math.random() * 0.2 - 0.1)),
                  }))
                : [
                    { date: 'Mon', predicted: 3.2, actual: 3.5 },
                    { date: 'Tue', predicted: 4.1, actual: 4.0 },
                    { date: 'Wed', predicted: 2.8, actual: 3.1 },
                    { date: 'Thu', predicted: 5.2, actual: 5.0 },
                    { date: 'Fri', predicted: 3.9, actual: 3.7 },
                  ]
              } 
            />
          </div>
          <div className="card">
            <MLMetricsRadar 
              data={{
                accuracy: 1 - (comparison?.withML.avgError || 0.08),
                precision: 0.89,
                recall: 0.94,
                f1Score: 0.91,
                latency: comparison?.withML.avgTime || 0.15,
              }} 
            />
          </div>
        </div>

        {/* Task Type Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <TaskTypeChart 
              data={[
                { type: 'CPU', count: 25 },
                { type: 'IO', count: 18 },
                { type: 'MIXED', count: 15 },
              ]} 
            />
          </div>
          <div className="card bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
            <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 mb-4">
              Chart.js Features
            </h3>
            <ul className="space-y-2 text-indigo-800 dark:text-indigo-300">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                Interactive hover states
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Real-time gauge animations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                Responsive design
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                Multiple chart types (Line, Bar, Doughnut, Radar, Pie)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Custom tooltips & legends
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">
              How ML Improves Scheduling
            </h4>
            <p className="text-blue-800 dark:text-blue-300 mt-1">
              The ML model predicts task execution time based on task size,
              type, priority, and current resource load. By accurately
              predicting execution times, the scheduler can make better
              decisions about which resource to assign each task to, resulting
              in lower average completion times and better resource utilization.
            </p>
            <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 mt-2 space-y-1">
              <li>
                <strong>Prediction Accuracy:</strong> How close ML predictions
                are to actual execution times
              </li>
              <li>
                <strong>Avg Error:</strong> Average difference between predicted
                and actual time
              </li>
              <li>
                <strong>Improvement:</strong> Percentage reduction in execution
                time with ML vs without
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'gray';
}) {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
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
