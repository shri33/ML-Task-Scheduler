import { useLocation, useNavigate } from 'react-router-dom';
import { IconArrowRight, IconHome, IconShieldFilled } from '@tabler/icons-react';

export default function NotLoggedIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-white flex items-center justify-center px-6 relative overflow-hidden transition-colors">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-900/10 dark:to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-primary-200 dark:border-primary-800 bg-primary-100/50 dark:bg-primary-900/30 mb-6 shadow-sm">
          <IconShieldFilled className="h-10 w-10 text-primary-600 dark:text-primary-400" />
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 text-gray-900 dark:text-white">
          You are not logged in
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
          This page is protected. Please sign in first to continue{from ? ` to ${from}` : ''}.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary text-base px-8 py-3.5 gap-2 shadow-lg shadow-primary-500/25 w-full sm:w-auto"
          >
            Sign In
            <IconArrowRight className="h-5 w-5" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary text-base px-8 py-3.5 gap-2 w-full sm:w-auto"
          >
            <IconHome className="h-5 w-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
