import { useState } from 'react';
import { 
  IconPlus, 
  IconSearch,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconSettings,
  IconDatabase,
  IconChartBar,
  IconCpu,
  IconLock
} from '@tabler/icons-react';
import { clsx } from 'clsx';

const PERMISSIONS = [
  { id: 1, name: 'Manage Algorithm Lifecycle', assignedTo: ['Lead Researcher', 'Algorithm Developer'], createdDate: '14 Apr 2024, 08:43 PM' },
  { id: 2, name: 'Trigger Distributed Benchmark', assignedTo: ['Lead Researcher', 'Data Scientist'], createdDate: '12 Apr 2024, 10:20 AM' },
  { id: 3, name: 'View Real-time Node Telemetry', assignedTo: ['Lead Researcher', 'Node Maintainer', 'Data Scientist'], createdDate: '10 Apr 2024, 09:15 AM' },
  { id: 4, name: 'Access Raw Dataset Logs', assignedTo: ['Lead Researcher', 'Data Scientist'], createdDate: '08 Apr 2024, 04:30 PM' },
  { id: 5, name: 'Modify Fog Node Configs', assignedTo: ['Node Maintainer'], createdDate: '06 Apr 2024, 11:00 AM' },
  { id: 6, name: 'Export Experiment Results', assignedTo: ['Lead Researcher', 'Data Scientist', 'Subscriber'], createdDate: '04 Apr 2024, 02:45 PM' },
  { id: 7, name: 'Manage System Security', assignedTo: ['Security Auditor', 'Lead Researcher'], createdDate: '02 Apr 2024, 05:30 PM' },
];

export default function Permissions() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Research Permissions</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and assign granular permissions for the ML Task Scheduler research pipeline.</p>
        </div>
        <button className="btn btn-primary px-6 py-3 flex items-center gap-2 self-start md:self-auto">
          <IconPlus className="w-5 h-5" /> Add Permission
        </button>
      </div>

      {/* ── INFO ALERT ── */}
      <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl">
         <IconAlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
         <div className="text-sm">
            <h4 className="font-bold text-amber-900 dark:text-amber-400 mb-1">Important Note!</h4>
            <p className="text-amber-700 dark:text-amber-500/80">Changing permission settings might break the automated benchmarking pipeline. Please ensure the lead researcher is notified before modifying core algorithm permissions.</p>
         </div>
      </div>

      {/* ── PERMISSIONS TABLE ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search Permission" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 w-72"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {PERMISSIONS.map(perm => (
                <tr key={perm.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <PermissionIcon name={perm.name} />
                       <span className="text-sm font-bold text-gray-900 dark:text-white">{perm.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {perm.assignedTo.map(role => (
                        <span 
                          key={role} 
                          className={clsx(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                            role === 'Lead Researcher' ? "bg-primary-100 text-primary-700" :
                            role === 'Node Maintainer' ? "bg-purple-100 text-purple-700" :
                            role === 'Data Scientist' ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          )}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{perm.createdDate}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <button className="p-2 text-gray-400 hover:text-primary-600 transition-colors"><IconEdit className="w-4 h-4" /></button>
                       <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"><IconTrash className="w-4 h-4" /></button>
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

function PermissionIcon({ name }: { name: string }) {
  if (name.includes('Algorithm')) return <IconSettings className="w-5 h-5 text-primary-600" />;
  if (name.includes('Benchmark')) return <IconCpu className="w-5 h-5 text-emerald-600" />;
  if (name.includes('Telemetry')) return <IconChartBar className="w-5 h-5 text-sky-600" />;
  if (name.includes('Dataset')) return <IconDatabase className="w-5 h-5 text-amber-600" />;
  if (name.includes('Security')) return <IconLock className="w-5 h-5 text-rose-600" />;
  return <IconAlertCircle className="w-5 h-5 text-gray-400" />;
}
