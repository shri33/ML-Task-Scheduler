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
  IconPlus,
  IconPaperclip,
  IconArchive
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';

export default function Email() {
  const { mails, fetchMails, sendMail } = useStore();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ recipients: '', subject: '', content: '' });
  const toast = useToast();

  useEffect(() => {
    fetchMails(activeFolder);
  }, [activeFolder, fetchMails]);

  const filteredMails = useMemo(() => {
    return mails.filter(m => 
      m.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.sender?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mails, searchTerm]);

  const selectedMail = mails.find(m => m.id === selectedMailId);

  const handleSend = async () => {
    try {
      await sendMail({
        recipients: composeData.recipients.split(',').map(s => s.trim()),
        subject: composeData.subject,
        content: composeData.content
      });
      setIsComposeOpen(false);
      setComposeData({ recipients: '', subject: '', content: '' });
      toast.success('Email Sent', 'Your message is on its way.');
      fetchMails('sent');
    } catch (error) {
      toast.error('Error', 'Failed to send email.');
    }
  };

  const FOLDERS = [
    { id: 'inbox', name: 'Inbox', icon: IconMail, count: filteredMails.filter(m => !m.isRead).length, color: 'text-primary-600' },
    { id: 'sent', name: 'Sent', icon: IconSend, count: 0, color: 'text-gray-500' },
    { id: 'drafts', name: 'Drafts', icon: IconPencil, count: 0, color: 'text-amber-500' },
    { id: 'starred', name: 'Starred', icon: IconStar, count: 0, color: 'text-yellow-500' },
    { id: 'trash', name: 'Trash', icon: IconTrash, count: 0, color: 'text-gray-500' },
  ];

  return (
    <div className="h-[calc(100vh-12rem)] animate-fade-in flex bg-white dark:bg-[#1a2234] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-72 border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-6">
           <button 
             onClick={() => setIsComposeOpen(true)}
             className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 hover:scale-[1.02] active:scale-95 transition-all"
           >
              <IconPlus className="w-5 h-5" /> 
              <span>Compose</span>
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
           {FOLDERS.map(folder => (
              <button 
                key={folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedMailId(null); }}
                className={clsx(
                  "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                  activeFolder === folder.id 
                    ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600" 
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
              >
                 <div className="flex items-center gap-3">
                    <folder.icon className={clsx("w-5 h-5", activeFolder === folder.id ? "text-primary-600" : "text-gray-400")} />
                    {folder.name}
                 </div>
                 {folder.count > 0 && (
                    <span className="px-2 py-0.5 bg-primary-600 text-white rounded-lg text-[10px] font-black">
                       {folder.count}
                    </span>
                 )}
              </button>
           ))}
        </div>
      </aside>

      {/* ── EMAIL LIST ── */}
      <div className={clsx("border-r border-gray-100 dark:border-gray-800 flex flex-col min-w-0 transition-all duration-300", selectedMailId ? "w-96" : "flex-1")}>
         <header className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
            <div className="relative flex-1">
               <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                  type="text" 
                  placeholder="Search mail..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20" 
               />
            </div>
         </header>

         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredMails.map(mail => (
               <div 
                 key={mail.id} 
                 onClick={() => setSelectedMailId(mail.id)}
                 className={clsx(
                  "p-5 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all cursor-pointer group relative",
                  selectedMailId === mail.id && "bg-primary-50/50 dark:bg-primary-500/5",
                  !mail.isRead && "font-bold"
                 )}
               >
                  {!mail.isRead && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary-600 rounded-full" />}
                  <div className="flex justify-between items-start mb-1">
                     <span className="text-sm text-gray-900 dark:text-white truncate pr-4">{mail.sender?.name}</span>
                     <span className="text-[10px] text-gray-400 shrink-0">
                       {new Date(mail.createdAt).toLocaleDateString()}
                     </span>
                  </div>
                  <h4 className="text-sm text-gray-700 dark:text-gray-300 truncate mb-1">{mail.subject}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-1">{mail.content}</p>
               </div>
            ))}
            {filteredMails.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <IconMail className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm font-medium">No messages found</p>
              </div>
            )}
         </div>
         <footer className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1a2234]">
            <p className="text-xs text-gray-500">Showing {filteredMails.length} messages</p>
         </footer>
      </div>

      {/* ── EMAIL VIEW ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30 dark:bg-[#0f172a]/20">
        {selectedMail ? (
          <>
            <header className="h-20 px-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1a2234]">
              <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500"><IconArchive className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500"><IconTrash className="w-5 h-5" /></button>
                <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1" />
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500"><IconStar className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500"><IconDotsVertical className="w-5 h-5" /></button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{selectedMail.subject}</h1>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white font-bold text-lg">
                        {selectedMail.sender?.name?.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{selectedMail.sender?.name}</h4>
                        <p className="text-xs text-gray-500">From: {selectedMail.sender?.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(selectedMail.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800 pt-8">
                  {selectedMail.content}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-6">
                <IconMail className="w-10 h-10 opacity-20" />
             </div>
             <p className="text-sm font-bold">Select a message to read</p>
          </div>
        )}
      </div>

      {/* ── COMPOSE MODAL ── */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1a2234] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden scale-in">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="font-bold text-gray-900 dark:text-white">New Message</h3>
              <button onClick={() => setIsComposeOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">✕</button>
            </div>
            <div className="p-8 space-y-6">
              <input 
                type="text" 
                placeholder="To (comma separated user IDs)" 
                value={composeData.recipients}
                onChange={e => setComposeData({...composeData, recipients: e.target.value})}
                className="w-full bg-transparent border-b border-gray-100 dark:border-gray-800 py-3 outline-none text-sm dark:text-white focus:border-primary-500 transition-colors" 
              />
              <input 
                type="text" 
                placeholder="Subject" 
                value={composeData.subject}
                onChange={e => setComposeData({...composeData, subject: e.target.value})}
                className="w-full bg-transparent border-b border-gray-100 dark:border-gray-800 py-3 outline-none text-sm dark:text-white focus:border-primary-500 transition-colors" 
              />
              <textarea 
                placeholder="Write your message..." 
                rows={10}
                value={composeData.content}
                onChange={e => setComposeData({...composeData, content: e.target.value})}
                className="w-full bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none text-sm dark:text-white focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
              <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500"><IconPaperclip className="w-5 h-5" /></button>
              <div className="flex gap-3">
                <button onClick={() => setIsComposeOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Cancel</button>
                <button 
                  onClick={handleSend}
                  disabled={!composeData.recipients || !composeData.subject}
                  className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
