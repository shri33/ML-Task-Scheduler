import { useState } from 'react';
import { 
  IconUsers, 
  IconUserShield, 
  IconEdit, 
  IconTrash, 
  IconPlus,
  IconSearch,
  IconCopy,
  IconDotsVertical,
  IconBrain,
  IconServer,
  IconShieldLock
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import DemoModeBanner from '../components/DemoModeBanner';

const ROLES_DATA = [
  { id: 1, name: 'Team Leader, Developer', totalUsers: 1, avatars: ['https://media.licdn.com/dms/image/v2/D4D03AQEcj0OjaV1cTA/profile-displayphoto-scale_400_400/B4DZlmASTzJgAg-/0/1758352977139?e=1778716800&v=beta&t=BSLicgDEEWtzCFIlfgDH_f1ovuIxWYLyrYq9FEKfh88'], color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  { id: 2, name: 'Developer', totalUsers: 2, avatars: ['https://media.licdn.com/dms/image/v2/D5635AQF4HfjRIXfDrg/profile-framedphoto-shrink_400_400/B56ZskJ.5VJ8Ac-/0/1765838155604?e=1777762800&v=beta&t=OaVHII6Mm1ZT1yogIY5awzOKQwoCrdLa1MzfEwpWW-U', 'https://media.licdn.com/dms/image/v2/D4D03AQHbXw028qVAFA/profile-displayphoto-scale_400_400/B4DZi9lKpqH4Ao-/0/1755527296321?e=1778716800&v=beta&t=8l36p8D5Gf9VLS9UyXfv6PSh_6VQjQgt2MrQs6hXuOc'], color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { id: 4, name: 'Node Maintainer', totalUsers: 12, avatars: ['https://i.pravatar.cc/150?u=4'], color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 5, name: 'Security Auditor', totalUsers: 2, avatars: ['https://i.pravatar.cc/150?u=5'], color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
];

const USER_LIST = [
  { id: 1, user: 'Shri Srivastava', email: 'shri@example.com', role: 'Team Leader, Developer', status: 'Active', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQEcj0OjaV1cTA/profile-displayphoto-scale_400_400/B4DZlmASTzJgAg-/0/1758352977139?e=1778716800&v=beta&t=BSLicgDEEWtzCFIlfgDH_f1ovuIxWYLyrYq9FEKfh88' },
  { id: 2, user: 'Ichha Dwivedi', email: 'ichha@example.com', role: 'Developer', status: 'Active', avatar: 'https://media.licdn.com/dms/image/v2/D5635AQF4HfjRIXfDrg/profile-framedphoto-shrink_400_400/B56ZskJ.5VJ8Ac-/0/1765838155604?e=1777762800&v=beta&t=OaVHII6Mm1ZT1yogIY5awzOKQwoCrdLa1MzfEwpWW-U' },
  { id: 3, user: 'Aditi Singh', email: 'aditi@example.com', role: 'Developer', status: 'Active', avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQHbXw028qVAFA/profile-displayphoto-scale_400_400/B4DZi9lKpqH4Ao-/0/1755527296321?e=1778716800&v=beta&t=8l36p8D5Gf9VLS9UyXfv6PSh_6VQjQgt2MrQs6hXuOc' },
  { id: 4, user: 'Elaine Gonzales', email: 'elaine@example.com', role: 'Node Maintainer', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: 5, user: 'Genevieve Cook', email: 'gene@example.com', role: 'Security Auditor', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=5' },
];

export default function Roles() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      <DemoModeBanner featureName="Role Management" />
      
      {/* ── HEADER ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Research Roles List</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">A role provided access to predefined menus and features so that depending on assigned role an administrator can have access to what he need.</p>
      </div>

      {/* ── ROLE CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ROLES_DATA.map(role => (
          <div key={role.id} className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-6">
              <span className="text-sm font-bold text-gray-500">Total {role.totalUsers} researchers</span>
              <div className="flex -space-x-3 overflow-hidden">
                {role.avatars.map((avatar, idx) => (
                  <img key={idx} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800" src={avatar} alt="" />
                ))}
                {role.totalUsers > role.avatars.length && (
                  <div className="flex h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 items-center justify-center text-[10px] font-bold text-gray-500">
                    +{role.totalUsers - role.avatars.length}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{role.name}</h3>
                <button className="text-sm font-bold text-primary-600 hover:underline">Edit Role</button>
              </div>
              <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all">
                <IconCopy className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        
        {/* ADD ROLE CARD */}
        <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-primary-500/50 transition-all">
           <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <IconPlus className="w-8 h-8" />
           </div>
           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Add New Research Role</h3>
           <p className="text-sm text-gray-500">Add role, if it does not exist.</p>
        </div>
      </div>

      {/* ── USER TABLE ── */}
      <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <h3 className="text-lg font-bold text-gray-900 dark:text-white">Research Team Members</h3>
           <div className="flex items-center gap-3">
              <div className="relative">
                 <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Search Researcher" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 w-64"
                 />
              </div>
              <button className="btn btn-primary px-5 py-2.5 flex items-center gap-2">
                 <IconPlus className="w-4 h-4" /> Add Researcher
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Researcher</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {USER_LIST.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img className="h-10 w-10 rounded-full" src={user.avatar} alt="" />
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{user.user}</div>
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
  if (role === 'Full-Stack Developer') return <IconEdit className="w-4 h-4 text-emerald-600" />;
  if (role === 'ML Engineer') return <IconBrain className="w-4 h-4 text-amber-600" />;
  if (role === 'Node Maintainer') return <IconServer className="w-4 h-4 text-purple-600" />;
  if (role === 'Security Auditor') return <IconShieldLock className="w-4 h-4 text-rose-600" />;
  return <IconUsers className="w-4 h-4 text-gray-600" />;
}
