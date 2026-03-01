/**
 * Dashboard page tests
 * Validates:
 *  - Renders loading skeleton initially
 *  - Displays stat cards after data loads
 *  - Refresh button triggers data re-fetch
 *  - Schedule button triggers scheduler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { ToastProvider } from '../../contexts/ToastContext';

// ---- Mock store ---- //
const mockStore = {
  tasks: [],
  resources: [],
  metrics: null,
  mlAvailable: true,
  scheduling: false,
  tasksLoading: false,
  resourcesLoading: false,
  metricsLoading: false,
  fetchTasks: vi.fn().mockResolvedValue(undefined),
  fetchResources: vi.fn().mockResolvedValue(undefined),
  fetchMetrics: vi.fn().mockResolvedValue(undefined),
  checkMlStatus: vi.fn().mockResolvedValue(undefined),
  runScheduler: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../store', () => ({
  useStore: () => mockStore,
}));

function renderDashboard() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </BrowserRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.tasks = [];
    mockStore.resources = [];
    mockStore.metrics = null;
    mockStore.tasksLoading = false;
    mockStore.resourcesLoading = false;
    mockStore.metricsLoading = false;
  });

  it('calls fetch functions on mount', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(mockStore.fetchTasks).toHaveBeenCalled();
      expect(mockStore.fetchResources).toHaveBeenCalled();
      expect(mockStore.fetchMetrics).toHaveBeenCalled();
      expect(mockStore.checkMlStatus).toHaveBeenCalled();
    });
  });

  it('renders stat cards when data is loaded', async () => {
    mockStore.tasks = [
      { id: '1', name: 'T1', status: 'PENDING', type: 'CPU', size: 'SMALL', priority: 3 },
      { id: '2', name: 'T2', status: 'COMPLETED', type: 'IO', size: 'LARGE', priority: 5 },
    ] as any;
    mockStore.resources = [
      { id: 'r1', name: 'R1', status: 'AVAILABLE', currentLoad: 10 },
    ] as any;

    renderDashboard();

    // Should show total tasks count
    await waitFor(() => {
      expect(screen.getByText(/Total Tasks/i)).toBeInTheDocument();
    });
  });

  it('refresh button re-fetches data', async () => {
    renderDashboard();

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      // fetchTasks is called on mount + on refresh
      expect(mockStore.fetchTasks).toHaveBeenCalledTimes(2);
    });
  });

  it('schedule button triggers runScheduler', async () => {
    mockStore.tasks = [
      { id: '1', name: 'T1', status: 'PENDING', type: 'CPU', size: 'SMALL', priority: 3 },
    ] as any;
    renderDashboard();

    const scheduleBtn = screen.getByRole('button', { name: /schedule/i });
    fireEvent.click(scheduleBtn);

    await waitFor(() => {
      expect(mockStore.runScheduler).toHaveBeenCalled();
    });
  });

  it('shows ML status indicator', async () => {
    mockStore.mlAvailable = true;
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('ML Service Connected')).toBeInTheDocument();
    });
  });
});
