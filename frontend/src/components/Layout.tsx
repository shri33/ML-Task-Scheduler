import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Server,
  BarChart3,
  Menu,
  X,
  WifiOff,
  Cloud,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  Cpu,
  FlaskConical,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Resources', href: '/resources', icon: Server },
  { name: 'Devices', href: '/devices', icon: Cpu },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Fog Computing', href: '/fog-computing', icon: Cloud },
  { name: 'Experiments', href: '/experiments', icon: FlaskConical },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  // Close user menu on route change
  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleOpenProfile = useCallback(() => {
    setUserMenuOpen(false);
    navigate('/profile');
  }, [navigate]);

  // Track backend status via REST health poll (replaces WebSocket)
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { credentials: 'include' });
        if (mounted) setIsConnected(res.ok);
      } catch {
        if (mounted) setIsConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // poll every 30s
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        {/* Top bar: Logo + Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/logo.svg" alt="ML Task Scheduler" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                ML Task Scheduler
              </span>
            </Link>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Connection Status pill */}
              <div className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                isConnected 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
              )}>
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="hidden sm:inline">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </button>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="h-8 w-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="hidden sm:block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {user?.name?.split(' ')[0] || 'User'}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999] animate-scale-in">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenProfile}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <Settings className="h-4 w-4" />
                      Account Settings
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Navigation — separate row */}
        <div className="hidden md:block border-t border-gray-100 dark:border-gray-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 -mb-px overflow-x-auto scrollbar-none">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200',
                      isActive
                        ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-300 bg-primary-50/50 dark:bg-primary-900/10'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <item.icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-primary-600 dark:text-primary-400' : '')} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-fade-in">
            <nav className="px-3 py-2 space-y-0.5">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-l-3 border-primary-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in-up">
        {children}
      </main>
    </div>
  );
}
