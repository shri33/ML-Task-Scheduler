import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { taskApi } from '../lib/api';
import { CreateTaskInput, Task } from '../types';
import { Plus, Trash2, Play, CheckCircle, X, Edit2, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
import { SearchFilter, QuickFilters } from '../components/SearchFilter';
import { TasksTableSkeleton } from '../components/Skeletons';
import TaskEditModal from '../components/TaskEditModal';
import CSVExport from '../components/CSVExport';
import { TypeBadge, PriorityBadge, StatusBadge, DueDateBadge } from '../components/shared/Badges';

export default function Tasks() {
  const { tasks, tasksLoading, fetchTasks, addTask, updateTask, removeTask, runScheduler } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredTasks = tasks
    .filter((t) => !filter || t.status === filter)
    .filter((t) => 
      !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleCreateTask = async (data: CreateTaskInput) => {
    try {
      const task = await taskApi.create(data);
      addTask(task);
      setShowForm(false);
      toast.success('Task created', `"${task.name}" has been created successfully.`);
    } catch (error) {
      toast.error('Failed to create task', 'Please try again.');
      throw error; // Re-throw to let the modal know submission failed
    }
  };

  const handleDeleteTask = async (id: string, name: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskApi.delete(id);
      removeTask(id);
      toast.success('Task deleted', `"${name}" has been deleted.`);
    } catch (error) {
      toast.error('Failed to delete task', 'Please try again.');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    const actualTime = prompt('Enter actual execution time (seconds):', '5');
    if (!actualTime) return;
    try {
      await taskApi.complete(task.id, parseFloat(actualTime));
      fetchTasks();
      toast.success('Task completed', `"${task.name}" marked as completed.`);
    } catch (error) {
      toast.error('Failed to complete task', 'Please try again.');
    }
  };

  const handleScheduleTask = async (taskId: string, taskName: string) => {
    try {
      await runScheduler([taskId]);
      toast.success('Task scheduled', `"${taskName}" has been scheduled.`);
    } catch (error) {
      toast.error('Scheduling failed', 'Could not schedule the task.');
    }
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    updateTask(updatedTask);
    setEditingTask(null);
  };

  const filterOptions = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage and schedule tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <CSVExport />
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <SearchFilter
          placeholder="Search tasks by name or type..."
          onSearch={handleSearch}
        />
        <QuickFilters
          options={filterOptions}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Task List */}
      <div className="card">
        {tasksLoading ? (
          <TasksTableSkeleton />
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tasks found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery ? 'Try a different search term.' : 'Create one to get started.'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowForm(true)} className="btn btn-primary">
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400 hidden xl:table-cell">
                    Predicted
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{task.name}</p>
                        {task.resource && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            → {task.resource.name}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 sm:hidden mt-1">
                          {task.type} • {task.size}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <TypeBadge type={task.type} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">{task.size}</td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <DueDateBadge dueDate={task.dueDate} status={task.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                      {task.predictedTime ? `${task.predictedTime}s` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {task.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleScheduleTask(task.id, task.name)}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400"
                              title="Schedule"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingTask(task)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.name)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {task.status === 'RUNNING' && (
                          <button
                            onClick={() => handleCompleteTask(task)}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400"
                            title="Mark Complete"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <TaskFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}

function TaskFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => void;
}) {
  const [formData, setFormData] = useState<CreateTaskInput>({
    name: '',
    type: 'CPU',
    size: 'MEDIUM',
    priority: 3,
    dueDate: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Task</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Task Name</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter task name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select
                className="select"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'CPU' | 'IO' | 'MIXED',
                  })
                }
              >
                <option value="CPU">CPU</option>
                <option value="IO">IO</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="label">Size</label>
              <select
                className="select"
                value={formData.size}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    size: e.target.value as 'SMALL' | 'MEDIUM' | 'LARGE',
                  })
                }
              >
                <option value="SMALL">Small</option>
                <option value="MEDIUM">Medium</option>
                <option value="LARGE">Large</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due Date (Optional)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={formData.dueDate ? new Date(formData.dueDate).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Priority (1-5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p })}
                  className={clsx(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    formData.priority === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
