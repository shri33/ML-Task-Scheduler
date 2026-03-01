import { Navigate } from 'react-router-dom';

/**
 * Register page now redirects to Login, which has built-in Sign In / Sign Up tabs.
 * This avoids duplicate registration UIs with inconsistent styling.
 */
export default function Register() {
  // Redirect to login — the Login component handles registration via its built-in tabs
  return <Navigate to="/login" replace />;
}


