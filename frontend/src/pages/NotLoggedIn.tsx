import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Home, ShieldAlert } from 'lucide-react';

export default function NotLoggedIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 relative overflow-hidden selection-red">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0505] to-black" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 max-w-2xl w-full text-center">
        <div className="inline-flex items-center justify-center w-18 h-18 rounded-full border border-[#ef233c]/30 bg-[#ef233c]/10 mb-6">
          <ShieldAlert className="h-8 w-8 text-[#ef233c]" />
        </div>

        <h1 className="text-4xl md:text-6xl font-bold font-manrope tracking-tight mb-4">
          You are not logged in
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
          This page is protected. Please sign in first to continue{from ? ` to ${from}` : ''}.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-7 py-3 transition-transform active:scale-95 border border-white/10"
          >
            <span className="absolute inset-0 border border-white/10 rounded-full" />
            <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ef233c_100%)] opacity-100" />
            <span className="absolute inset-[2px] rounded-full bg-gradient-to-b from-[#24030a] via-[#0a0002] to-black" />
            <span className="relative z-10 flex items-center gap-2 font-medium text-white">
              Sign In
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-7 py-3 text-white hover:bg-white/[0.06] transition-colors"
          >
            <Home className="h-5 w-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
