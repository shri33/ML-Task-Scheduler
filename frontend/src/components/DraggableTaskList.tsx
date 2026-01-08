import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../types';
import { GripVertical, Play, Edit2, Trash2, CheckCircle, Calendar, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface DraggableTaskListProps {
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
  onSchedule: (taskId: string, taskName: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string, taskName: string) => void;
  onComplete: (task: Task) => void;
}

function SortableTaskRow({
  task,
  onSchedule,
  onEdit,
  onDelete,
  onComplete,
}: {
  task: Task;
  onSchedule: (taskId: string, taskName: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string, taskName: string) => void;
  onComplete: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={clsx(
        'border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50',
        isDragging && 'bg-primary-50 dark:bg-primary-900/20'
      )}
    >
      <td className="py-3 px-2 w-8">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </td>
      <td className="py-3 px-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{task.name}</p>
          {task.resource && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              → {task.resource.name}
            </p>
          )}
        </div>
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <TypeBadge type={task.type} />
      </td>
      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">
        {task.size}
      </td>
      <td className="py-3 px-4">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={task.status} />
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <DueDateBadge dueDate={task.dueDate} status={task.status} />
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1">
          {task.status === 'PENDING' && (
            <>
              <button
                onClick={() => onSchedule(task.id, task.name)}
                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400"
                title="Schedule"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(task.id, task.name)}
                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          {task.status === 'RUNNING' && (
            <button
              onClick={() => onComplete(task)}
              className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400"
              title="Mark Complete"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function DraggableTaskList({
  tasks,
  onReorder,
  onSchedule,
  onEdit,
  onDelete,
  onComplete,
}: DraggableTaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const newTasks = arrayMove(tasks, oldIndex, newIndex);
      onReorder(newTasks);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="w-8"></th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                Type
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                Size
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                Priority
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                Due Date
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  onSchedule={onSchedule}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onComplete={onComplete}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}

// Helper Components
function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    CPU: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    IO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    MIXED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  };
  return (
    <span className={clsx('px-2 py-1 rounded text-xs font-medium', colors[type])}>
      {type}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    2: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
    3: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300',
    4: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300',
    5: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',
  };
  return (
    <span className={clsx('px-2 py-1 rounded text-xs font-medium', colors[priority])}>
      P{priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    SCHEDULED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    RUNNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  return (
    <span className={clsx('px-2 py-1 rounded text-xs font-medium', colors[status])}>
      {status}
    </span>
  );
}

function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: string }) {
  if (!dueDate) {
    return <span className="text-gray-400 dark:text-gray-500">-</span>;
  }

  const now = new Date();
  const due = new Date(dueDate);
  const isOverdue = due < now && status !== 'COMPLETED';
  const isNearDue = !isOverdue && due.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && status !== 'COMPLETED';

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isOverdue) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="font-medium">Overdue</span>
      </span>
    );
  }

  if (isNearDue) {
    return (
      <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-sm">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDate(due)}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm">
      <Calendar className="h-3.5 w-3.5" />
      <span>{formatDate(due)}</span>
    </span>
  );
}
