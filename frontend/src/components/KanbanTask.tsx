import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { Task } from '../types';

interface KanbanTaskProps {
  task: Task;
}

export const KanbanTask: React.FC<KanbanTaskProps> = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "bg-white dark:bg-[#1a2234] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-primary-500/30 transition-all cursor-grab active:cursor-grabbing",
        isDragging && "ring-2 ring-primary-500 shadow-xl"
      )}
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={clsx(
             "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
             task.type === 'CPU' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" :
             task.type === 'IO' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" :
             "bg-primary-50 text-primary-600 dark:bg-primary-900/20"
          )}>
             {task.type}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
             P{task.priority}
          </span>
      </div>
      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{task.name}</h4>
      <p className="text-xs text-gray-500 line-clamp-2 mb-4">
        {task.resource ? `Assigned to ${task.resource.name}` : 'Waiting for resource allocation...'}
      </p>
      
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
            {task.predictedTime && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">Pred: {task.predictedTime.toFixed(2)}s</span>}
         </div>
         <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-[8px] font-bold text-white border-2 border-white dark:border-gray-800">
              {task.name.charAt(0)}
            </div>
         </div>
      </div>
    </div>
  );
};
