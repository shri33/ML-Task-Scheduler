import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  CheckCircle,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { IconBrandGoogle } from '../components/shared/BrandIcons';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type ViewMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

// ── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ value, label, isLight }: { value: string; label: string; isLight: boolean }) {
  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(52,211,153,0.15)' }}>
      <div
        className="font-light leading-none mb-[3px] text-[22px]"
        style={{
          fontFamily: "'Fraunces', serif",
          background: 'linear-gradient(135deg,#34d399,#6366f1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] tracking-[0.09em] uppercase"
        style={{ color: isLight ? 'rgba(17,24,39,0.40)' : 'rgba(247,244,239,0.35)' }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Input field ──────────────────────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  minLength,
  rightSlot,
  autoFocus,
  isLight,
}: {
  label: string;
  icon: React.ElementType;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
  autoFocus?: boolean;
  isLight: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        className="block text-[10px] font-medium tracking-[0.14em] uppercase mb-[5px] transition-colors duration-150"
        style={{
          color: focused
            ? isLight
              ? '#059669'
              : '#34d399'
            : isLight
              ? 'rgba(17,24,39,0.45)'
              : '#6b7280',
        }}
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          size={15}
          className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150"
          style={{
            color: focused
              ? isLight
                ? '#059669'
                : '#34d399'
              : isLight
                ? 'rgba(17,24,39,0.35)'
                : '#4b5563',
          }}
          strokeWidth={1.5}
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full py-[11px] pl-10 rounded-[10px] text-[13px] outline-none font-sans transition-[border-color,box-shadow] duration-150 box-border"
          style={{
            paddingRight: rightSlot ? 42 : 13,
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${
              focused
                ? isLight
                  ? 'rgba(5,150,105,0.5)'
                  : 'rgba(52,211,153,0.5)'
                : isLight
                  ? 'rgba(0,0,0,0.10)'
                  : 'rgba(255,255,255,0.08)'
            }`,
            color: isLight ? '#111827' : '#f9fafb',
            boxShadow: focused
              ? isLight
                ? '0 0 0 3px rgba(5,150,105,0.08)'
                : '0 0 0 3px rgba(52,211,153,0.08)'
              : 'none',
          }}
        />
        {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN LOGIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Login() {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    newPassword: '',
    confirmPassword: '',
  });

  const { login, register, forgotPassword, resetPassword } = useAuth();
  const toast = useToast();

  // ── Theme colors ──────────────────────────────────────────────────────────
  const theme = {
    bg: isLight ? '#f0fdf8' : '#0a0a0f',
    panel: isLight ? '#ffffff' : '#111118',
    accent: isLight ? '#059669' : '#34d399',
    text: isLight ? '#111827' : '#f9fafb',
    muted: isLight ? 'rgba(17,24,39,0.45)' : 'rgba(249,250,251,0.35)',
    border: isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)',
    inputBg: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    overlayGrad: isLight
      ? 'linear-gradient(to top, #f0fdf8 0%, rgba(240,253,248,0.8) 55%, transparent 100%)'
      : 'linear-gradient(to top, #0a0a0f 0%, rgba(10,10,15,0.75) 55%, transparent 100%)',
  };

  // ── Mouse parallax ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = leftPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  useEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // ── OAuth errors ──────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error');
    if (!oauthError) return;
    const map: Record<string, string> = {
      google_not_configured: 'Google login is not configured on server.',
      invalid_oauth_state: 'Google login validation failed. Please try again.',
      google_token_exchange_failed: 'Could not complete Google token exchange.',
      missing_google_access_token: 'Google did not return an access token.',
      google_profile_fetch_failed: 'Could not fetch your Google profile.',
      google_email_not_verified: 'Your Google email must be verified to continue.',
      account_deactivated: 'This account is deactivated. Contact support.',
      google_auth_failed: 'Google login failed. Please try again.',
    };
    toast.error('Google sign-in failed', map[oauthError] || 'Please try again.');
  }, [location.search, toast]);

  const handleGoogleLogin = () => {
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    window.location.href = `${apiBase}/api/v1/auth/google`;
  };

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
        if (result.resetToken) setResetToken(result.resetToken);
        toast.success('Reset email sent!', 'Check your email for password reset instructions.');
      } else if (viewMode === 'reset-password') {
        if (formData.newPassword !== formData.confirmPassword)
          throw new Error('Passwords do not match');
        await resetPassword(resetToken, formData.newPassword);
        toast.success('Password reset!', 'You can now login with your new password.');
        setViewMode('login');
        setFormData({ ...formData, email: '', password: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      toast.error(
        viewMode === 'login'
          ? 'Login failed'
          : viewMode === 'register'
            ? 'Registration failed'
            : viewMode === 'forgot-password'
              ? 'Reset request failed'
              : 'Password reset failed',
        error instanceof Error ? error.message : 'Please try again',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin = viewMode === 'login';
  const isRegister = viewMode === 'register';
  const isForgotPassword = viewMode === 'forgot-password';
  const isResetPassword = viewMode === 'reset-password';
  const showSocialBlock = isLogin || isRegister;

  const px = (mousePos.x - 0.5) * 24;
  const py = (mousePos.y - 0.5) * 24;

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="bg-transparent border-none cursor-pointer flex p-0"
      style={{ color: theme.muted }}
    >
      {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        .primary-btn {
          background: linear-gradient(135deg, #34d399, #6366f1);
          box-shadow: 0 4px 20px rgba(52,211,153,0.22);
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .primary-btn:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(52,211,153,0.32);
        }
        .primary-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

        .ghost-btn:hover { transform: translateY(-1px); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(.22,1,.36,1) both; }

        @keyframes morphing {
          0% {
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            border-radius: 60% 40% 50% 50% / 50% 60% 40% 60%;
            transform: translate(30px, -40px) scale(1.1);
          }
          100% {
            border-radius: 50% 50% 30% 70% / 60% 40% 60% 40%;
            transform: translate(-20px, 20px) scale(0.95);
          }
        }

        .login-root {
          background: ${theme.bg};
          color: ${theme.text};
          transition: background 0.35s, color 0.35s;
        }
        .login-hero {
          background: ${theme.bg};
          transition: background 0.35s;
        }
        .login-form {
          background: ${theme.panel};
          transition: background 0.35s, border-color 0.35s;
        }

        @media (max-width: 1024px) {
          .login-root { grid-template-columns: 1fr !important; height: auto !important; min-height: 100svh !important; }
          .login-hero { display: none !important; }
          .login-form { padding: 28px 24px !important; height: auto !important; min-height: 100svh !important; overflow: auto !important; }
          .login-form-content { max-width: 420px !important; }
        }

        @media (max-width: 640px) {
          .login-form { padding: 20px 16px !important; }
          .login-form-content { max-width: 100% !important; }
          .login-tab { padding: 7px 0 !important; font-size: 12px !important; }
          .primary-btn, .ghost-btn { padding-top: 10px !important; padding-bottom: 10px !important; font-size: 12px !important; }
        }
      `}</style>

      {/* ── Root ── */}
      <div className="login-root h-screen min-h-screen grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] font-sans relative overflow-hidden">
        {/* ── Theme toggle ── */}
        <button
          onClick={() => setIsLight(!isLight)}
          className="absolute top-4 right-4 z-[200] flex items-center gap-2 rounded-full px-3.5 py-[7px] cursor-pointer text-xs font-medium font-sans transition-all duration-200 border"
          style={{ background: theme.panel, borderColor: theme.border, color: theme.muted }}
        >
          {isLight ? <Moon size={13} strokeWidth={1.5} /> : <Sun size={13} strokeWidth={1.5} />}
          <div
            className="w-[30px] h-[17px] rounded-full relative transition-colors duration-[250ms]"
            style={{ background: isLight ? theme.accent : theme.border }}
          >
            <div
              className="absolute top-0.5 left-0.5 w-[13px] h-[13px] rounded-full bg-white transition-transform duration-[220ms]"
              style={{ transform: isLight ? 'translateX(13px)' : 'translateX(0)' }}
            />
          </div>
        </button>

        {/* ══════════════════════════════════════════════════
            LEFT — Spline 3D scene
        ══════════════════════════════════════════════════ */}
        <div
          className="login-hero relative overflow-hidden h-screen cursor-none"
          ref={leftPanelRef}
        >
          {/* Cursor glow */}
          <div
            className="absolute w-[280px] h-[280px] rounded-full pointer-events-none z-[5] -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)',
              left: `${mousePos.x * 100}%`,
              top: `${mousePos.y * 100}%`,
            }}
          />

          {/* Decorative rings */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: -100,
              right: -80,
              width: 420,
              height: 420,
              border: `1px solid ${isLight ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.25)'}`,
              transform: `translate(${px * 0.3}px, ${py * 0.3}px)`,
              transition: 'transform 0.12s ease-out, border-color 0.35s',
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: 80,
              right: -180,
              width: 600,
              height: 600,
              border: `1px solid ${isLight ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.18)'}`,
              transform: `translate(${px * 0.15}px, ${py * 0.15}px)`,
              transition: 'transform 0.18s ease-out, border-color 0.35s',
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              bottom: 60,
              left: -100,
              width: 360,
              height: 360,
              border: `1px solid ${isLight ? 'rgba(52,211,153,0.16)' : 'rgba(52,211,153,0.20)'}`,
              transform: `translate(${-px * 0.2}px, ${-py * 0.2}px)`,
              transition: 'transform 0.14s ease-out, border-color 0.35s',
            }}
          />

          {/* Logo top-left */}
          <div
            className="absolute top-8 left-9 z-20 flex items-center gap-2.5"
            style={{
              transform: `translate(${px * 0.08}px, ${py * 0.08}px)`,
              transition: 'transform 0.1s ease-out',
            }}
          >
            <div>
              <div
                className="text-sm font-semibold tracking-[-0.01em] transition-colors duration-[350ms]"
                style={{ color: theme.text }}
              >
                ML Task Scheduler
              </div>
              <div
                className="text-[10px] tracking-[0.08em] uppercase"
                style={{ color: 'rgba(52,211,153,0.75)' }}
              >
                Fog Computing Platform
              </div>
            </div>
          </div>

          {/* Spline viewer background */}
          <div
            className="absolute inset-0 z-[2] overflow-hidden pointer-events-none"
            style={{
              background: isLight
                ? 'radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(52, 211, 153, 0.08) 0%, transparent 45%)'
                : 'radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.16) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(52, 211, 153, 0.16) 0%, transparent 45%)',
            }}
          >
            <div
              className="absolute z-10 pointer-events-auto"
              style={{ top: '18%', left: '18%', width: '430px', height: '430px' }}
            >
              <spline-viewer
                url="https://prod.spline.design/f3-TNKs3z9ZsOMZq/scene.splinecode"
                logo="no"
                loading="eager"
                style={{
  width: "70vw",
  height: "85vh",
  display: "block",
  transformOrigin: "center center",
  position: "absolute",
  left: "-30%",
  top: "-17%",
}}
              />
            </div>
            <div
              className="absolute z-0 pointer-events-none"
              style={{
                top: '7%',
                left: '31%',
                width: '78%',
                height: '94%',
                background:
                  'linear-gradient(135deg, rgba(52, 211, 153, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
                borderRadius: '50% 40% 30% 60% / 50% 60% 40% 50%',
                filter: 'blur(45px)',
                animation: 'morphing 12s ease-in-out infinite alternate-reverse',
              }}
            />
          </div>

          {/* Bottom overlay — text + stats */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10 px-9 py-7"
            style={{ background: theme.overlayGrad, transition: 'background 0.35s' }}
          >
            <div
              style={{
                transform: `translate(${px * 0.05}px, ${py * 0.05}px)`,
                transition: 'transform 0.15s ease-out',
                marginBottom: 24,
              }}
            >
              <h1
                className="font-light leading-[1.12] mb-4 tracking-[-0.01em] text-[32px] transition-colors duration-[350ms]"
                style={{ fontFamily: "'Fraunces', serif", color: theme.text }}
              >
                Intelligent task
                <br />
                allocation for{' '}
                <em
                  className="italic transition-colors duration-[350ms]"
                  style={{ color: theme.accent }}
                >
                  fog.
                </em>
              </h1>
            </div>

            {/* Stats row */}
            <div className="flex gap-[22px]">
              <StatPill value="6" label="Algorithms" isLight={isLight} />
              <StatPill value="53+" label="API Endpoints" isLight={isLight} />
              <StatPill value="31%" label="Energy Saved" isLight={isLight} />
              <StatPill value="103" label="Tests Passing" isLight={isLight} />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            RIGHT — form panel
        ══════════════════════════════════════════════════ */}
        <div
          className="login-form flex flex-col justify-center items-center px-14 h-screen min-h-screen overflow-hidden box-border"
          style={{ background: theme.panel }}
        >
          <div className="login-form-content fade-up w-full max-w-[380px]">
            {/* Back button */}
            {(isForgotPassword || isResetPassword) && (
              <button
                className="inline-flex items-center gap-[5px] text-[11px] bg-transparent border-none cursor-pointer p-0 font-sans tracking-[0.04em] mb-3 transition-colors duration-150"
                style={{ color: theme.muted }}
                onClick={() => {
                  setViewMode('login');
                  setResetEmailSent(false);
                  setResetToken('');
                }}
              >
                <ArrowLeft size={12} strokeWidth={1.5} />
                Back to sign in
              </button>
            )}

            {/* Header — login / register */}
            {showSocialBlock && (
              <>
                <p
                  className="text-[10px] font-medium tracking-[0.18em] uppercase mb-2.5 transition-colors duration-[350ms]"
                  style={{ color: theme.accent }}
                >
                  {isLogin ? 'Welcome back' : 'Get started'}
                </p>
                <h2
                  className="font-light mb-3.5 leading-tight text-[26px] transition-colors duration-[350ms]"
                  style={{ fontFamily: "'Fraunces', serif", color: theme.text }}
                >
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </h2>

                {/* Tabs */}
                <div
                  className="flex gap-1 rounded-[10px] p-1 mb-3.5 transition-colors duration-[350ms]"
                  style={{ background: theme.inputBg }}
                >
                  {(['login', 'register'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className="login-tab flex-1 py-2 rounded-lg border text-[13px] font-medium font-sans cursor-pointer transition-colors duration-[180ms] tracking-wide"
                      style={{
                        background: viewMode === mode ? 'rgba(52,211,153,0.12)' : 'transparent',
                        color: viewMode === mode ? theme.accent : theme.muted,
                        borderColor: viewMode === mode ? 'rgba(52,211,153,0.22)' : 'transparent',
                      }}
                    >
                      {mode === 'login' ? 'Sign In' : 'Sign Up'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Forgot password header */}
            {isForgotPassword && !resetEmailSent && (
              <div className="mb-4">
                <p
                  className="text-[10px] font-medium tracking-[0.18em] uppercase mb-2.5"
                  style={{ color: theme.accent }}
                >
                  Password recovery
                </p>
                <h2
                  className="font-light text-[26px] mb-2"
                  style={{ fontFamily: "'Fraunces', serif", color: theme.text }}
                >
                  Forgot your password?
                </h2>
                <p className="text-xs leading-[1.65]" style={{ color: theme.muted }}>
                  Enter your email and we'll send reset instructions.
                </p>
              </div>
            )}

            {/* Reset password header */}
            {isResetPassword && (
              <div className="mb-4">
                <p
                  className="text-[10px] font-medium tracking-[0.18em] uppercase mb-2.5"
                  style={{ color: theme.accent }}
                >
                  Set new password
                </p>
                <h2
                  className="font-light text-[26px]"
                  style={{ fontFamily: "'Fraunces', serif", color: theme.text }}
                >
                  Reset password
                </h2>
              </div>
            )}

            {/* Email sent success */}
            {isForgotPassword && resetEmailSent ? (
              <div className="text-center pt-2">
                <div
                  className="w-[60px] h-[60px] rounded-full border flex items-center justify-center mx-auto mb-[18px]"
                  style={{
                    background: 'rgba(52,211,153,0.08)',
                    borderColor: 'rgba(52,211,153,0.22)',
                  }}
                >
                  <CheckCircle size={26} color={theme.accent} strokeWidth={1.5} />
                </div>
                <h3
                  className="font-light text-xl mb-2"
                  style={{ fontFamily: "'Fraunces', serif", color: theme.text }}
                >
                  Check your inbox
                </h3>
                <p className="text-xs leading-[1.65]" style={{ color: theme.muted }}>
                  Reset instructions sent to{' '}
                  <span style={{ color: theme.accent }}>{formData.email}</span>
                </p>
                {resetToken && import.meta.env.DEV && (
                  <div
                    className="mt-[18px] px-3.5 py-3 rounded-[10px] text-left border"
                    style={{ background: theme.inputBg, borderColor: theme.border }}
                  >
                    <p className="text-[10px] mb-1.5" style={{ color: theme.muted }}>
                      DEV MODE — reset token
                    </p>
                    <input
                      readOnly
                      value={resetToken}
                      className="w-full px-2.5 py-[7px] rounded-lg text-[11px] outline-none font-mono mb-2 box-border border"
                      style={{
                        background: theme.bg,
                        borderColor: theme.border,
                        color: theme.accent,
                      }}
                    />
                    <button
                      onClick={() => setViewMode('reset-password')}
                      className="text-xs bg-transparent border-none cursor-pointer font-sans p-0"
                      style={{ color: theme.accent }}
                    >
                      Continue to reset password →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Main form ── */
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                {/* Google + Demo — login/register only */}
                {showSocialBlock && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="ghost-btn p-[11px] rounded-[10px] text-[13px] font-normal cursor-pointer font-sans flex items-center justify-center gap-2 transition-[border-color,background,color,transform] duration-150 w-full border"
                      style={{
                        background: theme.inputBg,
                        borderColor: theme.border,
                        color: theme.muted,
                      }}
                    >
                      <IconBrandGoogle size={15} strokeWidth={1.5} />
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      className="ghost-btn p-[11px] rounded-[10px] text-[13px] font-normal cursor-pointer font-sans flex items-center justify-center gap-2 transition-[border-color,background,color,transform] duration-150 border"
                      style={{
                        background: theme.inputBg,
                        borderColor: 'rgba(52,211,153,0.20)',
                        color: theme.accent,
                      }}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          email: 'demo@example.com',
                          password: 'password123',
                          name: '',
                        });
                        setViewMode('login');
                      }}
                    >
                      <CheckCircle size={14} strokeWidth={1.5} />
                      Use Demo Account
                    </button>
                    <div
                      className="flex items-center gap-3 my-3.5 text-[11px] tracking-[0.08em]"
                      style={{ color: theme.muted }}
                    >
                      <div className="flex-1 h-px" style={{ background: theme.border }} />
                      or continue with email
                      <div className="flex-1 h-px" style={{ background: theme.border }} />
                    </div>
                  </>
                )}

                {/* Name — register */}
                {isRegister && (
                  <Field
                    label="Full name"
                    icon={User}
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(v) => setFormData({ ...formData, name: v })}
                    required={isRegister}
                    autoFocus={isRegister}
                    isLight={isLight}
                  />
                )}

                {/* Email */}
                {(isLogin || isRegister || isForgotPassword) && (
                  <Field
                    label="Email address"
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(v) => setFormData({ ...formData, email: v })}
                    required
                    autoFocus={isLogin || isForgotPassword}
                    isLight={isLight}
                  />
                )}

                {/* Password */}
                {(isLogin || isRegister) && (
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(v) => setFormData({ ...formData, password: v })}
                    required
                    minLength={8}
                    rightSlot={eyeToggle}
                    isLight={isLight}
                  />
                )}

                {/* Remember / forgot */}
                {isLogin && (
                  <div className="flex items-center justify-between">
                    <label
                      className="flex items-center gap-[7px] text-[11px] cursor-pointer"
                      style={{ color: theme.muted }}
                    >
                      <input
                        type="checkbox"
                        className="w-[13px] h-[13px]"
                        style={{ accentColor: theme.accent }}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      className="text-[11px] bg-transparent border-none cursor-pointer font-sans p-0 transition-opacity duration-150 hover:opacity-75"
                      style={{ color: theme.accent }}
                      onClick={() => setViewMode('forgot-password')}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* New / Confirm — reset */}
                {isResetPassword && (
                  <>
                    <Field
                      label="New password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.newPassword}
                      onChange={(v) => setFormData({ ...formData, newPassword: v })}
                      required
                      minLength={8}
                      rightSlot={eyeToggle}
                      autoFocus
                      isLight={isLight}
                    />
                    <Field
                      label="Confirm password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(v) => setFormData({ ...formData, confirmPassword: v })}
                      required
                      minLength={8}
                      isLight={isLight}
                    />
                  </>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="primary-btn w-full p-3 rounded-[10px] border-none text-[13px] font-semibold text-white cursor-pointer font-sans tracking-wide flex items-center justify-center gap-[7px] mt-0.5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />
                      {isLogin
                        ? 'Signing in…'
                        : isRegister
                          ? 'Creating account…'
                          : isForgotPassword
                            ? 'Sending…'
                            : 'Resetting…'}
                    </>
                  ) : (
                    <>
                      {isLogin
                        ? 'Sign In'
                        : isRegister
                          ? 'Create Account'
                          : isForgotPassword
                            ? 'Send Reset Link'
                            : 'Reset Password'}
                      <ArrowRight size={14} strokeWidth={1.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Switch mode */}
            {showSocialBlock && (
              <p className="text-center mt-3 text-xs" style={{ color: theme.muted }}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setViewMode(isLogin ? 'register' : 'login')}
                  className="bg-transparent border-none cursor-pointer font-sans text-xs p-0 font-medium transition-colors duration-[350ms]"
                  style={{ color: theme.accent }}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}

            {/* Footer */}
            <p
              className="text-center mt-3.5 text-[10px] opacity-30 tracking-[0.08em] uppercase"
              style={{ color: theme.muted }}
            >
              BITS Pilani Online · Team Byte_hogs · BSc CS
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
