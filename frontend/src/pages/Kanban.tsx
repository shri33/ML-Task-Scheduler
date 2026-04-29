import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { 
  IconPlus, 
  IconSearch,
  IconFilter
} from '@tabler/icons-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { KanbanTask } from '../components/KanbanTask';
import { taskApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Task } from '../types';

const COLUMNS = [
  { id: 'todo', title: 'To Do', status: 'PENDING' },
  { id: 'inprogress', title: 'In Progress', status: 'SCHEDULED' }, // We'll simplify to just SCHEDULED for dragging
  { id: 'done', title: 'Done', status: 'COMPLETED' },
  { id: 'failed', title: 'Failed', status: 'FAILED' },
];

export default function Kanban() {
  const { tasks, fetchTasks, tasksLoading, updateTask } = useStore();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const toast = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const board = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      tasks: tasks.filter(t => {
        if (col.id === 'inprogress') return ['SCHEDULED', 'RUNNING'].includes(t.status);
        return t.status === col.status;
      })
    }));
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine the new status based on where it was dropped
    const targetColumn = COLUMNS.find(c => c.id === overId) || 
                         COLUMNS.find(c => board.find(b => b.id === c.id)?.tasks.some(t => t.id === overId));
    
    if (targetColumn) {
      const newStatus = targetColumn.status as Task['status'];
      const currentTask = tasks.find(t => t.id === taskId);
      
      if (currentTask && currentTask.status !== newStatus) {
        try {
          // Update Optimistically
          const updatedTask = { ...currentTask, status: newStatus };
          updateTask(updatedTask);
          
          // Call API
          await taskApi.update(taskId, { status: newStatus } as any);
          toast.success('Task Updated', `Moved to ${targetColumn.title}`);
        } catch (error) {
          toast.error('Update Failed', 'Could not move task');
          fetchTasks(); // Rollback
        }
      }
    }
    
    setActiveTaskId(null);
  };

  if (tasksLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const activeTask = tasks.find(t => t.id === activeTaskId);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1a2234] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
         <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kanban Board</h2>
         </div>
         <div className="flex items-center gap-3">
            <div className="relative">
               <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input type="text" placeholder="Search tasks..." className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none w-48" />
            </div>
            <button className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-primary-600 transition-colors"><IconFilter className="w-5 h-5" /></button>
            <button className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-500/20">
               <IconPlus className="w-4 h-4" /> New Task
            </button>
         </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar scroll-smooth h-[calc(100vh-280px)]">
           {board.map(column => (
              <div key={column.id} className="w-[320px] shrink-0 flex flex-col h-full group">
                 <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                       <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">{column.title}</h3>
                       <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold text-gray-500">{column.tasks.length}</span>
                    </div>
                 </div>
                 
                 <SortableContext 
                    id={column.id}
                    items={column.tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                 >
                   <div 
                     id={column.id}
                     className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 min-h-[150px] bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl p-2 transition-colors border border-dashed border-transparent hover:border-gray-200 dark:hover:border-gray-800"
                   >
                      {column.tasks.map(task => (
                        <KanbanTask key={task.id} task={task} />
                      ))}
                      <button className="w-full py-3 text-xs font-bold text-gray-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-transparent hover:border-primary-500/20 rounded-2xl">
                         <IconPlus className="w-4 h-4" /> Add Task to {column.title}
                      </button>
                   </div>
                 </SortableContext>
              </div>
           ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <KanbanTask task={activeTask} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
