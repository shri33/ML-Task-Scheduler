import { useState } from 'react';
import { 
  IconPlus, 
  IconSearch, 
  IconDotsVertical, 
  IconEdit, 
  IconTrash,
  IconFilter,
  IconDownload,
  IconUserShield,
  IconBrain,
  IconServer,
  IconShieldLock,
  IconCode
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import DemoModeBanner from '../components/DemoModeBanner';

const USERS = [
  { id: 1, name: 'Shri Srivastava', email: 'shri@example.com', role: 'Team Leader, Developer', status: 'Active', plan: 'Enterprise', billing: 'Auto Debit', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQEcj0OjaV1cTA/profile-displayphoto-scale_400_400/B4DZlmASTzJgAg-/0/1758352977139?e=1778716800&v=beta&t=BSLicgDEEWtzCFIlfgDH_f1ovuIxWYLyrYq9FEKfh88' },
  { id: 2, name: 'Ichha Dwivedi', email: 'ichha@example.com', role: 'Developer', status: 'Active', plan: 'Team', billing: 'Manual', avatar: 'https://media.licdn.com/dms/image/v2/D5635AQF4HfjRIXfDrg/profile-framedphoto-shrink_400_400/B56ZskJ.5VJ8Ac-/0/1765838155604?e=1777762800&v=beta&t=OaVHII6Mm1ZT1yogIY5awzOKQwoCrdLa1MzfEwpWW-U' },
  { id: 3, name: 'Aditi Singh', email: 'aditi@example.com', role: 'Developer', status: 'Active', plan: 'Team', billing: 'Manual', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQHbXw028qVAFA/profile-displayphoto-scale_400_400/B4DZi9lKpqH4Ao-/0/1755527296321?e=1778716800&v=beta&t=8l36p8D5Gf9VLS9UyXfv6PSh_6VQjQgt2MrQs6hXuOc' },
  { id: 4, name: 'Richard DuBois', email: 'richard@example.com', role: 'Node Maintainer', status: 'Pending', plan: 'Basic', billing: 'Manual', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: 5, name: 'Margo Shea', email: 'margo@example.com', role: 'Security Auditor', status: 'Active', plan: 'Team', billing: 'Auto Debit', avatar: 'https://i.pravatar.cc/150?u=5' },
  { id: 6, name: 'Elaine Gonzales', email: 'elaine@example.com', role: 'Data Scientist', status: 'Inactive', plan: 'Basic', billing: 'Manual', avatar: 'https://i.pravatar.cc/150?u=6' },
];

const STATS = [
  { label: 'Total Members', value: 24, change: '+12%', icon: IconUserShield, color: 'primary' },
  { label: 'Active Nodes', value: 156, change: '+5%', icon: IconServer, color: 'success' },
  { label: 'Pending Audits', value: 3, change: '-2', icon: IconShieldLock, color: 'warning' },
  { label: 'Algorithm Cycles', value: '1.2k', change: '+18%', icon: IconBrain, color: 'info' },
];

export default function UserList() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      <DemoModeBanner featureName="User Management" />
      
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
                <span className={clsx("text-xs font-bold", stat.change.startsWith('+') ? "text-emerald-500" : "text-rose-500")}>{stat.change}</span>
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
                    placeholder="Search Member" 
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
                 <IconPlus className="w-4 h-4" /> Add Member
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Researcher</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {USERS.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img className="h-10 w-10 rounded-full" src={user.avatar} alt="" />
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
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                      user.status === 'Active' ? "bg-emerald-100 text-emerald-700" : 
                      user.status === 'Pending' ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {user.status}
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
  if (role === 'Lead Researcher') return <IconUserShield className="w-4 h-4 text-primary-600" />;
  if (role === 'Full-Stack Developer') return <IconCode className="w-4 h-4 text-emerald-600" />;
  if (role === 'ML Engineer') return <IconBrain className="w-4 h-4 text-amber-600" />;
  if (role === 'Node Maintainer') return <IconServer className="w-4 h-4 text-purple-600" />;
  if (role === 'Security Auditor') return <IconShieldLock className="w-4 h-4 text-rose-600" />;
  return <IconUserShield className="w-4 h-4 text-gray-400" />;
}
