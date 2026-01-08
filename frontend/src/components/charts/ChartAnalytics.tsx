import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
  const chartData = {
    labels: ['Pending', 'Scheduled', 'Completed', 'Failed'],
    datasets: [
      {
        data: [data.pending, data.scheduled, data.completed, data.failed],
        backgroundColor: [
          'rgba(251, 191, 36, 0.8)',  // amber
          'rgba(59, 130, 246, 0.8)',  // blue
          'rgba(16, 185, 129, 0.8)',  // green
          'rgba(239, 68, 68, 0.8)',   // red
        ],
        borderColor: [
          'rgba(251, 191, 36, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: 'Task Status Distribution',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
    cutout: '60%',
  };

  return (
    <div className="h-80">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

// Resource Load Bar Chart
export function ResourceLoadChart({ data }: { data: ResourceLoadData[] }) {
  const chartData = {
    labels: data.map((r) => r.name),
    datasets: [
      {
        label: 'Current Load (%)',
        data: data.map((r) => r.load),
        backgroundColor: data.map((r) =>
          r.load > 80
            ? 'rgba(239, 68, 68, 0.8)'
            : r.load > 60
            ? 'rgba(251, 191, 36, 0.8)'
            : 'rgba(16, 185, 129, 0.8)'
        ),
        borderColor: data.map((r) =>
          r.load > 80
            ? 'rgba(239, 68, 68, 1)'
            : r.load > 60
            ? 'rgba(251, 191, 36, 1)'
            : 'rgba(16, 185, 129, 1)'
        ),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Resource Load Distribution',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: (value: number | string) => `${value}%`,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// ML Performance Line Chart (Predicted vs Actual)
export function MLPerformanceChart({ data }: { data: PerformanceData[] }) {
  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Predicted Time',
        data: data.map((d) => d.predicted),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Actual Time',
        data: data.map((d) => d.actual),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: 'ML Prediction Accuracy Over Time',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        title: {
          display: true,
          text: 'Execution Time (seconds)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="h-80">
      <Line data={chartData} options={options} />
    </div>
  );
}

// ML Metrics Radar Chart
export function MLMetricsRadar({ data }: { data: MLMetrics }) {
  const chartData = {
    labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'Speed'],
    datasets: [
      {
        label: 'ML Model Performance',
        data: [
          data.accuracy * 100,
          data.precision * 100,
          data.recall * 100,
          data.f1Score * 100,
          Math.max(0, 100 - data.latency * 10), // Convert latency to speed score
        ],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'ML Model Metrics',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          font: { size: 12 },
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Radar data={chartData} options={options} />
    </div>
  );
}

// Task Type Distribution Pie Chart
export function TaskTypeChart({ data }: { data: { type: string; count: number }[] }) {
  const colors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(251, 191, 36, 0.8)',   // amber
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(139, 92, 246, 0.8)',   // purple
  ];

  const chartData = {
    labels: data.map((d) => d.type),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: colors.slice(0, data.length),
        borderColor: colors.slice(0, data.length).map((c) => c.replace('0.8', '1')),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: 'Task Type Distribution',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
  };

  return (
    <div className="h-80">
      <Pie data={chartData} options={options} />
    </div>
  );
}

// Throughput Line Chart
export function ThroughputChart({
  data,
}: {
  data: { time: string; tasksCompleted: number; tasksScheduled: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.time),
    datasets: [
      {
        label: 'Tasks Scheduled',
        data: data.map((d) => d.tasksScheduled),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: 'Tasks Completed',
        data: data.map((d) => d.tasksCompleted),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: 'Task Throughput',
        font: { size: 16, weight: 'bold' as const },
        padding: { bottom: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        title: {
          display: true,
          text: 'Number of Tasks',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="h-80">
      <Line data={chartData} options={options} />
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

  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height - 30;
    const radius = Math.min(centerX, centerY) - 20;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#e5e7eb';
    ctx.stroke();

    // Draw value arc
    const percentage = Math.min(value / max, 1);
    const endAngle = Math.PI + percentage * Math.PI;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = colorMap[color];
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw value text
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(value)}%`, centerX, centerY - 20);

    // Draw label
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(label, centerX, centerY + 10);
  }, [value, max, color, label]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={130}
      className="mx-auto"
    />
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
