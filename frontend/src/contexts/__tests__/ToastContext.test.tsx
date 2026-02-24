import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

// Test component that uses the toast hook
function TestComponent() {
  const { success, error, info, warning, toasts } = useToast();

  return (
    <div>
      <button onClick={() => success('Success!', 'This worked')}>Show Success</button>
      <button onClick={() => error('Error!', 'Something failed')}>Show Error</button>
      <button onClick={() => info('Info', 'For your information')}>Show Info</button>
      <button onClick={() => warning('Warning!', 'Be careful')}>Show Warning</button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('provides toast context to children', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    expect(screen.getByText('Show Success')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');
    
    consoleSpy.mockRestore();
  });

  it('shows success toast when success is called', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('This worked')).toBeInTheDocument();
  });

  it('shows error toast when error is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('shows info toast when info is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('For your information')).toBeInTheDocument();
  });

  it('shows warning toast when warning is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Warning'));

    expect(screen.getByText('Warning!')).toBeInTheDocument();
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('auto-removes toast after 5 seconds', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Show Success'));
    });
    
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    // Fast-forward 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('supports multiple toasts at once', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('removes toast when close button is clicked', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Show Success'));
    });
    expect(screen.getByText('Success!')).toBeInTheDocument();

    // Find and click the close button (X) - it's a button with no accessible name
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.closest('[class*="toast"]') || btn.querySelector('svg'));
    
    if (closeButton) {
      await act(async () => {
        fireEvent.click(closeButton);
      });
    }

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});
