import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { resourceApi } from '../lib/api';
import { CreateResourceInput, Resource } from '../types';
import { Plus, RefreshCw, Server, X, MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge } from '../components/shared/Badges';
import ResourceEditModal from '../components/ResourceEditModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

type SortField = 'name' | 'load' | 'capacity' | 'status';
type SortDir = 'asc' | 'desc';

export default function Resources() {
  const {
    resources,
    resourcesLoading,
    fetchResources,
    addResource,
    removeResource,
    updateResource,
  } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchResources();
    setRefreshing(false);
    toast.info('Refreshed', 'Resource data has been updated.');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredResources = useMemo(() => {
    const result = resources
      .filter((r) => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((r) => !statusFilter || r.status === statusFilter);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'load':
          cmp = a.currentLoad - b.currentLoad;
          break;
        case 'capacity':
          cmp = a.capacity - b.capacity;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [resources, searchQuery, statusFilter, sortField, sortDir]);

  const handleCreateResource = async (data: CreateResourceInput) => {
    try {
      const resource = await resourceApi.create(data);
      addResource(resource);
      setShowForm(false);
      toast.success('Resource created', `"${resource.name}" has been added.`);
    } catch (error) {
      toast.error('Failed to create resource', 'Please try again.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await resourceApi.delete(deleteTarget.id);
      removeResource(deleteTarget.id);
      toast.success('Resource deleted', `"${deleteTarget.name}" has been removed.`);
    } catch (error) {
      toast.error('Failed to delete resource', 'Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleResourceUpdated = (updated: Resource) => {
    updateResource(updated);
    setEditingResource(null);
  };

  const sortOptions: { label: string; value: SortField }[] = [
    { label: 'Name', value: 'name' },
    { label: 'Load', value: 'load' },
    { label: 'Capacity', value: 'capacity' },
    { label: 'Status', value: 'status' },
  ];

  // Summary stats
  const totalResources = resources.length;
  const availableCount = resources.filter((r) => r.status === 'AVAILABLE').length;
  const busyCount = resources.filter((r) => r.status === 'BUSY').length;
  const offlineCount = resources.filter((r) => r.status === 'OFFLINE').length;
  const avgLoad = totalResources > 0
    ? Math.round(resources.reduce((sum, r) => sum + r.currentLoad, 0) / totalResources)
    : 0;

  return (
    <main>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-4 xl:gap-6">
        {/* Left Panel - Resources Grid */}
        <div className="bg-gray-200 dark:bg-black/30 p-7 min-h-full w-full">
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Resources
                </h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Manage computing resources for task allocation
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", refreshing && "animate-spin")}
                  />
                  Refresh
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Resource
                </button>
              </div>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{totalResources}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">Total</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-100 dark:border-green-900/30 p-4 text-center shadow-sm border-l-4 border-l-green-500">
                <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{availableCount}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">Available</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-100 dark:border-amber-900/30 p-4 text-center shadow-sm border-l-4 border-l-amber-500">
                <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{busyCount}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">Busy</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center shadow-sm border-l-4 border-l-gray-400">
                <p className="text-2xl font-bold font-mono text-gray-600 dark:text-gray-400">{offlineCount}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">Offline</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-primary-100 dark:border-primary-900/30 p-4 text-center shadow-sm col-span-2 sm:col-span-1 border-l-4 border-l-primary-500">
                <p className="text-2xl font-bold font-mono text-primary-600 dark:text-primary-400">{avgLoad}%</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">Avg Load</p>
              </div>
            </div>

            {/* Resource Grid */}
            {resourcesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 animate-pulse">
                    <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Server className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No resources found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || statusFilter ? 'Try a different search term or filter.' : 'Add one to get started.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            'p-2.5 rounded-lg',
                            resource.status === 'AVAILABLE'
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : resource.status === 'BUSY'
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : 'bg-gray-100 dark:bg-gray-700'
                          )}
                        >
                          <Server
                            className={clsx(
                              'h-5 w-5',
                              resource.status === 'AVAILABLE'
                                ? 'text-green-600 dark:text-green-400'
                                : resource.status === 'BUSY'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-600 dark:text-gray-400'
                            )}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {resource.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <StatusBadge status={resource.status} />
                          </p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Load Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Current Load</span>
                        <span
                          className={clsx(
                            'text-xs font-bold font-mono',
                            resource.currentLoad < 50
                              ? 'text-green-600 dark:text-green-400'
                              : resource.currentLoad < 80
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {Math.round(resource.currentLoad)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={clsx(
                            'h-2.5 rounded-full transition-all duration-500',
                            resource.currentLoad < 50
                              ? 'bg-green-500'
                              : resource.currentLoad < 80
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          )}
                          style={{ width: `${resource.currentLoad}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Footer */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{resource.capacity}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Capacity</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{resource._count?.tasks || 0}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Active Tasks</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Sidebar */}
        <div className="p-4 sm:p-5 w-full">
          {/* Filters Section */}
          <section className="space-y-4 mb-6">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
              Filters
            </h3>
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-slate-400 dark:text-slate-300 block">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100 outline-none border border-transparent focus:border-indigo-300"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="BUSY">Busy</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-slate-400 dark:text-slate-300 block">
                Search Resources
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100 outline-none border border-transparent focus:border-indigo-300"
              />
            </div>
          </section>

          {/* Sort Section */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-3">
            <h4 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-100">
              Sort By
            </h4>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleSort(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    sortField === opt.value
                      ? 'bg-indigo-100 dark:bg-black/30 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {opt.label}
                  {sortField === opt.value && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </section>

          {/* Quick Insights */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-5 mt-5 space-y-3">
            <h4 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-100">
              Quick Insights
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Health</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {resources.length > 0
                    ? Math.round((availableCount / resources.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Capacity</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {resources.reduce((sum, r) => sum + r.capacity, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Utilization</span>
                <span className="font-semibold text-gray-900 dark:text-white">{avgLoad}%</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Create Resource Modal */}
      {showForm && (
        <ResourceFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateResource}
        />
      )}

      {/* Edit Resource Modal */}
      {editingResource && (
        <ResourceEditModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onUpdated={handleResourceUpdated}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Resource"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All tasks assigned to this resource will be unassigned.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function ResourceFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CreateResourceInput) => void;
}) {
  const [formData, setFormData] = useState<CreateResourceInput>({
    name: '',
    capacity: 10,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Resource</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Resource Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Server-A"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="label">Capacity</label>
            <input
              type="number"
              className="input"
              min="1"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: parseInt(e.target.value) })
              }
              required
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Maximum number of tasks this resource can handle
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              Add Resource
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
