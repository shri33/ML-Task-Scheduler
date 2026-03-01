import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  /** Optional: render a custom body (e.g. an input) below the message */
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape to cancel & auto-focus confirm button
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    confirmRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const icons = {
    danger: <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    info: <CheckCircle className="h-6 w-6 text-primary-600 dark:text-primary-400" />,
  };

  const confirmColors = {
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white',
    info: 'bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white',
  };

  const iconBg = {
    danger: 'bg-red-100 dark:bg-red-900/30',
    warning: 'bg-amber-100 dark:bg-amber-900/30',
    info: 'bg-primary-100 dark:bg-primary-900/30',
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={clsx('p-3 rounded-full flex-shrink-0', iconBg[variant])}>
              {icons[variant]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {message}
              </p>
              {children && <div className="mt-3">{children}</div>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={clsx(
              'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
              confirmColors[variant],
            )}
          >
            {isLoading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
