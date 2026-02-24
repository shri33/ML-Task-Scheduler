import { memo } from 'react';
import { clsx } from 'clsx';
import { Calendar, AlertTriangle } from 'lucide-react';

export const TypeBadge = memo(function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    CPU: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    IO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    MIXED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  };
  return (
    <span
      className={clsx('px-2 py-1 rounded text-xs font-medium', colors[type])}
    >
      {type}
    </span>
  );
});

export const PriorityBadge = memo(function PriorityBadge({ priority, showLabel = false }: { priority: number; showLabel?: boolean }) {
  const colors: Record<number, string> = {
    1: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    2: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    3: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300',
    4: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300',
    5: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',
  };
  const labels: Record<number, string> = {
    1: 'Low', 2: 'Normal', 3: 'Medium', 4: 'High', 5: 'Critical',
  };
  return (
    <span
      className={clsx(
        'px-2 py-1 text-xs font-medium',
        showLabel ? 'rounded-full' : 'rounded',
        colors[priority]
      )}
    >
      {showLabel ? labels[priority] : `P${priority}`}
    </span>
  );
});

export const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    SCHEDULED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    RUNNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    AVAILABLE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    BUSY: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    ONLINE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    OFFLINE: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    MAINTENANCE: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  };
  return (
    <span
      className={clsx('px-2 py-1 rounded text-xs font-medium', colors[status])}
    >
      {status}
    </span>
  );
});

export const DueDateBadge = memo(function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate) {
    return <span className="text-gray-400 dark:text-gray-500">-</span>;
  }

  const now = new Date();
  const due = new Date(dueDate);
  const isOverdue = due < now && status !== 'COMPLETED';
  const isNearDue = !isOverdue && due.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && status !== 'COMPLETED';

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isOverdue) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="font-medium">Overdue</span>
      </span>
    );
  }

  if (isNearDue) {
    return (
      <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-sm">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDate(due)}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm">
      <Calendar className="h-3.5 w-3.5" />
      <span>{formatDate(due)}</span>
    </span>
  );
});
