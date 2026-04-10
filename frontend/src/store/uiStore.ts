import { create } from 'zustand';

interface UIState {
  // Navigation
  isTimelineView: boolean;
  setTimelineView: (isTimeline: boolean) => void;

  // Interactions
  selectedTaskIds: string[];
  toggleTaskSelection: (taskId: string) => void;
  clearSelection: () => void;

  // Simulation / ML Mode
  simulationMode: boolean;
  setSimulationMode: (active: boolean) => void;

  // Real-time synchronization
  lastConnectedAt: Date | null;
  setConnectedStatus: (date: Date | null) => void;

  // Error State bounds
  globalError: string | null;
  setGlobalError: (error: string | null) => void;
  clearGlobalError: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isTimelineView: false,
  setTimelineView: (isTimeline) => set({ isTimelineView: isTimeline }),

  selectedTaskIds: [],
  toggleTaskSelection: (taskId) =>
    set((state) => {
      const exists = state.selectedTaskIds.includes(taskId);
      return {
        selectedTaskIds: exists
          ? state.selectedTaskIds.filter((t) => t !== taskId)
          : [...state.selectedTaskIds, taskId],
      };
    }),
  clearSelection: () => set({ selectedTaskIds: [] }),

  simulationMode: false,
  setSimulationMode: (active) => set({ simulationMode: active }),

  lastConnectedAt: null,
  setConnectedStatus: (date) => set({ lastConnectedAt: date }),

  globalError: null,
  setGlobalError: (error) => set({ globalError: error }),
  clearGlobalError: () => set({ globalError: null }),
}));
