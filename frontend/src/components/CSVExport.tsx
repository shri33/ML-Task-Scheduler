import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';

// Helper to read a cookie value
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

interface ExportOption {
  name: string;
  endpoint: string;
  filename: string;
  description: string;
}

const csvExports: ExportOption[] = [
  {
    name: 'Tasks',
    endpoint: '/api/reports/csv/tasks',
    filename: 'tasks-export.csv',
    description: 'All tasks with details',
  },
  {
    name: 'Resources',
    endpoint: '/api/reports/csv/resources',
    filename: 'resources-export.csv',
    description: 'All resources with load',
  },
  {
    name: 'Schedule History',
    endpoint: '/api/reports/csv/schedule-history',
    filename: 'schedule-history.csv',
    description: 'Scheduling history log',
  },
];

export default function CSVExport() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (option: ExportOption) => {
    setDownloading(option.endpoint);
    setShowDropdown(false);
    try {
      const response = await fetch(option.endpoint, {
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
      a.download = option.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export complete', `${option.name} CSV has been downloaded.`);
    } catch (error) {
      toast.error('Export failed', 'Could not download the CSV file.');
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
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {downloading ? 'Exporting...' : 'Export CSV'}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 animate-scale-in">
            <div className="p-2">
              {csvExports.map((option) => (
                <button
                  key={option.endpoint}
                  onClick={() => handleDownload(option)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {option.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
