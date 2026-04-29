import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  IconPlus, 
  IconSearch, 
  IconDotsVertical, 
  IconEdit, 
  IconTrash,
  IconFilter,
  IconDownload,
  IconUserShield,
  IconServer,
  IconShieldLock,
  IconCode,
  IconEye
} from '@tabler/icons-react';
import { clsx } from 'clsx';

export default function UserList() {
  const { users, fetchUsers, usersLoading } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const STATS = useMemo(() => [
    { label: 'Total Members', value: users.length, change: '+0%', icon: IconUserShield, color: 'primary' },
    { label: 'Active Admins', value: users.filter(u => u.role === 'ADMIN').length, change: '+0', icon: IconShieldLock, color: 'success' },
    { label: 'Viewers', value: users.filter(u => u.role === 'VIEWER').length, change: '+0', icon: IconEye, color: 'info' },
    { label: 'Registered', value: new Date().toLocaleDateString(), change: 'Today', icon: IconServer, color: 'warning' },
  ], [users]);

  if (usersLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS.map(stat => (
          <div key={stat.label} className="bg-white dark:bg-[#1a2234] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className={clsx(
              "p-4 rounded-xl",
              stat.color === 'primary' ? "bg-primary-50 text-primary-600" :
              stat.color === 'success' ? "bg-emerald-50 text-emerald-600" :
              stat.color === 'warning' ? "bg-amber-50 text-amber-600" :
              "bg-sky-50 text-sky-600"
            )}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</span>
                <span className={clsx("text-xs font-bold", "text-emerald-500")}>{stat.change}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── USER TABLE ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <button className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                 <IconFilter className="w-4 h-4" /> Filters
              </button>
              <div className="relative">
                 <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 w-64"
                 />
              </div>
           </div>
           <div className="flex items-center gap-3">
              <button className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                 <IconDownload className="w-4 h-4" /> Export
              </button>
              <button className="btn btn-primary px-5 py-2.5 flex items-center gap-2">
                 <IconPlus className="w-4 h-4" /> Add User
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Researcher</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                       <RoleIcon role={user.role} />
                       {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{new Date(user.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                      user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <button className="p-2 text-gray-400 hover:text-primary-600 transition-colors"><IconEdit className="w-4 h-4" /></button>
                       <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"><IconTrash className="w-4 h-4" /></button>
                       <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><IconDotsVertical className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'ADMIN') return <IconShieldLock className="w-4 h-4 text-rose-600" />;
  if (role === 'USER') return <IconCode className="w-4 h-4 text-emerald-600" />;
  if (role === 'VIEWER') return <IconEye className="w-4 h-4 text-sky-600" />;
  return <IconUserShield className="w-4 h-4 text-gray-400" />;
}
