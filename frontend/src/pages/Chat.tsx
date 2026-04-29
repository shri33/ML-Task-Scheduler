import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { 
  IconSearch, 
  IconPaperclip, 
  IconSend,
  IconMoodSmile,
  IconPhone,
  IconVideo,
  IconCircleFilled,
  IconInfoCircle,
  IconRobot,
  IconUserPlus
} from '@tabler/icons-react';
import { clsx } from 'clsx';

export default function Chat() {
  const { 
    chatRooms, 
    activeRoomId, 
    chatMessages, 
    fetchChatRooms, 
    fetchChatMessages, 
    setActiveRoom, 
    sendChatMessage,
    fetchUsers
  } = useStore();
  const { user: currentUser } = useAuth();
  
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatRooms();
    fetchUsers();
  }, [fetchChatRooms, fetchUsers]);

  useEffect(() => {
    if (activeRoomId && activeRoomId !== 'nova') {
      fetchChatMessages(activeRoomId);
    }
  }, [activeRoomId, fetchChatMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const otherMember = activeRoom?.members.find((m: any) => m.userId !== currentUser?.id);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    if (activeRoomId === 'nova') {
      // AI Chat logic - Placeholder for now
      setMessage('');
      return;
    }

    if (!activeRoomId) return;

    await sendChatMessage(activeRoomId, message);
    setMessage('');
  };

  const filteredRooms = chatRooms.filter(room => {
    const name = room.type === 'DIRECT' 
      ? room.members.find((m: any) => m.userId !== currentUser?.id)?.user.name 
      : room.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-white dark:bg-[#1a2234] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xl animate-fade-in">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
              <IconUserPlus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {/* AI Assistant - Fixed at top */}
          <button 
            onClick={() => setActiveRoom('nova')}
            className={clsx(
              "w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 group relative",
              activeRoomId === 'nova' ? "bg-primary-50 dark:bg-primary-500/10 shadow-sm" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
            )}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                <IconRobot className="w-6 h-6" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#1a2234] rounded-full" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-bold text-gray-900 dark:text-white">Nova AI</span>
                <span className="text-[10px] text-primary-500 font-bold uppercase tracking-wider">System</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">How can I help you today?</p>
            </div>
            {activeRoomId === 'nova' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-500 rounded-l-full" />}
          </button>

          <div className="h-px bg-gray-100 dark:bg-gray-800 my-4 mx-3" />

          {/* User Conversations */}
          {filteredRooms.map((room) => {
            const displayUser = room.type === 'DIRECT' 
              ? room.members.find((m: any) => m.userId !== currentUser?.id)?.user 
              : { name: room.name };
            const lastMsg = room.messages?.[0];

            return (
              <button 
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={clsx(
                  "w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 group relative",
                  activeRoomId === room.id ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                )}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                    {displayUser?.name?.charAt(0)}
                  </div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-bold text-gray-900 dark:text-white truncate">{displayUser?.name}</span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lastMsg?.content || 'No messages yet'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0f172a]/30">
        {activeRoomId ? (
          <>
            {/* Chat Header */}
            <div className="h-20 px-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-primary-500">
                  {activeRoomId === 'nova' ? <IconRobot className="w-6 h-6" /> : <IconCircleFilled className="w-3 h-3 text-emerald-500" />}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">
                    {activeRoomId === 'nova' ? 'Nova AI Assistant' : (otherMember?.user.name || 'Group Chat')}
                  </h2>
                  <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Active Now
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                  <IconPhone className="w-5 h-5" />
                </button>
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                  <IconVideo className="w-5 h-5" />
                </button>
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                  <IconInfoCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" ref={scrollRef}>
              {[...chatMessages].reverse().map((msg) => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className={clsx(
                      "max-w-[70%] p-4 rounded-2xl shadow-sm relative group",
                      isMe 
                        ? "bg-primary-600 text-white rounded-tr-none" 
                        : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-tl-none"
                    )}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <span className={clsx(
                        "text-[10px] mt-2 block opacity-70",
                        isMe ? "text-right" : "text-left"
                      )}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-end gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
                <button className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors">
                  <IconPaperclip className="w-5 h-5" />
                </button>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  placeholder="Type a message..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 min-h-[40px] dark:text-white"
                />
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors">
                    <IconMoodSmile className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className={clsx(
                      "p-2.5 rounded-xl transition-all shadow-lg",
                      message.trim() 
                        ? "bg-primary-600 text-white shadow-primary-500/20 hover:scale-105 active:scale-95" 
                        : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <IconSend className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-24 h-24 bg-primary-50 dark:bg-primary-500/10 rounded-full flex items-center justify-center text-primary-500 mb-6">
              <IconMoodSmile className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select a conversation</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
              Choose an AI assistant or a team member from the left to start collaborating in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
