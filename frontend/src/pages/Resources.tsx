import { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { resourceApi } from '../lib/api';
import { CreateResourceInput, Resource } from '../types';
import { Plus, Trash2, X, Server, Edit2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
import { SearchFilter, QuickFilters } from '../components/SearchFilter';
import { ResourceCardSkeleton } from '../components/Skeletons';
import { StatusBadge } from '../components/shared/Badges';
import ResourceEditModal from '../components/ResourceEditModal';
import CSVExport from '../components/CSVExport';
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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

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

  const handleDeleteResource = async (id: string, name: string) => {
    setDeleteTarget({ id, name });
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

  const filterOptions = [
    { label: 'All', value: '' },
    { label: 'Available', value: 'AVAILABLE' },
    { label: 'Busy', value: 'BUSY' },
    { label: 'Offline', value: 'OFFLINE' },
  ];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resources</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage computing resources for task allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <CSVExport />
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Resource
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalResources}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{availableCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{busyCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Busy</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{offlineCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Offline</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{avgLoad}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Load</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <SearchFilter
          placeholder="Search resources by name..."
          onSearch={handleSearch}
        />
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <QuickFilters
            options={filterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleSort(opt.value)}
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  sortField === opt.value
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
                {sortField === opt.value && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resource Grid */}
      {resourcesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Server className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No resources found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || statusFilter ? 'Try a different search term or filter.' : 'Add one to get started.'}
          </p>
          {!searchQuery && !statusFilter && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              Add Resource
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((resource) => (
            <div key={resource.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'p-2 rounded-lg',
                      resource.status === 'AVAILABLE'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : resource.status === 'BUSY'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {resource.name}
                    </h3>
                    <StatusBadge status={resource.status} />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingResource(resource)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteResource(resource.id, resource.name)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Load Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Current Load</span>
                  <span
                    className={clsx(
                      'text-sm font-medium',
                      resource.currentLoad < 50
                        ? 'text-green-600 dark:text-green-400'
                        : resource.currentLoad < 80
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {Math.round(resource.currentLoad)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={clsx(
                      'h-3 rounded-full transition-all',
                      resource.currentLoad < 50
                        ? 'bg-green-500'
                        : resource.currentLoad < 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${resource.currentLoad}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {resource.capacity}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Capacity</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {resource._count?.tasks || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active Tasks</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
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
