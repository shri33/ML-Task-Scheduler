import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/resources': 'Resources',
  '/analytics': 'Analytics',
  '/fog-computing': 'Fog Computing',
  '/devices': 'Devices',
  '/experiments': 'Experiments',
  '/profile': 'Account Settings',
  '/login': 'Sign In',
  '/register': 'Sign Up',
};

/**
 * Sets document.title based on the current route.
 * Place once in the app (e.g. inside AppRoutes).
 */
export function useDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = 'ML Task Scheduler';
    const title = routeTitles[pathname];
    document.title = title ? `${title} — ${base}` : base;
  }, [pathname]);
}
