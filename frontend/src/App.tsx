import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
        <Route
          path="/"
          element={<LandingPage />}
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/not-logged-in"
          element={<NotLoggedIn />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Layout>
                <Calendar />
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
        <Route
          path="/experiments"
          element={
            <ProtectedRoute>
              <Layout>
                <Experiments />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ml-models"
          element={
            <ProtectedRoute>
              <Layout>
                <MlMonitoring />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chaos-console"
          element={
            <ProtectedRoute>
              <Layout>
                <ChaosConsole />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/algorithm-details/:strategyId"
          element={
            <ProtectedRoute>
              <Layout>
                <AlgorithmDetails />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute>
              <Layout>
                <Roles />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/permissions"
          element={
            <ProtectedRoute>
              <Layout>
                <Permissions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faq"
          element={
            <ProtectedRoute>
              <Layout>
                <FAQ />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Layout>
                <UserList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <UserView />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout>
                <Chat />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/email"
          element={
            <ProtectedRoute>
              <Layout>
                <Email />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kanban"
          element={
            <ProtectedRoute>
              <Layout>
                <Kanban />
              </Layout>
            </ProtectedRoute>
          }
        />
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
