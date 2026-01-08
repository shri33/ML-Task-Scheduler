import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape to work even in inputs
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export const defaultShortcuts: ShortcutConfig[] = [
  { key: '/', action: () => {}, description: 'Focus search' },
  { key: 'n', action: () => {}, description: 'New task' },
  { key: 'e', action: () => {}, description: 'Edit selected' },
  { key: 'd', action: () => {}, description: 'Dashboard' },
  { key: 't', action: () => {}, description: 'Tasks page' },
  { key: 'r', action: () => {}, description: 'Resources page' },
  { key: 'a', action: () => {}, description: 'Analytics page' },
  { key: '?', shift: true, action: () => {}, description: 'Show shortcuts' },
  { key: 'Escape', action: () => {}, description: 'Close modal/dialog' },
];
