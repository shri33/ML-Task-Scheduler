import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Resources from './pages/Resources';
import Analytics from './pages/Analytics';
import FogComputing from './pages/FogComputing';
import Devices from './pages/Devices';
import Profile from './pages/Profile';
import Login from './pages/Login';
import socketService from './lib/socket';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Keyboard shortcuts handler component
function KeyboardShortcutsHandler({ 
  onShowHelp 
}: { 
  onShowHelp: () => void;
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const shortcuts = [
    { key: 'd', action: () => isAuthenticated && navigate('/'), description: 'Go to Dashboard' },
    { key: 't', action: () => isAuthenticated && navigate('/tasks'), description: 'Go to Tasks' },
    { key: 'r', action: () => isAuthenticated && navigate('/resources'), description: 'Go to Resources' },
    { key: 'a', action: () => isAuthenticated && navigate('/analytics'), description: 'Go to Analytics' },
    { key: 'f', action: () => isAuthenticated && navigate('/fog-computing'), description: 'Go to Fog Computing' },
    { key: '?', shift: true, action: onShowHelp, description: 'Show keyboard shortcuts' },
    { key: '/', action: () => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, description: 'Focus search' },
  ];

  useKeyboardShortcuts(shortcuts);

  return null;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
      return () => {
        socketService.disconnect();
      };
    }
  }, [isAuthenticated]);

  return (
    <>
      <KeyboardShortcutsHandler onShowHelp={() => setShowShortcutsModal(true)} />
      <KeyboardShortcutsModal 
        isOpen={showShortcutsModal} 
        onClose={() => setShowShortcutsModal(false)} 
      />
      <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Layout>
              <Tasks />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources"
        element={
          <ProtectedRoute>
            <Layout>
              <Resources />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Layout>
              <Analytics />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fog-computing"
        element={
          <ProtectedRoute>
            <Layout>
              <FogComputing />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <Layout>
              <Devices />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
