import { useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { 
  IconPlus, 
  IconDotsVertical, 
  IconSearch,
  IconFilter
} from '@tabler/icons-react';
import { clsx } from 'clsx';

export default function Kanban() {
  const { tasks, fetchTasks, tasksLoading } = useStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const board = useMemo(() => {
    return [
      { id: 'todo', title: 'To Do', status: ['PENDING'] },
      { id: 'inprogress', title: 'In Progress', status: ['SCHEDULED', 'RUNNING'] },
      { id: 'done', title: 'Done', status: ['COMPLETED'] },
      { id: 'failed', title: 'Failed', status: ['FAILED'] },
    ].map(col => ({
      ...col,
      tasks: tasks.filter(t => col.status.includes(t.status))
    }));
  }, [tasks]);

  if (tasksLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1a2234] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
         <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kanban Board</h2>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800" />
            <div className="flex -space-x-2">
               {[1,2,3,4,5].map(i => <img key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800" src={`https://i.pravatar.cc/150?u=${i}`} alt="" />)}
               <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500">+12</div>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="relative">
               <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input type="text" placeholder="Search tasks..." className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none w-48" />
            </div>
            <button className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-primary-600 transition-colors"><IconFilter className="w-5 h-5" /></button>
            <button className="btn btn-primary px-5 py-2.5 flex items-center gap-2">
               <IconPlus className="w-4 h-4" /> New List
            </button>
         </div>
      </div>

      {/* ── BOARD ── */}
      <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar scroll-smooth h-[calc(100vh-280px)]">
         {board.map(column => (
            <div key={column.id} className="w-[320px] shrink-0 flex flex-col h-full group">
               <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                     <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">{column.title}</h3>
                     <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold text-gray-500">{column.tasks.length}</span>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="p-1 hover:text-primary-600 transition-colors"><IconPlus className="w-4 h-4" /></button>
                     <button className="p-1 hover:text-primary-600 transition-colors"><IconDotsVertical className="w-4 h-4" /></button>
                  </div>
               </div>
               
               <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                  {column.tasks.map(task => (
                     <div key={task.id} className="bg-white dark:bg-[#1a2234] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-primary-500/30 transition-all cursor-grab active:cursor-grabbing">
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
                              {task.predictedTime && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">Pred: {task.predictedTime}s</span>}
                           </div>
                           <div className="flex -space-x-2">
                              <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-[8px] font-bold text-white border-2 border-white dark:border-gray-800">
                                {task.name.charAt(0)}
                              </div>
                           </div>
                        </div>
                     </div>
                  ))}
                  <button className="w-full py-3 text-xs font-bold text-gray-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-transparent hover:border-primary-500/20 rounded-2xl">
                     <IconPlus className="w-4 h-4" /> Add New Task
                  </button>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
}
