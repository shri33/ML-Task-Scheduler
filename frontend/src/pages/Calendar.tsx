import { useState, useEffect, useMemo } from 'react';
import { 
  IconChevronLeft, 
  IconChevronRight, 
  IconPlus, 
  IconMenu2,
  IconFilter,
  IconRobot,
  IconDotsVertical
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { Task } from '../types';

export default function Calendar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { tasks, fetchTasks } = useStore();

  useEffect(() => {
    if (tasks.length === 0) {
      fetchTasks();
    }
  }, []);

  // Calendar Logic
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const setToday = () => setCurrentDate(new Date());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  
  const calendarGrid = useMemo(() => {
    const grid = [];
    
    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      grid.push({ day: prevMonthLastDay - i, month: month - 1, year, current: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({ day: i, month, year, current: true });
    }
    
    // Next month days
    const remainingCells = 42 - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({ day: i, month: month + 1, year, current: false });
    }
    
    return grid;
  }, [month, year, daysInMonth, firstDayOfMonth, prevMonthLastDay]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Map tasks to dates
  const getTasksForDate = (day: number, m: number, y: number, current: boolean): Task[] => {
    if (!current) return [];
    return tasks.filter(task => {
      const taskDate = task.scheduledAt ? new Date(task.scheduledAt) : (task.dueDate ? new Date(task.dueDate) : null);
      if (!taskDate) return false;
      return (
        taskDate.getDate() === day &&
        taskDate.getMonth() === m &&
        taskDate.getFullYear() === y
      );
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200';
      case 'RUNNING': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
      case 'FAILED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
      
      {/* ── CALENDAR SIDEBAR ── */}
      <aside 
        className={clsx(
          "flex-col w-72 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2234] transition-all duration-300 absolute lg:relative z-20 h-full",
          sidebarOpen ? "flex left-0" : "hidden lg:flex -left-72 lg:left-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none"
        )}
      >
        <div className="p-6">
          <button className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-all active:scale-95">
            <IconPlus className="w-5 h-5" stroke={2.5} />
            Add New Task
          </button>
        </div>

        <div className="px-6 space-y-8">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Task Filters</h3>
            <div className="space-y-3">
              <FilterItem label="Scheduled" color="bg-blue-500" count={tasks.filter(t => t.status === 'SCHEDULED').length} />
              <FilterItem label="Pending" color="bg-amber-500" count={tasks.filter(t => t.status === 'PENDING').length} />
              <FilterItem label="Completed" color="bg-emerald-500" count={tasks.filter(t => t.status === 'COMPLETED').length} />
              <FilterItem label="Failed" color="bg-red-500" count={tasks.filter(t => t.status === 'FAILED').length} />
            </div>
          </div>

          <div>
             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Quick Stats</h3>
             <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                   <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <IconRobot className="w-4 h-4 text-primary-600" />
                   </div>
                   <div>
                      <p className="text-xs text-gray-500">ML Confidence</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">94.2% Avg</p>
                   </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-primary-500 h-full w-[94%]" />
                </div>
             </div>
          </div>
        </div>
        
        <div className="mt-auto p-6">
           <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-white">
              <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-2">Pro Tip</p>
              <p className="text-sm leading-relaxed">Drag and drop tasks between dates to re-schedule them automatically.</p>
           </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── CALENDAR MAIN AREA ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1a2234]">
        
        {/* Header */}
        <header className="h-20 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <button className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onClick={() => setSidebarOpen(true)}>
              <IconMenu2 className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {monthName} <span className="text-gray-400 font-medium ml-1">{year}</span>
              </h2>
              <div className="flex items-center bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl">
                <button onClick={prevMonth} className="p-1.5 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-all">
                  <IconChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextMonth} className="p-1.5 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-all">
                  <IconChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button onClick={setToday} className="px-4 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all">
                Today
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              {['Month', 'Week', 'Day', 'List'].map((view, i) => (
                <button 
                  key={view}
                  className={clsx(
                    "px-5 py-1.5 text-sm font-bold rounded-lg transition-all",
                    i === 0 
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" 
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
            <button className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all">
               <IconFilter className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-auto flex flex-col p-6 custom-scrollbar">
          
          {/* Days Header */}
          <div className="grid grid-cols-7 gap-6 mb-4">
            {daysOfWeek.map(day => (
              <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-inner">
            {calendarGrid.map((cell, i) => {
              const dayTasks = getTasksForDate(cell.day, cell.month, cell.year, cell.current);
              const isToday = cell.day === new Date().getDate() && cell.month === new Date().getMonth() && cell.year === new Date().getFullYear();

              return (
                <div 
                  key={i} 
                  className={clsx(
                    "bg-white dark:bg-[#1a2234] min-h-[120px] p-3 hover:bg-gray-50 dark:hover:bg-[#1f283d] transition-all cursor-pointer group relative",
                    !cell.current && "opacity-30 grayscale-[0.5]"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={clsx(
                      "w-8 h-8 flex items-center justify-center text-sm font-black rounded-xl transition-all",
                      isToday 
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-110"
                        : "text-gray-700 dark:text-gray-300 group-hover:text-primary-600"
                    )}>
                      {cell.day}
                    </span>
                    {dayTasks.length > 0 && cell.current && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    )}
                  </div>
                  
                  {/* Tasks List */}
                  <div className="space-y-1.5">
                    {dayTasks.slice(0, 3).map(task => (
                      <div 
                        key={task.id}
                        className={clsx(
                          "px-2.5 py-1.5 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 group/task truncate",
                          getStatusColor(task.status)
                        )}
                      >
                        <div className={clsx("w-1.5 h-1.5 rounded-full", task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-current')} />
                        <span className="truncate">{task.name}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] font-black text-gray-400 pl-2">
                        + {dayTasks.length - 3} more
                      </div>
                    )}
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="p-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-primary-600">
                        <IconDotsVertical className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function FilterItem({ label, color, count }: { label: string, color: string, count: number }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-all group border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={clsx("w-3 h-3 rounded-full shadow-sm", color)} />
        <span className="text-sm font-bold text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">{label}</span>
      </div>
      <span className="text-[10px] font-black text-gray-400 group-hover:text-primary-500">{count}</span>
    </label>
  );
}
