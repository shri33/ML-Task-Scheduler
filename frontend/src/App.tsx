import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import NovaFloatingAssistant from './components/NovaFloatingAssistant';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Resources = lazy(() => import('./pages/Resources'));
const Analytics = lazy(() => import('./pages/Analytics'));
const FogComputing = lazy(() => import('./pages/FogComputing'));
const Devices = lazy(() => import('./pages/Devices'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));
const NotLoggedIn = lazy(() => import('./pages/NotLoggedIn'));
const Register = lazy(() => import('./pages/Register'));
const Experiments = lazy(() => import('./pages/Experiments'));
const MlMonitoring = lazy(() => import('./pages/MlMonitoring'));
const ChaosConsole = lazy(() => import('./pages/ChaosConsole'));
const Reports = lazy(() => import('./pages/Reports'));
const AlgorithmDetails = lazy(() => import('./pages/AlgorithmDetails'));
const Roles = lazy(() => import('./pages/Roles'));
const Permissions = lazy(() => import('./pages/Permissions'));
const FAQ = lazy(() => import('./pages/FAQ'));
const UserList = lazy(() => import('./pages/UserList'));
const UserView = lazy(() => import('./pages/UserView'));
const Chat = lazy(() => import('./pages/Chat'));
const Email = lazy(() => import('./pages/Email'));
const Kanban = lazy(() => import('./pages/Kanban'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading spinner for lazy loaded components
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/not-logged-in" replace state={{ from: location.pathname }} />;
  }

  return <PageErrorBoundary>{children}</PageErrorBoundary>;
}

import { SocketProvider } from './contexts/SocketContext';

// Keyboard shortcuts handler component
function KeyboardShortcutsHandler({ 
  onShowHelp 
}: { 
  onShowHelp: () => void;
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const shortcuts = [
    { key: 'd', action: () => isAuthenticated && navigate('/dashboard'), description: 'Go to Dashboard' },
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

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Set document title based on current route
  useDocumentTitle();

  return (
    <>
      <KeyboardShortcutsHandler onShowHelp={() => setShowShortcutsModal(true)} />
      <KeyboardShortcutsModal 
        isOpen={showShortcutsModal} 
        onClose={() => setShowShortcutsModal(false)} 
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public landing page — always visible at root */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
          <Route path="/not-logged-in" element={<NotLoggedIn />} />
          
          {/* Protected Routes wrapped in nested layout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/fog-computing" element={<FogComputing />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/ml-models" element={<MlMonitoring />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/chaos-console" element={<ChaosConsole />} />
            <Route path="/algorithm-details/:strategyId" element={<AlgorithmDetails />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/users/:id" element={<UserView />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/email" element={<Email />} />
            <Route path="/kanban" element={<Kanban />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {isAuthenticated && <NovaFloatingAssistant />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <Router>
                <AppRoutes />
              </Router>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
