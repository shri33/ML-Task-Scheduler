import { useState } from 'react';
import { 
  IconPlus, 
  IconDotsVertical, 
  IconMessage, 
  IconPaperclip, 
  IconSearch,
  IconFilter
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import DemoModeBanner from '../components/DemoModeBanner';

const INITIAL_BOARD = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      { id: 1, title: 'Optimize IPSO Convergence', description: 'Fine-tune the adaptive inertia weight for faster convergence in large fog clusters.', labels: ['Algorithm'], comments: 5, attachments: 2, users: ['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2'] },
      { id: 2, title: 'Reduce Discovery Latency', description: 'Optimize the ARP scan protocol to detect new devices in under 500ms.', labels: ['Network'], comments: 12, attachments: 0, users: ['https://i.pravatar.cc/150?u=3'] },
    ]
  },
  {
    id: 'inprogress',
    title: 'In Progress',
    tasks: [
      { id: 3, title: 'Prometheus Integration', description: 'Expose energy consumption metrics from the ML-service to the telemetry pipeline.', labels: ['Feature'], comments: 8, attachments: 3, users: ['https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5'] },
    ]
  },
  {
    id: 'review',
    title: 'Review',
    tasks: [
      { id: 4, title: 'Hybrid IACO-IPSO Logic', description: 'Verify the local refinement phase of the ant colony optimization for task handovers.', labels: ['Research'], comments: 2, attachments: 1, users: ['https://i.pravatar.cc/150?u=6'] },
    ]
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      { id: 5, title: 'Train XGBoost Model', description: 'Successfully trained the load prediction model on 10k historical task samples.', labels: ['ML'], comments: 15, attachments: 1, users: ['https://i.pravatar.cc/150?u=7'] },
      { id: 6, title: 'Setup Zod Validation', description: 'Implemented schema-level safety for all task ingestion endpoints.', labels: ['Security'], comments: 0, attachments: 0, users: ['https://i.pravatar.cc/150?u=8'] },
    ]
  }
];

export default function Kanban() {
  const [board] = useState(INITIAL_BOARD);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <DemoModeBanner featureName="Kanban Board" />
      
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
                           {task.labels.map(l => (
                              <span key={l} className={clsx(
                                 "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                                 l === 'Design' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" :
                                 l === 'Bug' ? "bg-red-50 text-red-600 dark:bg-red-900/20" :
                                 l === 'Feature' ? "bg-primary-50 text-primary-600 dark:bg-primary-900/20" :
                                 "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                              )}>
                                 {l}
                              </span>
                           ))}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{task.title}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-4">{task.description}</p>
                        
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              {task.comments > 0 && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><IconMessage className="w-3.5 h-3.5" stroke={1.5} /> {task.comments}</span>}
                              {task.attachments > 0 && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><IconPaperclip className="w-3.5 h-3.5" stroke={1.5} /> {task.attachments}</span>}
                           </div>
                           <div className="flex -space-x-2">
                              {task.users.map((u, idx) => <img key={idx} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" src={u} alt="" />)}
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
         
         <div className="w-[320px] shrink-0">
            <button className="w-full py-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold text-gray-400 hover:text-primary-600 hover:border-primary-500/50 transition-all flex items-center justify-center gap-2">
               <IconPlus className="w-5 h-5" /> Add New List
            </button>
         </div>
      </div>

    </div>
  );
}
