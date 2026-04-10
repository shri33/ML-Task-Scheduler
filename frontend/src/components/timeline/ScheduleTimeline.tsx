import React, { useMemo } from 'react';
import type { Task } from '../../types';

import { useUIStore } from '../../store/uiStore';
import { cn } from '../scheduler/ExplainableTaskCard';

interface ScheduleTimelineProps {
  tasks: Task[];
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ tasks }) => {
  const { simulationMode } = useUIStore();
  
  // Sort tasks chronologically or by priority if unordered
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      return b.priority - a.priority;
    });
  }, [tasks]);

  const totalDuration = useMemo(() => {
    return sortedTasks.reduce((acc, t) => acc + (t.predictedTime || 60), 0);
  }, [sortedTasks]);

  if (tasks.length === 0) {
    return <div className="p-8 text-center text-slate-500">No scheduled tasks available for timeline view.</div>;
  }

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col relative">
      {simulationMode && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" />
      )}
      
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Execution Timeline</h3>
          <p className="text-xs text-slate-500 mt-1">Total projected duration: {(totalDuration / 60).toFixed(1)} hrs</p>
        </div>
        {simulationMode && (
          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/30">
            Simulation Active
          </span>
        )}
      </div>

      <div className="p-6 overflow-x-auto">
        <div className="min-w-[800px] flex items-center relative py-4">
          {/* Reference Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2" />
          
          {sortedTasks.map((task, idx) => {
            const durationWidth = Math.max(10, ((task.predictedTime || 60) / totalDuration) * 100);
            const isLatePrediction = task.priority > 3; // Mocking prediction

            return (
              <div 
                key={task.id} 
                className={cn(
                  "relative group cursor-pointer transition-all hover:z-10 hover:-translate-y-1",
                  "flex-shrink-0"
                )}
                style={{ width: `${durationWidth}%` }}
              >
                {/* Node */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-slate-900 shadow-md transition-colors"
                     style={{ backgroundColor: isLatePrediction ? '#ef4444' : '#3b82f6' }}
                />
                
                {/* Connector Line Fill representing duration */}
                <div className="absolute left-1/2 right-[-50%] top-1/2 h-1 -translate-y-1/2 transition-colors"
                     style={{ backgroundColor: isLatePrediction ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)' }}
                />

                {/* Tooltip Card */}
                <div className={cn(
                  "absolute opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mt-6 left-1/2 -translate-x-1/2",
                  "bg-slate-800 border border-slate-700 shadow-xl rounded-lg p-3 w-48 z-20"
                )}>
                  <div className="text-[11px] font-bold text-slate-100 mb-1">{task.name}</div>
                  <div className="text-[10px] text-slate-400">Idx: {idx} • P{task.priority}</div>
                  <div className="mt-2 text-[10px] flex justify-between">
                    <span className="text-slate-500">Duration</span>
                    <span className="text-slate-300">{(task.predictedTime || 0).toFixed(1)}m</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
