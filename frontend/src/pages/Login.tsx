import { useState } from 'react';
import { Brain, Mail, Lock, User, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { clsx } from 'clsx';

type ViewMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

export default function Login() {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    newPassword: '',
    confirmPassword: '',
  });

  const { login, register, forgotPassword, resetPassword } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (viewMode === 'login') {
        await login(formData.email, formData.password);
        toast.success('Welcome back!', 'You have been logged in successfully.');
      } else if (viewMode === 'register') {
        await register(formData.email, formData.password, formData.name);
        toast.success('Account created!', 'Welcome to ML Task Scheduler.');
      } else if (viewMode === 'forgot-password') {
        const result = await forgotPassword(formData.email);
        setResetEmailSent(true);
        if (result.resetToken) {
          setResetToken(result.resetToken);
        }
        toast.success('Reset email sent!', 'Check your email for password reset instructions.');
      } else if (viewMode === 'reset-password') {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await resetPassword(resetToken, formData.newPassword);
        toast.success('Password reset!', 'You can now login with your new password.');
        setViewMode('login');
        setFormData({ ...formData, email: '', password: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      toast.error(
        viewMode === 'login' ? 'Login failed' : 
        viewMode === 'register' ? 'Registration failed' :
        viewMode === 'forgot-password' ? 'Reset request failed' :
        'Password reset failed',
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin = viewMode === 'login';
  const isRegister = viewMode === 'register';
  const isForgotPassword = viewMode === 'forgot-password';
  const isResetPassword = viewMode === 'reset-password';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ML Task Scheduler
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Intelligent task allocation with fog computing
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Back button for forgot/reset password */}
          {(isForgotPassword || isResetPassword) && (
            <button
              onClick={() => {
                setViewMode('login');
                setResetEmailSent(false);
                setResetToken('');
              }}
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
          )}

          {/* Tabs - only show for login/register */}
          {(isLogin || isRegister) && (
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
              <button
                onClick={() => setViewMode('login')}
                className={clsx(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                  isLogin
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => setViewMode('register')}
                className={clsx(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                  isRegister
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Forgot Password Header */}
          {isForgotPassword && !resetEmailSent && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Forgot Password</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Enter your email and we'll send you a reset link
              </p>
            </div>
          )}

          {/* Reset Email Sent Success */}
          {isForgotPassword && resetEmailSent && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Check your email</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                We've sent password reset instructions to {formData.email}
              </p>
              {resetToken && import.meta.env.DEV && (
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Development Mode - Reset Token:</p>
                  <input
                    type="text"
                    value={resetToken}
                    readOnly
                    className="w-full text-xs p-2 bg-white dark:bg-gray-600 rounded border text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => setViewMode('reset-password')}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Continue to reset password →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reset Password Header */}
          {isResetPassword && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Enter your new password
              </p>
            </div>
          )}

          {/* Form */}
          {!(isForgotPassword && resetEmailSent) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="John Doe"
                    required={isRegister}
                  />
                </div>
              </div>
            )}

            {(isLogin || isRegister || isForgotPassword) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            )}

            {(isLogin || isRegister) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            )}

            {isResetPassword && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      className="w-full pl-10 pr-12 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
              </>
            )}

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setViewMode('forgot-password')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isLogin ? 'Signing in...' : 
                   isRegister ? 'Creating account...' :
                   isForgotPassword ? 'Sending...' :
                   'Resetting...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 
                   isRegister ? 'Create Account' :
                   isForgotPassword ? 'Send Reset Link' :
                   'Reset Password'}
                </>
              )}
            </button>
          </form>
          )}

          {/* Divider - only show for login/register */}
          {(isLogin || isRegister) && (
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>
          )}

          {/* Demo Account - only show for login/register */}
          {(isLogin || isRegister) && (
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, email: 'demo@example.com', password: 'password123', name: '' });
              setViewMode('login');
            }}
            className="w-full py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Use Demo Account
          </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
