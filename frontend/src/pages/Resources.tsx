import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { resourceApi } from '../lib/api';
import { CreateResourceInput, Resource } from '../types';
import { IconPlus, IconRefresh, IconServer, IconX, IconDotsVertical } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';
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
  const [sortDir] = useState<SortDir>('asc');
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

  const avgLoad = totalResources > 0
    ? Math.round(resources.reduce((sum, r) => sum + r.currentLoad, 0) / totalResources)
    : 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in-up">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            Resource Inventory
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-widest rounded-full">System Nodes</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Global compute capacity and real-time load distribution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 px-4 h-11"
          >
            <IconRefresh className={clsx("h-4 w-4", refreshing && "animate-spin")} />
            Refresh Data
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2 px-6 h-11 shadow-lg shadow-primary-500/20"
          >
            <IconPlus className="h-4 w-4" />
            Add New Node
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Content - Stats & Grid */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Nodes" value={totalResources} icon={IconServer} color="text-gray-600" />
            <StatCard label="Available" value={availableCount} icon={IconServer} color="text-emerald-600" active />
            <StatCard label="Busy" value={busyCount} icon={IconServer} color="text-amber-600" />
            <StatCard label="Avg Load" value={`${avgLoad}%`} icon={IconServer} color="text-primary-600" />
          </div>

          {/* Resource Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">Active Computing Nodes</h3>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sort:</span>
                 <select 
                    className="bg-transparent border-none text-[10px] font-black text-primary-600 uppercase tracking-widest focus:ring-0 cursor-pointer"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as any)}
                 >
                    {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                 </select>
              </div>
            </div>

            {resourcesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800/50 animate-pulse rounded-2xl" />)}
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-16 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <IconServer className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No nodes matching your query</h3>
                <p className="text-gray-500 max-w-xs mx-auto">Adjust your filters or add a new computing node to the cluster.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="group bg-white dark:bg-[#1a2234] rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-primary-500/30 transition-all duration-300 relative overflow-hidden"
                  >
                    {/* Status Strip */}
                    <div className={clsx(
                      "absolute top-0 left-0 bottom-0 w-1.5 transition-colors",
                      resource.status === 'AVAILABLE' ? "bg-emerald-500" : resource.status === 'BUSY' ? "bg-amber-500" : "bg-gray-400"
                    )} />

                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                          resource.status === 'AVAILABLE' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-gray-50 dark:bg-gray-800 text-gray-500"
                        )}>
                          <IconServer className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {resource.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className={clsx("w-2 h-2 rounded-full", resource.status === 'AVAILABLE' ? "bg-emerald-500" : "bg-amber-500")} />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{resource.status}</span>
                          </div>
                        </div>
                      </div>
                      <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <IconDotsVertical className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resource Load</span>
                          <span className="text-[10px] font-black text-gray-900 dark:text-white">{Math.round(resource.currentLoad)}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all duration-700 ease-out",
                              resource.currentLoad < 60 ? "bg-emerald-500" : resource.currentLoad < 85 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${resource.currentLoad}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                        <div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Capacity</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{resource.capacity} Units</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Tasks</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{resource._count?.tasks || 0} Queued</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Filters & Insights */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Cluster Management</h3>
             
             <div className="space-y-5">
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Search Registry</label>
                   <input 
                      type="text" 
                      placeholder="Node name or ID..."
                      className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm focus:border-primary-500 outline-none transition-all"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>

                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Operational Status</label>
                   <div className="flex flex-col gap-2">
                      {['', 'AVAILABLE', 'BUSY', 'OFFLINE'].map(status => (
                         <button 
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={clsx(
                               "flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                               statusFilter === status 
                               ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" 
                               : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                         >
                            {status || 'All Nodes'}
                            {statusFilter === status && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                         </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
             <h3 className="text-sm font-black uppercase tracking-widest mb-4">Cluster Health</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-xs text-primary-100">Uptime Score</span>
                   <span className="text-lg font-bold">98.4%</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs text-primary-100">Total Throughput</span>
                   <span className="text-lg font-bold">{resources.reduce((s, r) => s + (r._count?.tasks || 0), 0)}/s</span>
                </div>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden mt-2">
                   <div className="h-full bg-white w-4/5" />
                </div>
                <p className="text-[10px] text-primary-200 mt-2 leading-relaxed">
                   Current utilization is within optimal bounds. No critical resource pressure detected.
                </p>
             </div>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      {showForm && (
        <ResourceFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateResource}
        />
      )}

      {editingResource && (
        <ResourceEditModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onUpdated={handleResourceUpdated}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove Compute Node"
        message={`Warning: Removing "${deleteTarget?.name}" will re-route all active tasks to the global queue. Proceed?`}
        confirmLabel="Decommission"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, active }: any) {
  return (
    <div className={clsx(
      "bg-white dark:bg-[#1a2234] rounded-2xl p-5 border shadow-sm transition-all duration-300",
      active ? "border-primary-500/50 shadow-md scale-[1.02]" : "border-gray-100 dark:border-gray-800"
    )}>
      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center mb-3", color.replace('text-', 'bg-').replace('600', '50'))}>
        <Icon className={clsx("w-4 h-4", color)} />
      </div>
      <div className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{label}</div>
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
            <IconX className="h-5 w-5 text-gray-500" />
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
