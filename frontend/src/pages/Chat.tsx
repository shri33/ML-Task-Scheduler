import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../lib/api';
import { 
  IconSearch, 
  IconDotsVertical, 
  IconPaperclip, 
  IconSend,
  IconMoodSmile,
  IconPhone,
  IconVideo,
  IconChecks,
  IconCircleFilled,
  IconMicrophone,
  IconInfoCircle,
  IconRobot
} from '@tabler/icons-react';
import { clsx } from 'clsx';

const CONTACTS = [
  { id: 0, name: 'Nova', role: 'System AI Assistant', status: 'Online', lastMsg: 'How can I help you optimize your task scheduler today?', time: 'Now', avatar: 'https://i.pravatar.cc/150?u=ai', online: true, isAI: true },
  { id: 1, name: 'Felecia Rower', role: 'Lead Researcher', status: 'Online', lastMsg: 'Benchmark cycle #42 complete. Results are looking promising.', time: '5m', avatar: 'https://i.pravatar.cc/150?u=1', online: true },
  { id: 2, name: 'Adalberto Granjer', role: 'Data Engineer', status: 'Offline', lastMsg: 'Node 7 latency spiked again. Investigating.', time: '12m', avatar: 'https://i.pravatar.cc/150?u=2', online: false },
  { id: 3, name: 'Joanne Williams', role: 'Algorithm Specialist', status: 'Away', lastMsg: 'The IACO refinement is almost done!', time: '1h', avatar: 'https://i.pravatar.cc/150?u=3', online: false },
  { id: 4, name: 'Waldemar Kris', role: 'DevOps', status: 'Online', lastMsg: 'Docker swarm redeployed with IPSO weights.', time: '2h', avatar: 'https://i.pravatar.cc/150?u=4', online: true },
];

const INITIAL_MESSAGES = [
  { id: 1, text: "System initialized. Project: ML Task Scheduler V2.", time: '10:00 AM', sender: 'system', isMe: false, type: 'status' },
  { id: 2, text: "Hey, I noticed the IACO refinement is stalling on node 4. Any thoughts?", time: '10:01 AM', sender: 'felecia', isMe: false },
  { id: 3, text: "The pheromone decay rate might be too high for low-priority tasks.", time: '10:01 AM', sender: 'felecia', isMe: false },
  { id: 4, text: "Good catch. I'll adjust the decay alpha in the config and restart the cycle.", time: '10:02 AM', sender: 'me', isMe: true },
  { id: 5, text: "Also check the IPSO inertia weight. It should be adaptive based on node load.", time: '10:02 AM', sender: 'me', isMe: true },
  { id: 6, text: "Got it, starting the benchmark now. Thanks! 👍", time: '10:03 AM', sender: 'felecia', isMe: false },
];

export default function Chat() {
  const [activeChat, setActiveChat] = useState(0);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { id: 0, text: "System initialized. Nova AI Assistant online.", time: '10:00 AM', sender: 'system', isMe: false, type: 'status' },
    { id: 1, text: "Hello! I am Nova, your intelligent assistant. I am powered by NVIDIA NIM and Llama 3 to help you manage your Fog Computing architecture. How can I assist you today?", time: '10:01 AM', sender: 'Nova', isMe: false }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeContact = CONTACTS.find(c => c.id === activeChat) || CONTACTS[0];

  useEffect(() => {
    // When switching to AI for the first time, or if empty, show greeting
    if (activeChat === 0 && messages.length <= 1) {
       // Greeting already in state
    } else if (activeChat !== 0) {
       // Show dummy messages for other contacts
       setMessages(INITIAL_MESSAGES);
    }
  }, [activeChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || isTyping) return;
    
    const userMsg = {
      id: messages.length + 1,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: 'me',
      isMe: true
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setMessage('');

    if (activeContact.isAI) {
      setIsTyping(true);
      try {
        const history = updatedMessages
          .filter(m => m.type !== 'status')
          .slice(-5)
          .map(m => ({
            role: (m.isMe ? 'user' : 'assistant') as 'user' | 'assistant',
            content: String(m.text)
          }));

        const aiResponse = await aiApi.chat(message, history);
        
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          text: aiResponse,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'Nova',
          isMe: false
        }]);
      } catch (error) {
        console.error('AI Chat Error:', error);
      } finally {
        setIsTyping(false);
      }
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] animate-fade-in flex bg-white dark:bg-[#020617] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
      
      {/* ── CONTACTS SIDEBAR ── */}
      <div className="w-[300px] lg:w-[380px] border-r border-gray-100 dark:border-gray-800/50 flex flex-col shrink-0 bg-gray-50/30 dark:bg-gray-900/20 backdrop-blur-md">
         <div className="p-6">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">Messages</h1>
            <div className="relative group">
               <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
               <input 
                  type="text" 
                  placeholder="Search researchers..." 
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
               />
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
            <div className="px-3 mb-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Collaboration Team</span></div>
            {CONTACTS.map(contact => (
               <button 
                 key={contact.id}
                 onClick={() => setActiveChat(contact.id)}
                 className={clsx(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group",
                    activeChat === contact.id 
                       ? "bg-white dark:bg-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700" 
                       : "hover:bg-white/50 dark:hover:bg-gray-800/30"
                 )}
               >
                  {activeChat === contact.id && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary-500 rounded-r-full" />}
                  <div className="relative shrink-0">
                     <img className="h-12 w-12 rounded-2xl object-cover shadow-md" src={contact.avatar} alt="" />
                     {contact.online && (
                       <span className="absolute -top-1 -right-1 flex h-3 w-3">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-gray-800" />
                       </span>
                     )}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                     <div className="flex justify-between items-center mb-1">
                        <span className={clsx("text-sm font-bold truncate", activeChat === contact.id ? "text-primary-600 dark:text-primary-400" : "text-gray-900 dark:text-white")}>
                          {contact.name}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">{contact.time}</span>
                     </div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">{contact.lastMsg}</p>
                  </div>
               </button>
            ))}
         </div>
      </div>

      {/* ── CHAT WINDOW ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#020617] relative overflow-hidden">
         {/* Subtle pattern background */}
         <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
         />

         {/* HEADER */}
         <div className="h-[80px] bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-8 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <img className="h-12 w-12 rounded-2xl object-cover shadow-lg" src={activeContact.avatar} alt="" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <IconCircleFilled className={clsx("w-2.5 h-2.5", activeContact.online ? "text-emerald-500" : "text-gray-300")} />
                  </div>
               </div>
               <div>
                  <h4 className="text-base font-black text-gray-900 dark:text-white leading-tight">{activeContact.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500">{activeContact.role}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{activeContact.status}</span>
                  </div>
               </div>
               {activeContact.isAI && (
                 <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                    <IconRobot size={18} />
                 </div>
               )}
            </div>
            <div className="flex items-center gap-2">
               <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700"><IconPhone className="w-5 h-5" stroke={1.5} /></button>
               <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700"><IconVideo className="w-5 h-5" stroke={1.5} /></button>
               <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-2" />
               <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><IconInfoCircle className="w-5 h-5" stroke={1.5} /></button>
               <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><IconDotsVertical className="w-5 h-5" stroke={1.5} /></button>
            </div>
         </div>

         {/* MESSAGES */}
         <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar z-10">
            {messages.map(msg => (
               <div key={msg.id} className={clsx("flex flex-col animate-fade-in-up", msg.isMe ? "items-end" : "items-start")}>
                  {msg.type === 'status' ? (
                    <div className="w-full flex justify-center my-4">
                      <span className="px-4 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800/50 text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-200 dark:border-gray-700 shadow-sm">
                        {msg.text}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className={clsx(
                         "max-w-[80%] lg:max-w-[65%] p-5 rounded-3xl text-sm leading-relaxed relative group",
                         msg.isMe 
                            ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-tr-none shadow-xl shadow-primary-500/10" 
                            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm"
                      )}>
                         {msg.text}
                         <div className={clsx(
                           "absolute top-0 w-4 h-4",
                           msg.isMe ? "-right-2 bg-primary-500 [clip-path:polygon(0_0,0%_100%,100%_0)]" : "-left-2 bg-white dark:bg-gray-800 border-l border-t border-gray-100 dark:border-gray-700 [clip-path:polygon(100%_0,0_0,100%_100%)]"
                         )} />
                      </div>
                      <div className="flex items-center gap-2 mt-2 px-1">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{msg.time}</span>
                         {msg.isMe && <IconChecks className="w-3.5 h-3.5 text-primary-500" />}
                      </div>
                    </>
                  )}
               </div>
            ))}
            
            {isTyping && (
              <div className="flex flex-col items-start animate-fade-in">
                <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-3xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
         </div>

         {/* INPUT AREA */}
         <div className="p-6 bg-white dark:bg-[#020617] border-t border-gray-100 dark:border-gray-800 shrink-0 z-10">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
               <div className="flex items-center gap-1">
                 <button className="w-11 h-11 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-all"><IconMoodSmile className="w-6 h-6" stroke={1.5} /></button>
                 <button className="w-11 h-11 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-500 transition-all"><IconPaperclip className="w-6 h-6" stroke={1.5} /></button>
               </div>
               
               <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message research team..."
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl pl-5 pr-14 py-3.5 text-sm outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-primary-500 transition-colors"><IconMicrophone className="w-5 h-5" stroke={1.5} /></button>
                  </div>
               </div>

               <button 
                 onClick={handleSendMessage}
                 className="w-12 h-12 bg-primary-600 text-white rounded-2xl flex items-center justify-center hover:bg-primary-700 hover:scale-105 transition-all shadow-xl shadow-primary-500/20 active:scale-95 group"
               >
                  <IconSend className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" stroke={1.5} />
               </button>
            </div>
         </div>
      </div>

    </div>
  );
}

