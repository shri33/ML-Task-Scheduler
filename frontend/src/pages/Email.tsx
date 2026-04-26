import { useState } from 'react';
import { 
  IconMail, 
  IconStar, 
  IconSend, 
  IconPencil, 
  IconTrash, 
  IconSearch,
  IconDotsVertical,
  IconRefresh,
  IconChevronRight,
  IconChevronLeft
} from '@tabler/icons-react';
import { clsx } from 'clsx';

const FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: IconMail, count: 4, color: 'text-primary-600' },
  { id: 'sent', name: 'Sent', icon: IconSend, count: 0, color: 'text-gray-500' },
  { id: 'drafts', name: 'Drafts', icon: IconPencil, count: 1, color: 'text-amber-500' },
  { id: 'starred', name: 'Starred', icon: IconStar, count: 2, color: 'text-yellow-500' },
  { id: 'trash', name: 'Trash', icon: IconTrash, count: 0, color: 'text-gray-500' },
];

const LABELS = [
  { name: 'Research', color: 'bg-primary-500' },
  { id: 'node_alert', name: 'Node Alerts', color: 'bg-red-500' },
  { id: 'benchmarks', name: 'Benchmarks', color: 'bg-emerald-500' },
  { id: 'security', name: 'Security', color: 'bg-amber-500' },
];

const EMAILS = [
  { 
    id: 1, 
    sender: 'Node Controller #7', 
    subject: 'CRITICAL: High Latency Detected on Cluster B', 
    excerpt: 'The average response time on Fog Node #7 has exceeded 500ms. Immediate investigation required...', 
    time: '10:45 AM', 
    starred: true, 
    label: 'Node Alerts',
    avatar: 'https://ui-avatars.com/api/?name=NC7&background=fee2e2&color=dc2626'
  },
  { 
    id: 2, 
    sender: 'Research Pipeline', 
    subject: 'Benchmark Complete: Hybrid HH vs IPSO Result', 
    excerpt: 'The automated benchmark for Task Cycle 842 is complete. Hybrid HH shows a 12.4% efficiency gain...', 
    time: '09:20 AM', 
    starred: false, 
    label: 'Benchmarks',
    avatar: 'https://ui-avatars.com/api/?name=RP&background=ecfdf5&color=059669'
  },
  { 
    id: 3, 
    sender: 'Shri Srivastava', 
    subject: 'Algorithm Refinement Meeting', 
    excerpt: 'Let’s discuss the new pheromone update strategy for the IACO module tomorrow at 10 AM.', 
    time: 'Yesterday', 
    starred: true, 
    label: 'Research',
    avatar: 'https://media.licdn.com/dms/image/v2/D4D03AQEcj0OjaV1cTA/profile-displayphoto-scale_400_400/B4DZlmASTzJgAg-/0/1758352977139?e=1778716800&v=beta&t=BSLicgDEEWtzCFIlfgDH_f1ovuIxWYLyrYq9FEKfh88'
  },
  { 
    id: 4, 
    sender: 'Security Monitor', 
    subject: 'Unauthorized Connection Attempt Blocked', 
    excerpt: 'An IP address from an unknown subnet attempted to access the Fog Node Config interface. Connection was...', 
    time: '2 days ago', 
    starred: false, 
    label: 'Security',
    avatar: 'https://ui-avatars.com/api/?name=SM&background=fffbeb&color=d97706'
  },
];

export default function Email() {
  const [activeFolder, setActiveFolder] = useState('inbox');

  return (
    <div className="h-[calc(100vh-140px)] animate-fade-in flex bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-5">
           <button className="w-full btn btn-shiny group rounded-xl shadow-lg shadow-primary-500/20">
              <div className="btn-inner flex items-center justify-center gap-2">
                 <IconPencil className="w-5 h-5" /> 
                 <span>Compose</span>
              </div>
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
           {FOLDERS.map(folder => (
              <button 
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={clsx(
                  "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                  activeFolder === folder.id 
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                 <div className="flex items-center gap-3">
                    <folder.icon className={clsx("w-5 h-5", activeFolder === folder.id ? "text-primary-600" : "text-gray-400")} />
                    {folder.name}
                 </div>
                 {folder.count > 0 && (
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-black",
                      activeFolder === folder.id ? "bg-primary-600 text-white" : "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                    )}>
                       {folder.count}
                    </span>
                 )}
              </button>
           ))}

           <div className="pt-6 pb-2 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Labels</div>
           {LABELS.map(label => (
              <button key={label.name} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                 <div className={clsx("w-2.5 h-2.5 rounded-full", label.color)} />
                 {label.name}
              </button>
           ))}
        </div>
      </aside>

      {/* ── EMAIL LIST ── */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* List Header */}
         <header className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
               <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input type="text" placeholder="Search mail" className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><IconRefresh className="w-5 h-5" /></button>
               <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-1" />
               <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><IconDotsVertical className="w-5 h-5" /></button>
            </div>
         </header>

         {/* List Content */}
         <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {EMAILS.map(email => (
               <div key={email.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all cursor-pointer group">
                  <div className="flex flex-col items-center gap-3 mt-1">
                     <button className={clsx("transition-colors", email.starred ? "text-yellow-500" : "text-gray-300 group-hover:text-gray-400")}>
                        <IconStar className="w-5 h-5" fill={email.starred ? "currentColor" : "none"} />
                     </button>
                  </div>
                  <img src={email.avatar} alt="" className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-800" />
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{email.sender}</h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{email.time}</span>
                     </div>
                     <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1 truncate">{email.subject}</p>
                     <p className="text-xs text-gray-500 line-clamp-1">{email.excerpt}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3 self-center">
                     <span className={clsx(
                       "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                       LABELS.find(l => l.name === email.label)?.color.replace('bg-', 'bg-opacity-10 text-')
                     )}>
                        {email.label}
                     </span>
                  </div>
               </div>
            ))}
         </div>

         {/* List Footer */}
         <footer className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing 1 - {EMAILS.length} of 4</p>
            <div className="flex items-center gap-2">
               <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30" disabled><IconChevronLeft className="w-5 h-5" /></button>
               <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white"><IconChevronRight className="w-5 h-5" /></button>
            </div>
         </footer>
      </div>
    </div>
  );
}
