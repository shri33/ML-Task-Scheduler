import { useState } from 'react';
import { 
  IconBell, 
  IconX, 
  IconInfoCircle, 
  IconFlask, 
  IconMessages, 
  IconDeviceImac 
} from '@tabler/icons-react';
import { clsx } from 'clsx';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'experiment' | 'node' | 'chat' | 'system';
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Experiment Finished',
    message: 'Benchmark cycle #42 for IACO algorithm has completed with 98% accuracy.',
    time: '2m ago',
    type: 'success',
    category: 'experiment',
    read: false
  },
  {
    id: '2',
    title: 'Node Critical Load',
    message: 'Edge Node #7 (Fog-Cluster-A) has exceeded 95% CPU utilization.',
    time: '15m ago',
    type: 'error',
    category: 'node',
    read: false
  },
  {
    id: '3',
    title: 'New Team Message',
    message: 'Felecia Rower: "Good catch. I\'ll adjust the decay alpha..."',
    time: '1h ago',
    type: 'info',
    category: 'chat',
    read: true
  }
];

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'experiment': return <IconFlask className="w-4 h-4" />;
      case 'node': return <IconDeviceImac className="w-4 h-4" />;
      case 'chat': return <IconMessages className="w-4 h-4" />;
      default: return <IconInfoCircle className="w-4 h-4" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-500 bg-emerald-500/10';
      case 'error': return 'text-rose-500 bg-rose-500/10';
      case 'warning': return 'text-amber-500 bg-amber-500/10';
      default: return 'text-primary-500 bg-primary-500/10';
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-primary-500 transition-colors relative"
      >
        <IconBell className="w-6 h-6" stroke={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-4 w-[380px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in origin-top-right">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Notifications</h3>
              <button 
                onClick={markAllRead}
                className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest hover:underline"
              >
                Mark all as read
              </button>
            </div>

            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={clsx(
                        "p-4 flex gap-4 transition-colors relative group",
                        !notification.read ? "bg-primary-50/30 dark:bg-primary-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      )}
                    >
                      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", getColor(notification.type))}>
                        {getIcon(notification.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={clsx("text-sm font-bold truncate", !notification.read ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400")}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] font-medium text-gray-400">{notification.time}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <IconX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <IconBell className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No new notifications</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
              <button className="w-full py-2 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] hover:text-primary-500 transition-colors">
                View All Activity
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
