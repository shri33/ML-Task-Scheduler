import { useState, useEffect } from 'react';
import { IconCamera, IconSettings, IconWifi, IconPlus, IconRefresh, IconTrash, IconEdit, IconServer, IconCpu, IconActivity, IconX, IconRobot, IconSearch } from '@tabler/icons-react';
import { useToast } from '../contexts/ToastContext';
import { clsx } from 'clsx';
import { deviceApi, Device, DeviceStats } from '../lib/api';

const deviceTypeIcons: Record<string, React.ReactNode> = {
  CAMERA: <IconCamera className="h-7 w-7" />,
  ROBOT_ARM: <IconRobot className="h-7 w-7" />,
  IOT_SENSOR: <IconCpu className="h-7 w-7" />,
  EDGE_SERVER: <IconServer className="h-7 w-7" />,
  ACTUATOR: <IconActivity className="h-7 w-7" />,
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
  EDGE_SERVER: 'bg-indigo-100 dark:bg-black/30 text-indigo-600 dark:text-indigo-400',
  ACTUATOR: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
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
      if (Array.isArray(data)) {
        setDevices(data);
      }
    } catch (error) {
      toast.error('Error', 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await deviceApi.getStats();
      if (data && typeof data === 'object') {
        setStats(data);
      }
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
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in-up">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            Edge Intelligence
            <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-full">Terminal Devices</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Managing terminal nodes and sensory peripherals across the fog layer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchDevices(); fetchStats(); }}
            className="btn btn-secondary flex items-center gap-2 px-4 h-11"
          >
            <IconRefresh className={clsx("h-4 w-4", isLoading && "animate-spin")} />
            Sync Hardware
          </button>
          <button
            onClick={openCreateModal}
            className="btn btn-primary flex items-center gap-2 px-6 h-11 shadow-lg shadow-primary-500/20"
          >
            <IconPlus className="h-4 w-4" />
            Provision Device
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <DeviceStatCard label="Total" value={stats.total} color="text-gray-600" />
          <DeviceStatCard label="Online" value={stats.online} color="text-emerald-600" active />
          <DeviceStatCard label="Offline" value={stats.offline} color="text-gray-400" />
          <DeviceStatCard label="Maintenance" value={stats.maintenance} color="text-amber-600" />
          <DeviceStatCard label="Error" value={stats.error} color="text-rose-600" />
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search terminal nodes by name, IP, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-transparent focus:border-primary-500 rounded-xl text-sm outline-none transition-all"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-transparent focus:border-primary-500 rounded-xl text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer"
        >
          <option value="">All Architectures</option>
          {Object.entries(deviceTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-transparent focus:border-primary-500 rounded-xl text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer"
        >
          <option value="">All States</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {/* Device Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-gray-50 dark:bg-gray-800/40 rounded-3xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white dark:bg-[#1a2234] rounded-3xl p-20 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <IconServer className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Registry is Empty</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-8">No edge devices detected in the current sector. Provision a new terminal node to begin data ingestion.</p>
          <button onClick={openCreateModal} className="btn btn-primary px-8">Provision Device</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div
              key={device.id}
              className="group bg-white dark:bg-[#1a2234] rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-primary-500/30 transition-all duration-300 relative overflow-hidden"
            >
              {/* Type-based background accent */}
              <div className={clsx(
                "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
                deviceTypeColors[device.type]?.split(' ')[0]
              )} />

              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300',
                    deviceTypeColors[device.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}>
                    {deviceTypeIcons[device.type]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-primary-600 transition-colors">{device.name}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{deviceTypeLabels[device.type]}</p>
                  </div>
                </div>
                <div className={clsx(
                  'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border',
                  device.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' :
                  device.status === 'ERROR' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800' :
                  'bg-gray-50 text-gray-500 border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                )}>
                  {device.status === 'ONLINE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {device.status}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {device.ipAddress && (
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <IconWifi className="w-4 h-4 text-primary-500" />
                    <span className="font-mono">{device.ipAddress}{device.port && `:${device.port}`}</span>
                  </div>
                )}
                {device.location && (
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <IconSettings className="w-4 h-4 text-violet-500" />
                    <span>{device.location}</span>
                  </div>
                )}
                {device.lastHeartbeat && (
                  <div className="text-[10px] text-gray-400 font-medium italic pl-7">
                    Pulse: {new Date(device.lastHeartbeat).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-50 dark:border-gray-800">
                <button
                  onClick={() => handleEdit(device)}
                  className="btn btn-secondary flex-1 text-xs py-2 h-9"
                >
                  <IconEdit className="h-3.5 w-3.5 mr-1.5" />
                  Configure
                </button>
                <button
                  onClick={() => handleDelete(device)}
                  className="btn btn-secondary flex-1 text-xs py-2 h-9 text-rose-600 hover:text-rose-700 border-rose-100 hover:border-rose-200"
                >
                  <IconTrash className="h-3.5 w-3.5 mr-1.5" />
                  Decommission
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Provisioning Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-[#1a2234] rounded-3xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingDevice ? 'Modify Terminal Config' : 'Hardware Provisioning'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <IconX className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="label">Device Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="e.g. Fog-Node-01-Alpha"
                    required
                  />
                </div>

                <div>
                  <label className="label">Hardware Architecture</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Device['type'] })}
                    className="select"
                    required
                  >
                    {Object.entries(deviceTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Operational Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Device['status'] })}
                    className="select"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="ERROR">Error</option>
                  </select>
                </div>

                <div>
                  <label className="label">Static IP</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="input font-mono"
                    placeholder="10.0.0.1"
                  />
                </div>
                <div>
                  <label className="label">Control Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="input font-mono"
                    placeholder="8080"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Geographic/Network Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input"
                    placeholder="Sector 7-G / Cloud Gateway B"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Abort</button>
                <button type="submit" className="btn btn-primary flex-1 shadow-lg shadow-primary-500/20">
                  {editingDevice ? 'Apply Changes' : 'Initialize Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceStatCard({ label, value, color, active }: any) {
  return (
    <div className={clsx(
      "bg-white dark:bg-[#1a2234] rounded-2xl p-5 border shadow-sm transition-all duration-300",
      active ? "border-primary-500/50 shadow-md scale-[1.02]" : "border-gray-100 dark:border-gray-800"
    )}>
      <div className="text-3xl font-extrabold font-mono text-gray-900 dark:text-white leading-none">{value}</div>
      <div className={clsx("text-[10px] font-black uppercase tracking-widest mt-2", color)}>{label}</div>
    </div>
  );
}
