import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  Server,
  BarChart3,
  WifiOff,
  Cloud,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  Cpu,
  FlaskConical,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: ListTodo },
  { name: "Resources", href: "/resources", icon: Server },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Fog Computing", href: "/fog-computing", icon: Cloud },
  { name: "Experiments", href: "/experiments", icon: FlaskConical },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Close user menu on route change
  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleOpenProfile = useCallback(() => {
    setUserMenuOpen(false);
    navigate("/profile");
  }, [navigate]);

  // Track backend status via REST health poll (replaces WebSocket)
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { credentials: "include" });
        if (mounted) setIsConnected(res.ok);
      } catch {
        if (mounted) setIsConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // poll every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* ── SIDEBAR ── */}
      {/* ── SIDEBAR ── */}
<div className="w-19 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 sticky top-0 h-screen z-50 px-2">
  
  {/* TOP: Logo */}
  <Link
    to="/"
    className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shrink-0"
  >
    <img src="/logo.svg" alt="ML Task Scheduler" className="h-5 w-5" />
  </Link>

  {/* CENTER: Nav icons */}
  <div className="flex-1 flex flex-col items-center justify-center gap-1">
    {navigation.map((item) => {
      const isActive = location.pathname === item.href;
      return (
        <Link
          key={item.name}
          to={item.href}
          title={item.name}
          className={clsx(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-colors group relative",
            isActive
              ? "bg-primary-50 dark:bg-black/30 text-primary-600 dark:text-primary-400"
              : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300",
          )}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs font-semibold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {item.name}
          </span>
        </Link>
      );
    })}
  </div>

  {/* BOTTOM: Settings + Sign out */}
  <div className="flex flex-col items-center gap-1">
    <button
      onClick={handleOpenProfile}
      title="Account Settings"
      className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 transition-colors"
    >
      <Settings className="h-5 w-5" />
    </button>
    <button
      onClick={logout}
      title="Sign Out"
      className="w-11 h-11 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
    >
      <LogOut className="h-5 w-5" />
    </button>
  </div>

</div>

      {/* ── RIGHT SIDE ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim top bar: brand + status + theme + user */}
        <header className="h-14 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-40">
          <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
            ML Task Scheduler
          </span>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                isConnected
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
              )}
            >
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </div>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>
            {/* User avatar */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="h-8 w-8 bg-primary-100 dark:bg-black/30 rounded-full flex items-center justify-center"
              >
                <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999]">
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
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                  >
                    <Settings className="h-4 w-4" /> Account Settings
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 w-full overflow-y-auto ">{children}</main>
      </div>
    </div>
  );
}
