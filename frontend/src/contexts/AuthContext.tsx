import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  forgotPassword: (email: string) => Promise<{ resetToken?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to read a cookie by name (for CSRF)
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const API_URL = `${API_BASE}/api/v1/auth`;

// Demo user for client-side fallback when backend is unavailable
const DEMO_USER: AuthUser = {
  id: 'demo-user-001',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'ADMIN',
};
const DEMO_PASSWORD = 'password123';
const DEMO_MODE_KEY = 'ml-scheduler-demo-mode';

/** Safely parse JSON from a Response, returning null if the body is empty or not valid JSON */
async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Check if a fetch response indicates the backend is not available (405 = no API route, 404 = not found) */
function isBackendUnavailable(response: Response): boolean {
  return response.status === 405 || response.status === 404 || response.status === 502 || response.status === 503;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check if user was in demo mode (persisted across refresh)
    const savedDemo = localStorage.getItem(DEMO_MODE_KEY);
    if (savedDemo) {
      try {
        const demoUser = JSON.parse(savedDemo);
        setUser(demoUser);
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      } catch {
        localStorage.removeItem(DEMO_MODE_KEY);
      }
    }
    // Check for existing session via httpOnly cookie
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      // Not authenticated or token expired or backend unavailable
    } finally {
      setIsLoading(false);
    }
  };

  /** Try server login first; if backend unavailable, fall back to client-side demo */
  const login = async (email: string, password: string) => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // Network error — backend completely unreachable, try demo
      return demoLogin(email, password);
    }

    // If backend returns 405/404/502/503 it means no API server — use demo mode
    if (isBackendUnavailable(response)) {
      return demoLogin(email, password);
    }

    if (!response.ok) {
      const error = await safeJson(response);
      throw new Error(error?.error || `Login failed (${response.status})`);
    }

    const data = await safeJson(response);
    if (!data?.data?.user) {
      // Empty response — backend not returning JSON properly, try demo
      return demoLogin(email, password);
    }
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_MODE_KEY);
    setUser(data.data.user);
  };

  /** Client-side demo login — no backend needed */
  const demoLogin = async (email: string, password: string) => {
    if (email === DEMO_USER.email && password === DEMO_PASSWORD) {
      setUser(DEMO_USER);
      setIsDemoMode(true);
      localStorage.setItem(DEMO_MODE_KEY, JSON.stringify(DEMO_USER));
    } else {
      // Allow any email/password in demo mode with a generic user
      const genericUser: AuthUser = {
        id: `user-${Date.now()}`,
        email,
        name: email.split('@')[0],
        role: 'USER',
      };
      setUser(genericUser);
      setIsDemoMode(true);
      localStorage.setItem(DEMO_MODE_KEY, JSON.stringify(genericUser));
    }
  };

  const register = async (email: string, password: string, name: string) => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
    } catch {
      return demoLogin(email, password);
    }

    if (isBackendUnavailable(response)) {
      return demoLogin(email, password);
    }

    if (!response.ok) {
      const error = await safeJson(response);
      throw new Error(error?.error || `Registration failed (${response.status})`);
    }

    const data = await safeJson(response);
    if (!data?.data?.user) {
      return demoLogin(email, password);
    }
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_MODE_KEY);
    setUser(data.data.user);
  };

  const logout = async () => {
    if (!isDemoMode) {
      try {
        const csrf = getCookie('csrf-token');
        const headers: Record<string, string> = {};
        if (csrf) headers['X-CSRF-Token'] = csrf;

        await fetch(`${API_URL}/logout`, {
          method: 'POST',
          credentials: 'include',
          headers,
        });
      } catch {
        // Logout even if server call fails
      }
    }
    setUser(null);
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_MODE_KEY);
  };

  const updateUser = (updatedUser: AuthUser) => {
    setUser(updatedUser);
    if (isDemoMode) {
      localStorage.setItem(DEMO_MODE_KEY, JSON.stringify(updatedUser));
    }
  };

  const forgotPassword = async (email: string): Promise<{ resetToken?: string }> => {
    if (isDemoMode) {
      return { resetToken: 'demo-reset-token-123' };
    }
    let response: Response;
    try {
      response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
    } catch {
      return { resetToken: 'demo-reset-token-123' };
    }

    if (isBackendUnavailable(response)) {
      return { resetToken: 'demo-reset-token-123' };
    }

    if (!response.ok) {
      const error = await safeJson(response);
      throw new Error(error?.error || `Failed to send reset email (${response.status})`);
    }

    const data = await safeJson(response);
    return { resetToken: data?.resetToken };
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    if (isDemoMode) {
      return; // silently succeed in demo mode
    }
    let response: Response;
    try {
      response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword }),
      });
    } catch {
      return; // silently succeed if backend unavailable
    }

    if (isBackendUnavailable(response)) {
      return;
    }

    if (!response.ok) {
      const error = await safeJson(response);
      throw new Error(error?.error || `Failed to reset password (${response.status})`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isDemoMode,
        login,
        register,
        logout,
        updateUser,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
