import { useState, useEffect } from 'react';
import { 
  Camera, 
  Settings, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit,
  Server,
  Cpu,
  Activity,
  X,
  Save,
  Bot
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { clsx } from 'clsx';
import { deviceApi, Device, DeviceStats } from '../lib/api';

const deviceTypeIcons: Record<string, React.ReactNode> = {
  CAMERA: <Camera className="h-7 w-7" />,
  ROBOT_ARM: <Bot className="h-7 w-7" />,
  IOT_SENSOR: <Cpu className="h-7 w-7" />,
  EDGE_SERVER: <Server className="h-7 w-7" />,
  ACTUATOR: <Activity className="h-7 w-7" />,
};

const deviceTypeLabels: Record<string, string> = {
  CAMERA: 'Camera',
  ROBOT_ARM: 'Robot Arm',
  IOT_SENSOR: 'IoT Sensor',
  EDGE_SERVER: 'Edge Server',
  ACTUATOR: 'Actuator',
};

const deviceTypeColors: Record<string, string> = {
  CAMERA: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  ROBOT_ARM: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  IOT_SENSOR: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  EDGE_SERVER: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  ACTUATOR: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
};

const statusColors: Record<string, string> = {
  ONLINE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  OFFLINE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ERROR: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  ONLINE: <Wifi className="h-4 w-4" />,
  OFFLINE: <WifiOff className="h-4 w-4" />,
  MAINTENANCE: <Settings className="h-4 w-4" />,
  ERROR: <AlertTriangle className="h-4 w-4" />,
};

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'IOT_SENSOR' as Device['type'],
    ipAddress: '',
    port: '',
    location: '',
    description: '',
    status: 'OFFLINE' as Device['status'],
  });

  const toast = useToast();

  // Debounce search to avoid firing API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const params: { type?: string; status?: string; search?: string } = {};
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (debouncedSearch) params.search = debouncedSearch;

      const data = await deviceApi.getAll(params);
      setDevices(data);
    } catch (error) {
      toast.error('Error', 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await deviceApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchStats();
  }, [filterType, filterStatus, debouncedSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        ipAddress: formData.ipAddress || undefined,
        port: formData.port ? parseInt(formData.port) : undefined,
        location: formData.location || undefined,
        description: formData.description || undefined,
        ...(editingDevice && { status: formData.status }),
      };

      if (editingDevice) {
        await deviceApi.update(editingDevice.id, payload);
      } else {
        await deviceApi.create(payload);
      }

      toast.success(
        editingDevice ? 'Device updated' : 'Device created',
        `${formData.name} has been ${editingDevice ? 'updated' : 'added'} successfully.`
      );
      setIsModalOpen(false);
      setEditingDevice(null);
      resetForm();
      fetchDevices();
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save device';
      toast.error('Error', message);
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`Are you sure you want to delete "${device.name}"?`)) return;

    try {
      await deviceApi.delete(device.id);
      toast.success('Device deleted', `${device.name} has been removed.`);
      fetchDevices();
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete device';
      toast.error('Error', message);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      ipAddress: device.ipAddress || '',
      port: device.port?.toString() || '',
      location: device.location || '',
      description: device.description || '',
      status: device.status,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'IOT_SENSOR',
      ipAddress: '',
      port: '',
      location: '',
      description: '',
      status: 'OFFLINE',
    });
  };

  const openCreateModal = () => {
    setEditingDevice(null);
    resetForm();
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">IoT Devices</h1>
          <p className="page-subtitle">
            Manage cameras, robot arms, sensors, and edge servers
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Device
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Devices</p>
            <p className="text-3xl font-extrabold font-mono text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 border-l-green-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">Online</p>
            <p className="text-3xl font-extrabold font-mono text-green-600 dark:text-green-400 mt-1">{stats.online}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 border-l-gray-400">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Offline</p>
            <p className="text-3xl font-extrabold font-mono text-gray-600 dark:text-gray-400 mt-1">{stats.offline}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 border-l-yellow-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Maintenance</p>
            <p className="text-3xl font-extrabold font-mono text-yellow-600 dark:text-yellow-400 mt-1">{stats.maintenance}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 border-l-red-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Error</p>
            <p className="text-3xl font-extrabold font-mono text-red-600 dark:text-red-400 mt-1">{stats.error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search devices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">All Types</option>
          {Object.entries(deviceTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="ERROR">Error</option>
        </select>
        <button
          onClick={() => { fetchDevices(); fetchStats(); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Device Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No devices found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Get started by adding your first device.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Add Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className={clsx(
                'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-gray-700',
                device.status === 'ONLINE' && 'status-strip-online',
                device.status === 'OFFLINE' && 'status-strip-offline',
                device.status === 'ERROR' && 'status-strip-error',
                device.status === 'MAINTENANCE' && 'status-strip-maintenance',
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-3 rounded-xl',
                    deviceTypeColors[device.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                    {deviceTypeIcons[device.type]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{device.name}</h3>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{deviceTypeLabels[device.type]}</p>
                  </div>
                </div>
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                  statusColors[device.status]
                )}>
                  {device.status === 'ONLINE' ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  ) : (
                    statusIcons[device.status]
                  )}
                  {device.status}
                </span>
              </div>

              {device.ipAddress && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">IP:</span> {device.ipAddress}{device.port && `:${device.port}`}
                </p>
              )}
              {device.location && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">Location:</span> {device.location}
                </p>
              )}
              {device.lastHeartbeat && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last seen: {new Date(device.lastHeartbeat).toLocaleString()}
                </p>
              )}

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleEdit(device)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(device)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingDevice ? 'Edit Device' : 'Add New Device'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Main Camera, Robot Arm #1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Device['type'] })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  {Object.entries(deviceTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {editingDevice && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Device['status'] })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="ERROR">Error</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IP Address
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="8080"
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Factory Floor A, Lab Room 101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Device description..."
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {editingDevice ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
