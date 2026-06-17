import { FileText, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { clsx } from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to read a cookie value
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[/\\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Shared download utility — sends credentials + CSRF with every request */
async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const response = await fetch(endpoint, {
    credentials: 'include',
    headers: {
      'X-CSRF-Token': getCookie('csrf-token') || '',
    },
  });
  if (!response.ok) throw new Error('Download failed');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

interface ReportButton {
  name: string;
  endpoint: string;
  filename: string;
  description: string;
}

interface AnalyticsProps {
  timeline?: any[];
  comparison?: any;
  anomalies?: any[];
  tasks?: any[];
  resources?: any[];
  dateRange?: string | number;
}

const reports: ReportButton[] = [
  {
    name: 'Task Summary',
    endpoint: '/api/v1/reports/pdf/tasks',
    filename: 'task-summary-report.pdf',
    description: 'All tasks with status breakdown',
  },
  {
    name: 'ML Performance',
    endpoint: '/api/v1/reports/pdf/performance',
    filename: 'ml-performance-report.pdf',
    description: 'ML prediction accuracy analysis',
  },
  {
    name: 'Resource Utilization',
    endpoint: '/api/v1/reports/pdf/resources',
    filename: 'resource-utilization-report.pdf',
    description: 'Resource load and efficiency',
  },
];

async function generateAnalyticsPdf(reportName: string, data: AnalyticsProps) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = `${reportName} - ${new Date().toLocaleDateString()}`;
  doc.setFontSize(14);
  doc.text(title, 40, 50);
  doc.setFontSize(10);
  doc.text(`Date Range: ${data.dateRange || 'N/A'}`, 40, 70);

  if (reportName === 'Task Summary') {
    const rows = (data.tasks || []).map((t: any) => [t.id || '', t.name || t.type || '', t.status || '', t.scheduledAt || '']);
    autoTable(doc, {
      startY: 90,
      head: [['ID', 'Name/Type', 'Status', 'Scheduled At']],
      body: rows,
      styles: { fontSize: 9 }
    });
  }

  if (reportName === 'ML Performance') {
    const timeline = data.timeline || [];
    const rows = timeline.map((r: any) => [r.date || '', String(r.tasksScheduled || ''), String(r.avgExecutionTime || ''), String(r.mlAccuracy || '')]);
    autoTable(doc, {
      startY: 90,
      head: [['Date', 'Tasks Scheduled', 'Avg Exec Time', 'ML Accuracy']],
      body: rows,
      styles: { fontSize: 9 }
    });
    if (data.comparison) {
      const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 200;
      doc.text('Comparison Summary', 40, y + 12);
      autoTable(doc, {
        startY: y + 20,
        head: [['Metric', 'With ML', 'Without ML']],
        body: [
          ['Count', String(data.comparison.withML.count || ''), String(data.comparison.withoutML.count || '')],
          ['Avg Time', String(data.comparison.withML.avgTime || ''), String(data.comparison.withoutML.avgTime || '')],
          ['Avg Error', String(data.comparison.withML.avgError || ''), String(data.comparison.withoutML.avgError || '')],
        ],
        styles: { fontSize: 9 }
      });
    }
  }

  if (reportName === 'Resource Utilization') {
    const rows = (data.resources || []).map((r: any) => [r.name || '', String(r.currentLoad || ''), String(r.capacity || '')]);
    autoTable(doc, {
      startY: 90,
      head: [['Resource', 'Load', 'Capacity']],
      body: rows,
      styles: { fontSize: 9 }
    });
  }

  const filename = `${reportName.replace(/\s+/g, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export function PDFDownloadButtons(props?: AnalyticsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (report: ReportButton) => {
    setDownloading(report.endpoint);
    try {
      // If analytics props are provided, generate client-side PDFs using current data
      if (props && (props.timeline || props.tasks || props.resources || props.comparison)) {
        await generateAnalyticsPdf(report.name, props);
        toast.success(`${report.name} report has been generated.`);
      } else {
        await downloadFile(report.endpoint, report.filename);
        toast.success('Download complete', `${report.name} report has been downloaded.`);
      }
    } catch (error) {
      console.error('PDF download/generation error:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Download failed', message || 'Could not download the report.');
    } finally {
      setDownloading(null);
    }
  };

  

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {reports.map((report) => (
        <button
          key={report.endpoint}
          onClick={() => handleDownload(report)}
          disabled={downloading !== null}
          className={clsx(
            'flex items-center gap-3 p-4 rounded-lg border-2 border-dashed transition-all text-left',
            downloading === report.endpoint
              ? 'border-primary-400 bg-primary-50 dark:bg-black/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-black/30'
          )}
        >
          <div
            className={clsx(
              'p-2 rounded-lg',
              downloading === report.endpoint
                ? 'bg-primary-100 dark:bg-black/30'
                : 'bg-gray-100 dark:bg-gray-800'
            )}
          >
            {downloading === report.endpoint ? (
              <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
            ) : (
              <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {report.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {report.description}
            </p>
          </div>
          <Download className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

export function PDFDownloadCard() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Download Reports
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          PDF
        </span>
      </div>
      <PDFDownloadButtons />
    </div>
  );
}

// Default export - simple button that shows PDF download options
export default function PDFDownload(props?: AnalyticsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (report: ReportButton) => {
    setDownloading(report.endpoint);
    setShowDropdown(false);
    try {
      if (props && (props.timeline || props.tasks || props.resources || props.comparison)) {
        await generateAnalyticsPdf(report.name, props);
        toast.success('Download complete', `${report.name} report has been generated.`);
      } else {
        await downloadFile(report.endpoint, report.filename);
        toast.success('Download complete', `${report.name} report has been downloaded.`);
      }
    } catch (error) {
      toast.error('Download failed', 'Could not download the report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={downloading !== null}
        className="btn btn-secondary flex items-center gap-2"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {downloading ? 'Downloading...' : 'Export PDF'}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 animate-scale-in">
            <div className="p-2">
              {reports.map((report) => (
                <button
                  key={report.endpoint}
                  onClick={() => handleDownload(report)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {report.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {report.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
