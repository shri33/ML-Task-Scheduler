import { useEffect, useState, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../store';
import { taskApi } from '../lib/api';
import { CreateTaskInput, Task } from '../types';
import { Plus, Trash2, Play, CheckCircle, X, Edit, Search, Filter, Download, ChevronLeft, ChevronRight, Clock, Laptop, Calendar, AlignLeft } from 'lucide-react';
import { IconBrandGoogle } from '../components/shared/BrandIcons';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
import { TasksTableSkeleton } from '../components/Skeletons';
import TaskEditModal from '../components/TaskEditModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

// ─── Google Calendar helpers ────────────────────────────────────────────────

const GAPI_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GAPI_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

interface GCalEvent {
  id: string;
  summary: string;
  start: { date?: string; dateTime?: string };
}

async function fetchUpcomingEvents(token: string): Promise<GCalEvent[]> {
  const now = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google Calendar events');
  const data = await res.json();
  return data.items as GCalEvent[];
}

function eventDate(ev: GCalEvent): string {
  return (ev.start.date ?? ev.start.dateTime ?? '').slice(0, 10);
}

function toApiDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  if (dueDate.length > 10) return dueDate;
  return new Date(`${dueDate}T12:00:00`).toISOString();
}

// ─── TaskFormModal ───────────────────────────────────────────────────────────

interface TaskFormModalProps {
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
}

function TaskFormModal({ onClose, onSubmit }: TaskFormModalProps) {
  const [formData, setFormData] = useState<CreateTaskInput>({
    name: '',
    type: 'CPU',
    size: 'MEDIUM',
    priority: 3,
    dueDate: null,
  });
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Calendar state
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalError, setGcalError] = useState('');
  const [showGcalPicker, setShowGcalPicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGcalPick = useCallback(() => {
    if (!GAPI_CLIENT_ID) {
      // Fallback: open Google Calendar in a new tab
      window.open('https://calendar.google.com', '_blank');
      return;
    }
    setGcalError('');
    setGcalLoading(true);

    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GAPI_CLIENT_ID,
      scope: GAPI_SCOPES,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setGcalError('Google sign-in failed. Please try again.');
          setGcalLoading(false);
          return;
        }
        try {
          const events = await fetchUpcomingEvents(resp.access_token);
          setGcalEvents(events);
          setShowGcalPicker(true);
        } catch {
          setGcalError('Could not load events. Check your Google Calendar access.');
        } finally {
          setGcalLoading(false);
        }
      },
    });
    client.requestAccessToken();
  }, []);

  const selectGcalEvent = (ev: GCalEvent) => {
    setFormData((prev) => ({ ...prev, dueDate: eventDate(ev) }));
    setShowGcalPicker(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a2234] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Task</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              Task Name *
            </label>
            <input
              autoFocus
              required
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
              placeholder="e.g. Image Processing Pipeline"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase mb-1.5">
              <AlignLeft className="w-3.5 h-3.5" /> Description
            </label>
            <textarea
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all resize-none"
              placeholder="Brief description of the task…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Type + Size */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Type</label>
              <select
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="CPU">CPU Bound</option>
                <option value="IO">IO Bound</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Size</label>
              <select
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value as any })}
              >
                <option value="SMALL">Small</option>
                <option value="MEDIUM">Medium</option>
                <option value="LARGE">Large</option>
              </select>
            </div>
          </div>

          {/* NOTE: Removed Assignee and Initial Status fields per UX request */}

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              Priority
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p })}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-bold transition-all border',
                    formData.priority === p
                      ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase mb-1.5">
              <Calendar className="w-3.5 h-3.5" /> Due Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                value={formData.dueDate ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value || null })
                }
              />
              <button
                type="button"
                onClick={handleGcalPick}
                disabled={gcalLoading}
                title="Pick from Google Calendar"
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
                  'hover:border-primary-500 hover:text-primary-600',
                  gcalLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {gcalLoading ? (
                  <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <IconBrandGoogle className="w-4 h-4 text-[#4285F4]" />
                )}
                <span className="hidden sm:inline text-gray-600 dark:text-gray-300">
                  {gcalLoading ? 'Loading…' : 'Calendar'}
                </span>
              </button>
            </div>

            {gcalError && (
              <p className="mt-1.5 text-xs text-rose-500">{gcalError}</p>
            )}

            {/* Google Calendar event picker */}
            {showGcalPicker && (
              <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    Upcoming Events
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGcalPicker(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {gcalEvents.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">
                    No upcoming events found.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                    {gcalEvents.map((ev) => (
                      <li key={ev.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          onClick={() => selectGcalEvent(ev)}
                        >
                          <p className="text-sm font-medium text-gray-800 dark:text-white">
                            {ev.summary ?? '(No title)'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{eventDate(ev)}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Fallback hint when no client ID configured */}
            {!GAPI_CLIENT_ID && (
              <p className="mt-1.5 text-[11px] text-gray-400">
                Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in your{' '}
                <code className="font-mono">.env</code> to enable Google Calendar OAuth.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-shiny group flex-1 rounded-xl shadow-lg shadow-primary-500/20"
            >
              <div className="btn-inner flex items-center justify-center gap-2">
                {isSubmitting ? 'Creating…' : 'Create Task'}
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Tasks page ─────────────────────────────────────────────────────────

export default function Tasks() {
  const { tasks, tasksLoading, fetchTasks, addTask, updateTask, removeTask, runScheduler } =
    useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [actualTime, setActualTime] = useState('5');
  const [isCompleting, setIsCompleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => fetchTasks(), 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((t) => !filter || t.status === filter)
        .filter((t) => !typeFilter || t.type === typeFilter)
        .filter(
          (t) =>
            !searchQuery ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.type.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    [tasks, filter, typeFilter, searchQuery]
  );

  const totalEntries = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter, typeFilter, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return filteredTasks.slice(start, start + entriesPerPage);
  }, [filteredTasks, currentPage, entriesPerPage]);

  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1;
  const endEntry = totalEntries === 0 ? 0 : Math.min(currentPage * entriesPerPage, totalEntries);

  const paginationPages = useMemo(() => {
    const maxVisible = 5;
    const pages: number[] = [];

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, totalPages]);

  const handleCreateTask = async (data: CreateTaskInput) => {
    try {
      const task = await taskApi.create({
        ...data,
        dueDate: toApiDueDate(data.dueDate),
      });
      addTask(task);
      setShowForm(false);
      toast.success('Task created', `"${task.name}" has been created successfully.`);
    } catch (err) {
      console.error('Task creation failed:', err);
      const anyErr = err as any;
      const status = anyErr?.response?.status;
      const serverMsg = anyErr?.response?.data?.message || anyErr?.message || String(anyErr);

      // If unauthenticated or backend unavailable, create a local task fallback
      if (status === 401 || !anyErr?.response) {
        const localTask: Task = {
          id: `local-${Date.now()}`,
          name: data.name,
          type: data.type,
          size: data.size,
          priority: data.priority,
          status: 'PENDING',
          dueDate: data.dueDate ?? null,
          predictedTime: null,
          actualTime: null,
          resourceId: null,
          resource: undefined,
          createdAt: new Date().toISOString(),
          scheduledAt: null,
          completedAt: null,
          updatedAt: new Date().toISOString(),
        } as Task;
        addTask(localTask);
        setShowForm(false);
        toast.info('Task Added Locally', 'You are offline or unauthenticated — task saved locally.');
      } else if (serverMsg) {
        toast.error('Creation Failed', serverMsg);
      } else {
        toast.error('Creation Failed', 'Could not create the task. Please check your backend connection.');
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await taskApi.delete(deleteTarget.id);
      removeTask(deleteTarget.id);
      toast.success('Task deleted', `"${deleteTarget.name}" has been deleted.`);
    } catch {
      toast.error('Failed to delete task', 'Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const confirmComplete = async () => {
    if (!completeTarget) return;
    const time = parseFloat(actualTime);
    if (isNaN(time) || time <= 0) {
      toast.warning('Invalid time', 'Please enter a positive number.');
      return;
    }
    setIsCompleting(true);
    try {
      await taskApi.complete(completeTarget.id, time);
      fetchTasks();
      toast.success('Task completed', `"${completeTarget.name}" marked as completed.`);
    } catch {
      toast.error('Failed to complete task', 'Please try again.');
    } finally {
      setIsCompleting(false);
      setCompleteTarget(null);
    }
  };

    const handleExportPDF = () => {
      if (filteredTasks.length === 0) {
        toast.warning('No tasks to export', 'Apply different filters or create tasks first.');
        return;
      }

      try {
        const doc = new jsPDF();
        const margin = 15;

        // Title
        doc.setFontSize(20);
        doc.text('Tasks Export Report', margin, margin + 10);

        // Metadata
        doc.setFontSize(10);
        const now = new Date().toLocaleString();
        doc.text(`Generated: ${now}`, margin, margin + 22);
        doc.text(`Total Records: ${filteredTasks.length}`, margin, margin + 28);

        // Filter criteria
        const filterInfo = [];
        if (searchQuery) filterInfo.push(`Search: "${searchQuery}"`);
        if (filter) filterInfo.push(`Status: ${filter}`);
        if (typeFilter) filterInfo.push(`Type: ${typeFilter}`);
        if (filterInfo.length > 0) {
          doc.text(`Filters Applied: ${filterInfo.join(' | ')}`, margin, margin + 34);
        }

        // Table data
        const tableData = filteredTasks.map(task => [
          task.name,
          task.type,
          task.size,
          task.priority.toString(),
          task.status,
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—',
        ]);

        autoTable(doc, {
          head: [['Task Name', 'Type', 'Size', 'Priority', 'Status', 'Due Date']],
          body: tableData,
          startY: margin + 40,
          margin: margin,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
        });

        doc.save(`tasks_export_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success('Export successful', `${filteredTasks.length} tasks exported to PDF.`);
      } catch (err) {
        console.error('PDF export failed:', err);
        toast.error('Export failed', 'Could not generate PDF.');
      }
    };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks List</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and manage system tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportPDF} className="btn btn-secondary flex items-center gap-2 bg-white dark:bg-[#1a2234] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" />
            Export ({filteredTasks.length})
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-shiny group rounded-xl shadow-lg shadow-emerald-500/20"
          >
            <div className="btn-inner flex items-center gap-2 px-4">
              <Plus className="w-4 h-4" />
              <span>Add New Task</span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Task..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Select Status</option>
              <option value="PENDING">Pending</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Laptop className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Select Type</option>
              <option value="CPU">CPU Bound</option>
              <option value="IO">IO Bound</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Table Actions Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Show</span>
            <select
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm px-2 py-1 outline-none"
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-500">entries</span>
          </div>
          
        </div>

        <div className="overflow-x-auto">
          {tasksLoading ? (
            <div className="p-10">
              <TasksTableSkeleton />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                No Tasks Found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your filters or create a new task.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-4">Task Name</th>
                  <th className="px-6 py-4">Type / Size</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Assignee</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginatedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {task.name}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                          {task.id.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                          {task.type}
                        </span>
                        <span className="text-[11px] text-gray-400">{task.size}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <PriorityDot priority={task.priority} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusChip status={task.status} />
                    </td>
                    <td className="px-6 py-4">
                      {task.resource ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            {task.resource.name.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {task.resource.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : 'No date'}
                      </div>
                    </td>
                    {/* Description column */}
                    <td className="px-6 py-4 max-w-[160px]">
                      <span
                        className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2"
                        title={(task as any).description ?? ''}
                      >
                        {(task as any).description || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {task.status === 'PENDING' && (
                          <>
                            <ActionButton
                              onClick={() => runScheduler([task.id])}
                              icon={Play}
                              color="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                              title="Run"
                            />
                            <ActionButton
                              onClick={() => setEditingTask(task)}
                              icon={Edit}
                              color="text-amber-600 bg-amber-50 dark:bg-amber-900/30"
                              title="Edit"
                            />
                            <ActionButton
                              onClick={() =>
                                setDeleteTarget({ id: task.id, name: task.name })
                              }
                              icon={Trash2}
                              color="text-red-600 bg-red-50 dark:bg-red-900/30"
                              title="Delete"
                            />
                          </>
                        )}
                        {task.status === 'RUNNING' && (
                          <ActionButton
                            onClick={() => setCompleteTarget(task)}
                            icon={CheckCircle}
                            color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30"
                            title="Complete"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-sm text-gray-500">
            Showing {startEntry} to {endEntry} of {totalEntries} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 disabled:opacity-30"
              disabled={currentPage === 1 || totalEntries === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {paginationPages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={clsx(
                  'w-9 h-9 rounded-lg font-semibold text-sm transition-colors',
                  currentPage === page
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 disabled:opacity-30"
              disabled={currentPage === totalPages || totalEntries === 0}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <TaskFormModal onClose={() => setShowForm(false)} onSubmit={handleCreateTask} />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onUpdated={(updated) => updateTask(updated)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!completeTarget}
        title="Complete Task"
        message={`Mark "${completeTarget?.name}" as completed.`}
        confirmLabel="Complete"
        variant="info"
        isLoading={isCompleting}
        onConfirm={confirmComplete}
        onCancel={() => setCompleteTarget(null)}
      >
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
            Execution Time (sec)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500"
            value={actualTime}
            onChange={(e) => setActualTime(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    RUNNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };
  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider',
        styles[status] ?? styles.PENDING
      )}
    >
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const colors = [
    'bg-gray-300',
    'bg-emerald-500',
    'bg-sky-500',
    'bg-amber-500',
    'bg-orange-500',
    'bg-rose-500',
  ];
  const labels = ['None', 'Very Low', 'Low', 'Medium', 'High', 'Critical'];
  return (
    <div className="flex items-center gap-2">
      <div className={clsx('w-2 h-2 rounded-full', colors[priority] ?? 'bg-gray-300')} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {labels[priority] ?? 'Unknown'}
      </span>
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  color,
  title,
}: {
  onClick: () => void;
  icon: React.ElementType;
  color: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx('p-2 rounded-lg transition-all hover:shadow-sm active:scale-95', color)}
    >
      <Icon className="w-4 h-4" strokeWidth={1.5} />
    </button>
  );
}