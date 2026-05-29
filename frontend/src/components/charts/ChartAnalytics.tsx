import { useEffect, useRef } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from 'recharts';

interface TaskStatusData {
  pending: number;
  scheduled: number;
  completed: number;
  failed: number;
}

interface ResourceLoadData {
  name: string;
  load: number;
  capacity: number;
}

interface PerformanceData {
  date: string;
  predicted: number;
  actual: number;
}

interface MLMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latency: number;
}

// Task Status Doughnut Chart
export function TaskStatusChart({ data }: { data: TaskStatusData }) {
  const chartData = [
    { name: 'Pending', value: data.pending, color: '#fbbf24' },  // amber
    { name: 'Scheduled', value: data.scheduled, color: '#3b82f6' },  // blue
    { name: 'Completed', value: data.completed, color: '#10b981' },  // green
    { name: 'Failed', value: data.failed, color: '#ef4444' },   // red
  ];

  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">Task Status Distribution</h4>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
          <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Resource Load Bar Chart
export function ResourceLoadChart({ data }: { data: ResourceLoadData[] }) {
  const getBarColor = (load: number) => {
    if (load > 80) return '#ef4444';
    if (load > 60) return '#fbbf24';
    return '#10b981';
  };

  const chartData = data.map(r => ({
    name: r.name,
    load: r.load,
    fill: getBarColor(r.load),
  }));

  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">Resource Load Distribution</h4>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip 
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
            cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }}
          />
          <Bar dataKey="load" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ML Performance Line Chart (Predicted vs Actual)
export function MLPerformanceChart({ data }: { data: PerformanceData[] }) {
  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">ML Prediction Accuracy Over Time</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 20, right: 15, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
          <Legend verticalAlign="top" height={36} />
          <Line type="monotone" dataKey="predicted" name="Predicted Time" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 8 }} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="actual" name="Actual Time" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ML Metrics Radar Chart
export function MLMetricsRadar({ data }: { data: MLMetrics }) {
  const chartData = [
    { subject: 'Accuracy', A: data.accuracy * 100 },
    { subject: 'Precision', A: data.precision * 100 },
    { subject: 'Recall', A: data.recall * 100 },
    { subject: 'F1 Score', A: data.f1Score * 100 },
    { subject: 'Speed', A: Math.max(0, 100 - data.latency * 10) },
  ];

  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">ML Model Metrics</h4>
      <ResponsiveContainer width="100%" height="90%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="rgba(148, 163, 184, 0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} />
          <Radar name="ML Model Performance" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Task Type Distribution Pie Chart
export function TaskTypeChart({ data }: { data: { type: string; count: number }[] }) {
  const colors = ['#3b82f6', '#10b981', '#fbbf24', '#ef4444', '#8b5cf6'];
  const chartData = data.map((d, i) => ({
    name: d.type,
    value: d.count,
    color: colors[i % colors.length],
  }));

  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">Task Type Distribution</h4>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
          <Legend layout="horizontal" align="center" verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Throughput Line Chart
export function ThroughputChart({
  data,
}: {
  data: { time: string; tasksCompleted: number; tasksScheduled: number }[];
}) {
  return (
    <div className="h-80 w-full flex flex-col justify-between">
      <h4 className="text-center font-bold text-slate-700 dark:text-slate-300 text-sm">Task Throughput</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 20, right: 15, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
          <Legend verticalAlign="top" height={36} />
          <Line type="monotone" dataKey="tasksScheduled" name="Tasks Scheduled" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="tasksCompleted" name="Tasks Completed" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Real-time Gauge Component (using canvas)
export function GaugeChart({
  value,
  max = 100,
  label,
  color = 'blue',
}: {
  value: number;
  max?: number;
  label: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
  };

  const drawGauge = (canvas: HTMLCanvasElement, width: number, height: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgTrack = isDark ? '#334155' : '#e5e7eb';
    const textColor = isDark ? '#f1f5f9' : '#1f2937';
    const labelColor = isDark ? '#94a3b8' : '#6b7280';

    const centerX = width / 2;
    const centerY = height - 25;
    const radius = Math.min(centerX, centerY) - 15;
    const lineWidth = Math.max(8, width / 30);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = bgTrack;
    ctx.stroke();

    // Draw value arc
    const percentage = Math.min(value / max, 1);
    const endAngle = Math.PI + percentage * Math.PI;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = colorMap[color];
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw value text
    const fontSize = Math.max(18, width / 12);
    ctx.font = `bold ${fontSize}px Plus Jakarta Sans, system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(value)}%`, centerX, centerY - fontSize / 3);

    // Draw label
    const labelSize = Math.max(10, width / 20);
    ctx.font = `500 ${labelSize}px Plus Jakarta Sans, system-ui, sans-serif`;
    ctx.fillStyle = labelColor;
    ctx.fillText(label.toUpperCase(), centerX, centerY + labelSize + 5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(120, Math.min(rect.width, 200));
      const height = Math.max(100, width * 0.65);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      drawGauge(canvas, width, height);
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    const handleWindowResize = updateCanvasSize;
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [value, max, color, label]);

  return (
    <div ref={containerRef} className="w-full h-auto flex justify-center items-center">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto"
        style={{ display: 'block' }}
      />
    </div>
  );
}

// Combined Analytics Dashboard Component
export function AnalyticsDashboard() {
  // Sample data - in real app, this would come from API
  const taskStatusData: TaskStatusData = {
    pending: 5,
    scheduled: 12,
    completed: 45,
    failed: 2,
  };

  const resourceLoadData: ResourceLoadData[] = [
    { name: 'Server-A', load: 55, capacity: 100 },
    { name: 'Worker-1', load: 60, capacity: 100 },
    { name: 'Server-C', load: 45, capacity: 100 },
    { name: 'GPU-Node', load: 85, capacity: 100 },
  ];

  const performanceData: PerformanceData[] = [
    { date: 'Mon', predicted: 3.2, actual: 3.5 },
    { date: 'Tue', predicted: 4.1, actual: 4.0 },
    { date: 'Wed', predicted: 2.8, actual: 3.1 },
    { date: 'Thu', predicted: 5.2, actual: 5.0 },
    { date: 'Fri', predicted: 3.9, actual: 3.7 },
    { date: 'Sat', predicted: 2.5, actual: 2.6 },
    { date: 'Sun', predicted: 4.3, actual: 4.5 },
  ];

  const mlMetrics: MLMetrics = {
    accuracy: 0.92,
    precision: 0.89,
    recall: 0.94,
    f1Score: 0.91,
    latency: 0.15,
  };

  const taskTypeData = [
    { type: 'CPU', count: 25 },
    { type: 'IO', count: 18 },
    { type: 'MIXED', count: 15 },
  ];

  const throughputData = [
    { time: '00:00', tasksScheduled: 5, tasksCompleted: 4 },
    { time: '04:00', tasksScheduled: 8, tasksCompleted: 7 },
    { time: '08:00', tasksScheduled: 15, tasksCompleted: 12 },
    { time: '12:00', tasksScheduled: 22, tasksCompleted: 20 },
    { time: '16:00', tasksScheduled: 18, tasksCompleted: 17 },
    { time: '20:00', tasksScheduled: 10, tasksCompleted: 9 },
  ];

  return (
    <div className="space-y-6">
      {/* Gauge Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <GaugeChart value={92} label="ML Accuracy" color="green" />
        </div>
        <div className="card">
          <GaugeChart value={78} label="CPU Usage" color="blue" />
        </div>
        <div className="card">
          <GaugeChart value={45} label="Memory" color="purple" />
        </div>
        <div className="card">
          <GaugeChart value={65} label="Task Queue" color="amber" />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <TaskStatusChart data={taskStatusData} />
        </div>
        <div className="card">
          <ResourceLoadChart data={resourceLoadData} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <MLPerformanceChart data={performanceData} />
        </div>
        <div className="card">
          <MLMetricsRadar data={mlMetrics} />
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <TaskTypeChart data={taskTypeData} />
        </div>
        <div className="card">
          <ThroughputChart data={throughputData} />
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
