import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  height?: number | string;
  showValue?: boolean;
  label?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  color = 'primary',
  height = 8,
  showValue = false,
  label,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colors = {
    primary: 'bg-primary-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    info: 'bg-blue-500',
  };

  const bgColors = {
    primary: 'bg-primary-100 dark:bg-primary-900/20',
    success: 'bg-emerald-100 dark:bg-emerald-900/20',
    warning: 'bg-amber-100 dark:bg-amber-900/20',
    error: 'bg-rose-100 dark:bg-rose-900/20',
    info: 'bg-blue-100 dark:bg-blue-900/20',
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</span>}
          {showValue && <span className="text-xs font-bold text-gray-900 dark:text-white">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div 
        className={clsx('w-full rounded-full overflow-hidden', bgColors[color])}
        style={{ height }}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-500 ease-out', colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
