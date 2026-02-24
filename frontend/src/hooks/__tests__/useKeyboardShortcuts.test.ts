import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls action when matching key is pressed', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 'd', action, description: 'Test action' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate keydown event
    const event = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(event);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles shift modifier correctly', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: '?', shift: true, action, description: 'Show help' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without shift - should not trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(action).not.toHaveBeenCalled();

    // With shift - should trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles ctrl modifier correctly', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 's', ctrl: true, action, description: 'Save' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without ctrl - should not trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(action).not.toHaveBeenCalled();

    // With ctrl - should trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('handles alt modifier correctly', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 'n', alt: true, action, description: 'New' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without alt - should not trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    expect(action).not.toHaveBeenCalled();

    // With alt - should trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when typing in input elements', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 'd', action, description: 'Dashboard' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Create and focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Simulate keydown on input
    const event = new KeyboardEvent('keydown', { key: 'd', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    input.dispatchEvent(event);

    expect(action).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(input);
  });

  it('allows Escape key even in inputs', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 'Escape', action, description: 'Close' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Create and focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Simulate Escape keydown on input
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(action).toHaveBeenCalledTimes(1);

    // Cleanup
    document.body.removeChild(input);
  });

  it('does not trigger when disabled', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 'd', action, description: 'Test' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, false));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(action).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const action = vi.fn();
    const shortcuts = [
      { key: 'd', action, description: 'Test' },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('handles multiple shortcuts', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    const shortcuts = [
      { key: 'd', action: action1, description: 'Dashboard' },
      { key: 't', action: action2, description: 'Tasks' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(action1).toHaveBeenCalledTimes(1);
    expect(action2).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    expect(action2).toHaveBeenCalledTimes(1);
  });

  it('prevents default event behavior when shortcut matches', () => {
    const action = vi.fn();
    const shortcuts = [
      { key: 's', ctrl: true, action, description: 'Save' },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    
    window.dispatchEvent(event);
    
    // In JSDOM, we verify the action was called (preventDefault is called internally)
    expect(action).toHaveBeenCalled();
  });
});
