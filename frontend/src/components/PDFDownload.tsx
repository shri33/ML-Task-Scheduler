import { FileText, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { clsx } from 'clsx';

interface ReportButton {
  name: string;
  endpoint: string;
  filename: string;
  description: string;
}

const reports: ReportButton[] = [
  {
    name: 'Task Summary',
    endpoint: '/api/reports/pdf/tasks',
    filename: 'task-summary-report.pdf',
    description: 'All tasks with status breakdown',
  },
  {
    name: 'ML Performance',
    endpoint: '/api/reports/pdf/performance',
    filename: 'ml-performance-report.pdf',
    description: 'ML prediction accuracy analysis',
  },
  {
    name: 'Resource Utilization',
    endpoint: '/api/reports/pdf/resources',
    filename: 'resource-utilization-report.pdf',
    description: 'Resource load and efficiency',
  },
];

export function PDFDownloadButtons() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (report: ReportButton) => {
    setDownloading(report.endpoint);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}${report.endpoint}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download complete', `${report.name} report has been downloaded.`);
    } catch (error) {
      toast.error('Download failed', 'Could not download the report. Please try again.');
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
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
          )}
        >
          <div
            className={clsx(
              'p-2 rounded-lg',
              downloading === report.endpoint
                ? 'bg-primary-100 dark:bg-primary-900/40'
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
export default function PDFDownload() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (report: ReportButton) => {
    setDownloading(report.endpoint);
    setShowDropdown(false);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}${report.endpoint}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download complete', `${report.name} report has been downloaded.`);
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
