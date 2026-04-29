import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconListCheck,
  IconServer,
  IconChartBar,
  IconWifiOff,
  IconCloud,
  IconMoon,
  IconSun,
  IconLogout,
  IconUser,
  IconSettings,
  IconCpu,
  IconFlask,
  IconSearch,
  IconMenu2,
  IconCircleDot,
  IconCalendar,
  IconUserShield,
  IconShieldCheck,
  IconHelpCircle,
  IconMail,
  IconMessages,
  IconColumns,
  IconUsers,
  IconBrain,
  IconFlame
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import NotificationCenter from "./NotificationCenter";
import FloatingParticles from "./FloatingParticles";

interface LayoutProps {
  children: ReactNode;
}

const navigationGroups = [
  {
    title: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: IconDashboard },
      { name: "Calendar", href: "/calendar", icon: IconCalendar },
      { name: "Tasks", href: "/tasks", icon: IconListCheck },
    ]
  },
  {
    title: "Apps",
    items: [
      { name: "Email", href: "/email", icon: IconMail },
      { name: "Chat", href: "/chat", icon: IconMessages },
      { name: "Kanban", href: "/kanban", icon: IconColumns },
    ]
  },
  {
    title: "Systems",
    items: [
      { name: "Resources", href: "/resources", icon: IconServer },
      { name: "Devices", href: "/devices", icon: IconCpu },
      { name: "Fog Computing", href: "/fog-computing", icon: IconCloud },
      { name: "Chaos Console", href: "/chaos-console", icon: IconFlame },
    ]
  },
  {
    title: "Intelligence",
    items: [
      { name: "Analytics", href: "/analytics", icon: IconChartBar },
      { name: "Experiments", href: "/experiments", icon: IconFlask },
      { name: "ML Models", href: "/ml-models", icon: IconBrain },
    ]
  },
  {
    title: "Access Control",
    items: [
      { name: "Users", href: "/users", icon: IconUsers },
      { name: "Roles", href: "/roles", icon: IconUserShield },
      { name: "Permissions", href: "/permissions", icon: IconShieldCheck },
    ]
  },
  {
    title: "Pages",
    items: [
      { name: "User Profile", href: "/profile", icon: IconUser },
      { name: "FAQ", href: "/faq", icon: IconHelpCircle },
    ]
  }
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Track backend status
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
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex font-sans overflow-hidden relative">
      <FloatingParticles />
      {/* ── Vuexy-Style SIDEBAR ── */}
      <div 
        className={clsx(
          "bg-white dark:bg-[#1a2234] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 z-50 sticky top-0 h-screen shadow-[0_0_15px_rgba(0,0,0,0.03)] dark:shadow-none",
          sidebarOpen ? "w-[260px]" : "w-[80px]"
        )}
      >
        {/* Logo Section */}
        <div className="h-[72px] flex items-center justify-between px-5 shrink-0">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-primary-600 rounded-lg flex items-center justify-center shrink-0 shadow-md">
              <img src="/logo.svg" alt="Logo" className="h-4 w-4 brightness-0 invert" />
            </div>
            <span className={clsx(
              "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-primary-600 dark:from-emerald-400 dark:to-primary-400 whitespace-nowrap transition-opacity duration-300",
              sidebarOpen ? "opacity-100" : "opacity-0 hidden"
            )}>
              Scheduler
            </span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
          >
            {sidebarOpen ? <IconCircleDot className="w-5 h-5" /> : <IconMenu2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-6 custom-scrollbar">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {sidebarOpen && (
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-4 flex items-center gap-2">
                  <span className="w-1 h-px bg-gray-300 dark:bg-gray-700"></span>
                  {group.title}
                </div>
              )}
              
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative",
                      isActive
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/25 font-semibold"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252f43] hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <item.icon className={clsx(
                      "w-5 h-5 shrink-0 transition-all duration-300",
                      isActive ? "text-white" : "group-hover:scale-110"
                    )} stroke={1.5} />
                    
                    <span className={clsx(
                      "whitespace-nowrap transition-all duration-300 text-sm",
                      sidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 hidden"
                    )}>
                      {item.name}
                    </span>

                    {/* Active Indicator Bar */}
                    {isActive && sidebarOpen && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-l-full" />
                    )}

                    {/* Tooltip for collapsed mode */}
                    {!sidebarOpen && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <Link
            to="/profile"
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252f43] transition-colors",
              !sidebarOpen && "justify-center px-0"
            )}
          >
            <IconSettings className="w-5 h-5 shrink-0" stroke={1.5} />
            {sidebarOpen && <span className="whitespace-nowrap">Settings</span>}
          </Link>
          <button
            onClick={logout}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mt-1",
              !sidebarOpen && "justify-center px-0"
            )}
          >
            <IconLogout className="w-5 h-5 shrink-0" stroke={1.5} />
            {sidebarOpen && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* ── RIGHT CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        
        {/* ── Vuexy-Style NAVBAR ── */}
        <div className="px-6 py-4 z-40 relative">
          <header className="h-[64px] bg-white/80 dark:bg-[#1a2234]/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-between px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            
            {/* Left: Search Bar */}
            <div className="flex items-center flex-1">
              {!sidebarOpen && (
                 <button onClick={() => setSidebarOpen(true)} className="mr-4 lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <IconMenu2 className="w-5 h-5" />
                 </button>
              )}
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 w-full max-w-md group cursor-text">
                <IconSearch className="w-5 h-5 group-hover:text-primary-500 transition-colors" stroke={1.5} />
                <span className="text-sm group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors hidden sm:block">Search (Ctrl+/)</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Connection Status Badge */}
              <div
                className={clsx(
                  "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  isConnected
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                    : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                )}
              >
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live
                  </>
                ) : (
                  <>
                    <IconWifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === "light" ? <IconMoon className="w-5 h-5" stroke={1.5} /> : <IconSun className="w-5 h-5" stroke={1.5} />}
              </button>

              {/* Notifications */}
              <NotificationCenter />

              {/* User Profile */}
              <div ref={userMenuRef} className="relative ml-1">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="relative group flex items-center"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-100 to-primary-100 dark:from-emerald-900/40 dark:to-primary-900/40 border border-emerald-200 dark:border-emerald-800/50 rounded-full flex items-center justify-center shadow-sm overflow-hidden group-hover:ring-2 ring-primary-500/50 transition-all">
                    <IconUser className="w-5 h-5 text-primary-600 dark:text-primary-400" stroke={1.5} />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#1a2234] rounded-full" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-[#1a2234] rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 py-2 z-[9999] animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user?.name || 'Demo User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {user?.email || 'demo@example.com'}
                      </p>
                    </div>
                    
                    <button onClick={handleOpenProfile} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      <IconSettings className="w-4 h-4" stroke={1.5} /> Settings
                    </button>
                    
                    <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                    
                    <button onClick={() => { logout(); setUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <IconLogout className="w-4 h-4" stroke={1.5} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>

        {/* Page content area */}
        <main className="flex-1 w-full overflow-y-auto px-6 pb-6 pt-2 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
