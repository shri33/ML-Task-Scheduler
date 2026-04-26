import { useState } from 'react';
import { 
  IconUser, 
  IconShieldLock, 
  IconCreditCard, 
  IconBell, 
  IconLink,
  IconCheck,
  IconEdit,
  IconSearch
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import ProgressBar from '../components/shared/ProgressBar';

export default function UserView() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in">
      <div className="grid grid-cols-12 gap-8">
         
         {/* ── LEFT SIDEBAR (User Profile) ── */}
         <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm text-center">
               <div className="relative inline-block mb-4">
                  <img className="w-24 h-24 rounded-2xl mx-auto" src="https://i.pravatar.cc/150?u=21" alt="User" />
                  <span className="absolute bottom-[-4px] right-[-4px] w-6 h-6 bg-emerald-500 border-4 border-white dark:border-[#1a2234] rounded-full" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 dark:text-white">Jordan Stevenson</h3>
               <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg text-xs font-bold uppercase tracking-widest mt-2 inline-block">Administrator</span>
               
               <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-left">
                     <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tasks Done</p>
                     <p className="text-lg font-black text-gray-900 dark:text-white">1.23k</p>
                  </div>
                  <div className="text-left">
                     <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Project Done</p>
                     <p className="text-lg font-black text-gray-900 dark:text-white">568</p>
                  </div>
               </div>
               
               <div className="mt-8 space-y-4 text-left">
                  <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Details</h4>
                  <div className="space-y-3">
                     <DetailRow label="Username" value="@jordan.stevenson" />
                     <DetailRow label="Email" value="jordan@example.com" />
                     <DetailRow label="Status" value="Active" isStatus />
                     <DetailRow label="Role" value="Administrator" />
                     <DetailRow label="Tax ID" value="TAX-875623" />
                     <DetailRow label="Contact" value="+1 (234) 456-7890" />
                     <DetailRow label="Language" value="English" />
                     <DetailRow label="Country" value="USA" />
                  </div>
               </div>

               <div className="mt-8 flex gap-3">
                  <button className="flex-1 btn btn-primary py-2.5 text-sm font-bold flex items-center justify-center gap-2">
                     <IconEdit className="w-4 h-4" /> Edit
                  </button>
                  <button className="flex-1 btn btn-secondary py-2.5 text-sm font-bold bg-red-50 text-red-600 border-none hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30">
                     Suspend
                  </button>
               </div>
            </div>

            {/* PLAN CARD */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-xl shadow-primary-500/20">
               <div className="flex justify-between items-start mb-6">
                  <span className="px-2.5 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">Standard</span>
                  <div className="text-right">
                     <p className="text-2xl font-black leading-none">$99</p>
                     <p className="text-[10px] opacity-70">per month</p>
                  </div>
               </div>
               <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-xs font-medium"><IconCheck className="w-4 h-4" /> 10 Team Members</li>
                  <li className="flex items-center gap-2 text-xs font-medium"><IconCheck className="w-4 h-4" /> 500 GB Storage</li>
               </ul>
               <button className="w-full py-2.5 bg-white text-primary-600 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-lg">Upgrade Plan</button>
            </div>
         </div>

         {/* ── RIGHT CONTENT (Tabs) ── */}
         <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="flex flex-wrap gap-2 mb-2">
               <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={IconUser} label="Overview" />
               <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={IconShieldLock} label="Security" />
               <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} icon={IconCreditCard} label="Billing & Plan" />
               <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={IconBell} label="Notifications" />
               <TabButton active={activeTab === 'connections'} onClick={() => setActiveTab('connections')} icon={IconLink} label="Connections" />
            </div>

            <div className="space-y-6">
               {/* PROJECT LIST TABLE */}
               <div className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Project List</h3>
                     <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Search Project" className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none w-64" />
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-gray-800">
                              <th className="px-6 py-4">Project</th>
                              <th className="px-6 py-4">Total Tasks</th>
                              <th className="px-6 py-4">Progress</th>
                              <th className="px-6 py-4">Hours</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                           <ProjectRow name="React Admin Template" icon="⚛️" tasks="120/150" progress={80} hours="25:30" />
                           <ProjectRow name="Vuejs Dashboard" icon="🟢" tasks="45/140" progress={32} hours="12:45" />
                           <ProjectRow name="Laravel CRM" icon="🔴" tasks="11/15" progress={73} hours="45:00" />
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* USER ACTIVITY TIMELINE */}
               <div className="bg-white dark:bg-[#1a2234] rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-8">User Activity Timeline</h3>
                  <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-800">
                     <TimelineItem title="12 Invoices have been paid" time="12 min ago" description="Invoices have been paid to the company." icon="💰" />
                     <TimelineItem title="Client Meeting" time="45 min ago" description="Project meeting with john @10:15am" icon="📅" />
                     <TimelineItem title="Create a new project for client" time="2 days ago" description="6 team members in a project" icon="🏗️" />
                  </div>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}

function DetailRow({ label, value, isStatus = false }: any) {
  return (
    <div className="flex items-center gap-2 text-sm">
       <span className="font-bold text-gray-700 dark:text-gray-300 min-w-[80px]">{label}:</span>
       {isStatus ? (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black uppercase">{value}</span>
       ) : (
          <span className="text-gray-500">{value}</span>
       )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
        active 
          ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" 
          : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#1a2234] hover:shadow-sm"
      )}
    >
      <Icon className="w-4 h-4" stroke={1.5} />
      {label}
    </button>
  );
}

function ProjectRow({ name, icon, tasks, progress, hours }: any) {
  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
       <td className="px-6 py-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm">{icon}</div>
             <span className="text-sm font-bold text-gray-900 dark:text-white">{name}</span>
          </div>
       </td>
       <td className="px-6 py-4 text-sm text-gray-500">{tasks}</td>
       <td className="px-6 py-4 min-w-[150px]">
          <div className="flex items-center gap-3">
             <div className="flex-1"><ProgressBar value={progress} color="primary" height={6} /></div>
             <span className="text-xs font-bold text-gray-400">{progress}%</span>
          </div>
       </td>
       <td className="px-6 py-4 text-sm text-gray-500 font-mono">{hours}</td>
    </tr>
  );
}

function TimelineItem({ title, time, description, icon }: any) {
  return (
    <div className="relative pl-10">
       <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white dark:bg-[#1a2234] border-2 border-primary-500 flex items-center justify-center text-[10px] z-10 shadow-sm">
          {icon}
       </div>
       <div className="flex justify-between items-start mb-1">
          <h5 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h5>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{time}</span>
       </div>
       <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
