import { X, Keyboard } from 'lucide-react';

interface ShortcutEntry {
  key: string;
  modifier?: string;
  description: string;
}

const shortcuts: ShortcutEntry[] = [
  { key: '/', description: 'Focus search bar' },
  { key: 'N', description: 'Create new task' },
  { key: 'E', description: 'Edit selected task' },
  { key: 'D', description: 'Go to Dashboard' },
  { key: 'T', description: 'Go to Tasks page' },
  { key: 'R', description: 'Go to Resources page' },
  { key: 'A', description: 'Go to Analytics page' },
  { key: '?', modifier: 'Shift', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close modal/dialog' },
  { key: 'K', modifier: '⌘/Ctrl', description: 'Command palette' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex gap-1">
                {shortcut.modifier && (
                  <>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                      {shortcut.modifier}
                    </kbd>
                    <span className="text-gray-400">+</span>
                  </>
                )}
                <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                  {shortcut.key}
                </kbd>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 rounded">?</kbd> anytime to see shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}
