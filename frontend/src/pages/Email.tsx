import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
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
  IconChevronLeft,
  IconBell,
  IconAlertCircle
} from '@tabler/icons-react';
import { clsx } from 'clsx';

export default function Email() {
  const { notifications, fetchNotifications, notificationsLoading } = useStore();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [notifications, searchTerm]);

  const FOLDERS = [
    { id: 'inbox', name: 'Inbox', icon: IconMail, count: filteredNotifications.filter(n => !n.read).length, color: 'text-primary-600' },
    { id: 'sent', name: 'Sent', icon: IconSend, count: 0, color: 'text-gray-500' },
    { id: 'drafts', name: 'Drafts', icon: IconPencil, count: 0, color: 'text-amber-500' },
    { id: 'starred', name: 'Starred', icon: IconStar, count: 0, color: 'text-yellow-500' },
    { id: 'trash', name: 'Trash', icon: IconTrash, count: 0, color: 'text-gray-500' },
  ];

  const LABELS = [
    { id: 'TASK', name: 'Tasks', color: 'bg-primary-500' },
    { id: 'SYSTEM', name: 'System', color: 'bg-amber-500' },
    { id: 'ALERT', name: 'Alerts', color: 'bg-rose-500' },
  ];

  if (notificationsLoading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] animate-fade-in flex bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-5">
           <button className="w-full btn btn-shiny group rounded-xl shadow-lg shadow-primary-500/20">
              <div className="btn-inner flex items-center justify-center gap-2">
                 <IconBell className="w-5 h-5" /> 
                 <span>Mark Read</span>
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

           <div className="pt-6 pb-2 px-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Type</div>
           {LABELS.map(label => (
              <button key={label.id} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
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
               <input 
                  type="text" 
                  placeholder="Search notifications..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none" 
               />
            </div>
            <div className="flex items-center gap-2">
               <button 
                  onClick={() => fetchNotifications()}
                  className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <IconRefresh className="w-5 h-5" />
                </button>
               <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-1" />
               <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><IconDotsVertical className="w-5 h-5" /></button>
            </div>
         </header>

         {/* List Content */}
         <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {filteredNotifications.map(notif => (
               <div key={notif.id} className={clsx(
                  "p-4 flex items-start gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all cursor-pointer group",
                  !notif.read && "bg-primary-50/30 dark:bg-primary-900/5 shadow-inner"
               )}>
                  <div className="flex flex-col items-center gap-3 mt-1 text-gray-400">
                    {notif.type === 'ALERT' ? <IconAlertCircle className="w-5 h-5 text-rose-500" /> : <IconBell className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-1">
                        <h4 className={clsx(
                          "text-sm truncate",
                          notif.read ? "text-gray-600 dark:text-gray-400 font-medium" : "text-gray-900 dark:text-white font-bold"
                        )}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                     </div>
                     <p className={clsx(
                       "text-sm mb-1 truncate",
                       notif.read ? "text-gray-500" : "text-gray-800 dark:text-gray-200 font-semibold"
                     )}>
                       {notif.message}
                     </p>
                  </div>
                  <div className="flex flex-col items-end gap-3 self-center">
                     <span className={clsx(
                       "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                       LABELS.find(l => l.id === notif.type)?.color.replace('bg-', 'bg-opacity-10 text-')
                     )}>
                        {notif.type}
                     </span>
                  </div>
               </div>
            ))}
            {filteredNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <IconMail className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold">No notifications found</p>
              </div>
            )}
         </div>

         {/* List Footer */}
         <footer className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {filteredNotifications.length} notifications</p>
            <div className="flex items-center gap-2">
               <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30" disabled><IconChevronLeft className="w-5 h-5" /></button>
               <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white"><IconChevronRight className="w-5 h-5" /></button>
            </div>
         </footer>
      </div>
    </div>
  );
}
