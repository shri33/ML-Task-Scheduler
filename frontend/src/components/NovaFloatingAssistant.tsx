import { useState, useEffect, useRef } from 'react';
import { aiApi, metricsApi } from '../lib/api';
import { 
  IconRobot, 
  IconX, 
  IconSend, 
  IconMinus, 
  IconAlertTriangle,
} from '@tabler/icons-react';
import { clsx } from 'clsx';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function NovaFloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am Nova, your Multi-Agent Orchestrator. How can I help you optimize your warehouse operations today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnomaly, setHasAnomaly] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);



  // Poll for anomalies
  useEffect(() => {
    const checkAnomalies = async () => {
      try {
        const data = await metricsApi.getAnomalies();
        if (data?.anomalies?.length > 0) {
          setHasAnomaly(true);
        } else {
          setHasAnomaly(false);
        }
      } catch (e) {
        console.error('Nova monitoring error:', e);
      }
    };

    checkAnomalies();
    const interval = setInterval(checkAnomalies, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: message };
    setHistory(prev => [...prev, userMsg]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await aiApi.chat(message, history);
      setHistory(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'assistant', content: 'I am having trouble connecting to my neural core. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes premium-gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .premium-gradient-bg {
            background: linear-gradient(-45deg, #ffa63d, #ff3d77, #338aff, #3cf0c5);
            background-size: 400% 400%;
            animation: premium-gradient 12s linear infinite;
          }
        `}} />
        <button 
          onClick={() => setIsOpen(true)}
          className={clsx(
            "fixed bottom-[5%] right-[87px] z-[9999] transition-all duration-500 hover:scale-110 active:scale-95 group overflow-hidden shadow-[0_10px_30px_rgba(115,103,240,0.4)] rounded-[6px] premium-gradient-bg",
            hasAnomaly && "animate-bounce !bg-red-500"
          )}
        >
          <div className={clsx(
            "flex items-center gap-2.5 rounded-[6px] transition-all px-5 py-[0.625rem]",
            hasAnomaly ? "bg-red-600" : "bg-white/10 hover:bg-white/0"
          )}>
            <IconRobot className="w-5 h-5 text-white" stroke={2} />
            <span className="text-white text-[0.9375rem] font-bold tracking-[0.43px] uppercase">Ask Nova</span>
            
            {hasAnomaly && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-white items-center justify-center">
                  <IconAlertTriangle className="w-3.5 h-3.5 text-red-600" />
                </span>
              </span>
            )}
          </div>
        </button>
      </>
    );
  }

  return (
    <div 
      className={clsx(
        "fixed bottom-[5%] right-[87px] z-[9999] w-96 max-h-[calc(100vh-48px)] bg-white dark:bg-[#1a2234] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-500 animate-scale-up",
        isMinimized ? "h-16" : "h-[550px]"
      )}
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-primary-600 flex items-center justify-between text-white shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30">
            <IconRobot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight">Nova Orchestrator</h4>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] opacity-90">Multi-Agent Active</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <IconMinus className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-950/50 overscroll-contain"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              .no-scrollbar::-webkit-scrollbar { display: none; }
              @keyframes premium-gradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .premium-gradient-bg {
                background: linear-gradient(-45deg, #ffa63d, #ff3d77, #338aff, #3cf0c5);
                background-size: 400% 400%;
                animation: premium-gradient 12s linear infinite;
              }
            `}} />
            <div className="no-scrollbar flex-1 space-y-4">
              {history.map((msg, i) => (
                <div key={i} className={clsx(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <div className={clsx(
                    "max-w-[85%] p-3.5 text-sm rounded-2xl shadow-sm transition-all animate-fade-in",
                    msg.role === 'user' 
                      ? "bg-gradient-to-br from-primary-600 to-indigo-600 text-white rounded-tr-none" 
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 flex items-center gap-3 shadow-sm animate-pulse">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Nova is thinking</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
            <div className="relative">
              <input 
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Nova anything..."
                className="w-full pl-4 pr-12 py-3.5 bg-gray-100 dark:bg-gray-800/50 border border-transparent focus:border-emerald-500/50 dark:focus:border-emerald-500/30 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-gray-400 dark:text-white"
              />
              <button 
                onClick={handleSend}
                disabled={!message.trim() || isLoading}
                className="absolute right-2 top-2 p-1.5 bg-gradient-to-br from-emerald-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                <IconSend className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
               <span className="h-px w-4 bg-gray-100 dark:bg-gray-800" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                 NVIDIA AI Agent Blueprint
               </p>
               <span className="h-px w-4 bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
