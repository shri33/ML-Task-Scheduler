import { useState, useEffect, useMemo } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconMenu2,
  IconRobot,
  IconDotsVertical,
  IconX,
  IconCalendar
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { Task } from '../types';
import { taskApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

type CalendarView = 'Month' | 'Week' | 'Day' | 'List';

function toApiDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  if (dueDate.length > 10) return dueDate;
  return new Date(`${dueDate}T12:00:00`).toISOString();
}

export default function Calendar() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('Month');
  const { tasks, fetchTasks, addTask } = useStore();
  const toast = useToast();

  // Calendar creation modal state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'CPU' | 'IO' | 'MIXED'>('MIXED');
  const [newSize, setNewSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [newPriority, setNewPriority] = useState<number>(3);
  const [newDueDate, setNewDueDate] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateFromCalendar = async () => {
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);
    const payload = {
      name: newName,
      type: newType,
      size: newSize,
      priority: newPriority,
      dueDate: toApiDueDate(newDueDate),
    };
    try {
      const task = await taskApi.create(payload as any);
      addTask(task);
      setShowNewTaskModal(false);
      setNewName('');
      toast.success('Task created', `"${task.name}" has been created.`);
    } catch (err) {
      console.error('Calendar task creation failed:', err);
      const anyErr = err as any;
      const status = anyErr?.response?.status;
      if (status === 401 || !anyErr?.response) {
        const localTask: Task = {
          id: `local-${Date.now()}`,
          name: newName,
          type: newType,
          size: newSize,
          priority: newPriority,
          status: 'PENDING',
          dueDate: newDueDate ?? null,
          predictedTime: null,
          actualTime: null,
          resourceId: null,
          resource: undefined,
          createdAt: new Date().toISOString(),
          scheduledAt: null,
          completedAt: null,
          updatedAt: new Date().toISOString(),
        };
        addTask(localTask);
        setShowNewTaskModal(false);
        setNewName('');
        toast.info('Task Added Locally', 'Task saved locally and will appear in calendar and tasks list.');
      } else {
        toast.error('Creation Failed', 'Could not create task. Check backend connection.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (tasks.length === 0) {
      fetchTasks();
    }
  }, []);

  // Calendar Logic
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);

  const setToday = () => setCurrentDate(new Date());

  const navigatePeriod = (direction: -1 | 1) => {
    if (viewMode === 'Month' || viewMode === 'List') {
      setCurrentDate(new Date(year, month + direction, 1));
      return;
    }

    if (viewMode === 'Week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + direction * 7);
      setCurrentDate(next);
      return;
    }

    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + direction);
    setCurrentDate(next);
  };

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

  const getCalendarDotColor = (dayTasks: Task[]) => {
    // If multiple statuses exist on the same day, prioritize the most urgent one.
    if (dayTasks.some((task) => task.status === 'FAILED')) return 'bg-red-500';
    if (dayTasks.some((task) => task.status === 'RUNNING')) return 'bg-orange-500';
    if (dayTasks.some((task) => task.status === 'PENDING')) return 'bg-yellow-500';
    if (dayTasks.some((task) => task.status === 'SCHEDULED')) return 'bg-blue-500';
    if (dayTasks.some((task) => task.status === 'COMPLETED')) return 'bg-emerald-500';
    return 'bg-primary-500';
  };

  const tasksWithDate = useMemo(() => {
    return tasks
      .map((task) => {
        const dateValue = task.scheduledAt ?? task.dueDate;
        if (!dateValue) return null;
        return {
          task,
          date: new Date(dateValue),
        };
      })
      .filter((entry): entry is { task: Task; date: Date } => entry !== null);
  }, [tasks]);

  const weekStart = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return start;
  }, [currentDate]);

  const weekDaysData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dayTasks = tasksWithDate
        .filter(
          ({ date: taskDate }) =>
            taskDate.getDate() === date.getDate() &&
            taskDate.getMonth() === date.getMonth() &&
            taskDate.getFullYear() === date.getFullYear()
        )
        .map(({ task }) => task);

      return { date, tasks: dayTasks };
    });
  }, [weekStart, tasksWithDate]);

  const selectedDayTasks = useMemo(() => {
    return tasksWithDate
      .filter(
        ({ date }) =>
          date.getDate() === currentDate.getDate() &&
          date.getMonth() === currentDate.getMonth() &&
          date.getFullYear() === currentDate.getFullYear()
      )
      .map(({ task }) => task);
  }, [tasksWithDate, currentDate]);

  const listViewTasks = useMemo(() => {
    return [...tasksWithDate]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ task, date }) => ({ task, date }));
  }, [tasksWithDate]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'Month') {
      return `${monthName} ${year}`;
    }

    if (viewMode === 'Week') {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    }

    if (viewMode === 'Day') {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    return `All Scheduled Tasks (${listViewTasks.length})`;
  }, [viewMode, monthName, year, weekStart, currentDate, listViewTasks.length]);

  return (
    <>
    <div className="flex h-[calc(100vh-120px)] overflow-hidden bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
      
      {/* ── CALENDAR SIDEBAR ── */}
      <aside 
        className={clsx(
          "flex-col w-72 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2234] transition-all duration-300 absolute lg:relative z-20 h-full",
          sidebarOpen ? "flex left-0" : "hidden lg:flex -left-72 lg:left-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none"
        )}
      >
        <div className="p-6">
          <button onClick={() => setShowNewTaskModal(true)} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 transition-all active:scale-95">
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
        
        {/* <div className="mt-auto p-6">
           <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-white">
              <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-2">Pro Tip</p>
              <p className="text-sm leading-relaxed">Drag and drop tasks between dates to re-schedule them automatically.</p>
           </div>
        </div> */}
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
                {headerTitle}
              </h2>
              <div className="flex items-center bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl">
                <button onClick={() => navigatePeriod(-1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-all">
                  <IconChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => navigatePeriod(1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-all">
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
              {(['Month', 'Week', 'Day', 'List'] as CalendarView[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setViewMode(view)}
                  className={clsx(
                    'px-5 py-1.5 text-sm font-bold rounded-lg transition-all',
                    viewMode === view
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-auto flex flex-col p-6 custom-scrollbar">
          {viewMode === 'Month' && (
            <>
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
                        'bg-white dark:bg-[#1a2234] min-h-[120px] p-3 hover:bg-gray-50 dark:hover:bg-[#1f283d] transition-all cursor-pointer group relative',
                        !cell.current && 'opacity-30 grayscale-[0.5]'
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={clsx(
                          'w-8 h-8 flex items-center justify-center text-sm font-black rounded-xl transition-all',
                          isToday
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-110'
                            : 'text-gray-700 dark:text-gray-300 group-hover:text-primary-600'
                        )}>
                          {cell.day}
                        </span>
                        {dayTasks.length > 0 && cell.current && (
                          <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                            <IconCalendar className="w-4 h-4" stroke={2} />
                            <span className={clsx('w-2 h-2 rounded-full animate-pulse', getCalendarDotColor(dayTasks))} />
                          </span>
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
            </>
          )}

          {viewMode === 'Week' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {weekDaysData.map(({ date, tasks: dayTasks }) => (
                <div key={date.toISOString()} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-[#1a2234]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">{date.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{date.toLocaleDateString()}</p>
                    </div>
                    {dayTasks.length > 0 && (
                      <span className={clsx('w-2.5 h-2.5 rounded-full', getCalendarDotColor(dayTasks))} />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{dayTasks.length} task(s)</p>
                  <div className="space-y-2">
                    {dayTasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="text-xs px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                        {task.name}
                      </div>
                    ))}
                    {dayTasks.length > 4 && (
                      <p className="text-[11px] text-gray-400">+{dayTasks.length - 4} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'Day' && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-[#1a2234]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tasks for {currentDate.toLocaleDateString()}</h3>
                <span className="text-sm text-gray-500">{selectedDayTasks.length} task(s)</span>
              </div>
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-gray-500">No tasks for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.name}</p>
                        <p className="text-xs text-gray-500">{task.type} • {task.size}</p>
                      </div>
                      <span className={clsx('w-2.5 h-2.5 rounded-full', getCalendarDotColor([task]))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'List' && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2234] overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">All scheduled and due tasks</h3>
                <span className="text-xs text-gray-500">{listViewTasks.length} entries</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {listViewTasks.length === 0 && (
                  <p className="p-5 text-sm text-gray-500">No dated tasks found.</p>
                )}
                {listViewTasks.map(({ task, date }) => (
                  <div key={task.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.name}</p>
                      <p className="text-xs text-gray-500">{date.toLocaleDateString()} • {task.type} • {task.status}</p>
                    </div>
                    <span className={clsx('w-2.5 h-2.5 rounded-full', getCalendarDotColor([task]))} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    {/* New Task Modal (Calendar) */}
    {showNewTaskModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewTaskModal(false)}>
        <div className="bg-white dark:bg-[#1a2234] rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Task</h3>
            <button onClick={() => setShowNewTaskModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <IconX className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Task Name *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-800/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                <option value="MIXED">Mixed</option>
                <option value="CPU">CPU</option>
                <option value="IO">IO</option>
              </select>
              <select value={newSize} onChange={(e) => setNewSize(e.target.value as any)} className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                <option value="SMALL">Small</option>
                <option value="MEDIUM">Medium</option>
                <option value="LARGE">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Priority</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(p => (
                  <button key={p} type="button" onClick={() => setNewPriority(p)} className={clsx('flex-1 py-2 rounded-lg', newPriority===p? 'bg-primary-600 text-white':'bg-gray-50 dark:bg-gray-800')}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Due Date</label>
              <input type="date" value={newDueDate ?? ''} onChange={(e) => setNewDueDate(e.target.value || null)} className="w-full px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-800/50" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button onClick={handleCreateFromCalendar} disabled={isCreating} className="px-4 py-2 rounded-lg bg-primary-600 text-white">{isCreating? 'Creating…':'Create Task'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
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
