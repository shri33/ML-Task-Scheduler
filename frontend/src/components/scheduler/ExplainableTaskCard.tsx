import React from 'react';
import type { Task } from '../../types';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExplainableTaskCardProps {
  task: Task;
  onSelect?: () => void;
  selected?: boolean;
}

export const ExplainableTaskCard: React.FC<ExplainableTaskCardProps> = ({ task, onSelect, selected }) => {
  // const { mutate: updateTask } = useUpdateTask(); // reserved for future interactivity

  // Simulated AI Reasoning Data
  // In a real implementation, this comes from TaskEvent ML schema data attached to the task response
  const predictedLatnessProbability = task.priority > 3 ? 0.8 : 0.2; 
  const timeToDeadline = task.dueDate ? new Date(task.dueDate).getTime() - Date.now() : 86400000;
  const isUrgent = timeToDeadline < 3600000 * 2; // < 2 hours

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-xl border bg-slate-900/40 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/80 cursor-pointer overflow-hidden group",
        selected ? "border-blue-500 bg-slate-800 ring-1 ring-blue-500 shadow-lg shadow-blue-500/20" : "border-slate-800"
      )}
    >
      {/* Background ML Probability Indicator */}
      <div 
        className="absolute top-0 bottom-0 left-0 w-1 transition-colors duration-500" 
        style={{
          backgroundColor: predictedLatnessProbability > 0.6 ? '#ef4444' : predictedLatnessProbability > 0.3 ? '#f59e0b' : '#3b82f6'
        }}
      />

      <div className="pl-3 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-slate-100 font-semibold tracking-tight leading-none">{task.name}</h4>
            <p className="text-slate-400 text-xs mt-1 font-medium">{task.type} • {task.size}</p>
          </div>
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
            isUrgent ? "bg-red-500/10 text-red-500" : "bg-slate-800 text-slate-300"
          )}>
            {isUrgent ? 'Urgent' : `Priority ${task.priority}`}
          </span>
        </div>

        {/* Explainability Block */}
        <div className="mt-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-300 font-medium">AI Latency Prediction</span>
            <span className={cn(
              "font-bold",
              predictedLatnessProbability > 0.6 ? "text-red-400" : "text-blue-400"
            )}>
              {(predictedLatnessProbability * 100).toFixed(0)}% Lateness Probability
            </span>
          </div>
          
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-in-out",
                predictedLatnessProbability > 0.6 ? "bg-red-500" : predictedLatnessProbability > 0.3 ? "bg-amber-500" : "bg-blue-500"
              )}
              style={{ width: `${predictedLatnessProbability * 100}%` }}
            />
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              {task.predictedTime ? `Estimated Duration: ${task.predictedTime.toFixed(1)}m` : 'Duration unestimated'}
            </p>
            {isUrgent && (
              <p className="text-[11px] text-red-400/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Deadline approaches within 2 hours
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
