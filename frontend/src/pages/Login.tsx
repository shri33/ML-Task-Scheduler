import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';
import Spline from '@splinetool/react-spline';
import {
  IconBrain,
  IconMail,
  IconLock,
  IconUser,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconArrowLeft,
  IconCircleCheck,
  IconBrandGoogle,
  IconArrowRight,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

class SplineErrorBoundary extends Component<{ children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(err: Error, _errorInfo: ErrorInfo) {
    console.warn('Spline failed to load:', err);
    this.setState({ failed: true });
  }
  render() {
    if (this.state.failed) return null; // silently hide, rest of page works
    return this.props.children;
  }
}

type ViewMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

// ── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ value, label, isLight }: { value: string; label: string; isLight: boolean }) {
  return (
    <div style={{ borderTop: '1px solid rgba(52,211,153,0.15)', paddingTop: 12 }}>
      <div
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 22,
          fontWeight: 300,
          background: 'linear-gradient(135deg,#34d399,#6366f1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          marginBottom: 3,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: isLight ? 'rgba(17,24,39,0.40)' : 'rgba(247,244,239,0.35)',
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
        }}
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
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: focused
            ? isLight ? '#059669' : '#34d399'
            : isLight ? 'rgba(17,24,39,0.45)' : '#6b7280',
          marginBottom: 5,
          transition: 'color 0.15s',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon
          size={15}
          style={{
            position: 'absolute',
            left: 13,
            top: '50%',
            transform: 'translateY(-50%)',
            color: focused
              ? isLight ? '#059669' : '#34d399'
              : isLight ? 'rgba(17,24,39,0.35)' : '#4b5563',
            transition: 'color 0.15s',
            pointerEvents: 'none',
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
          style={{
            width: '100%',
            padding: '11px 13px 11px 40px',
            paddingRight: rightSlot ? 42 : 13,
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${
              focused
                ? isLight ? 'rgba(5,150,105,0.5)' : 'rgba(52,211,153,0.5)'
                : isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'
            }`,
            borderRadius: 10,
            fontSize: 13,
            color: isLight ? '#111827' : '#f9fafb',
            outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxSizing: 'border-box',
            boxShadow: focused
              ? isLight ? '0 0 0 3px rgba(5,150,105,0.08)' : '0 0 0 3px rgba(52,211,153,0.08)'
              : 'none',
          }}
        />
        {rightSlot && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            {rightSlot}
          </div>
        )}
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
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const splineRef = useRef<any>(null);
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
    bg:       isLight ? '#f0fdf8'             : '#0a0a0f',
    panel:    isLight ? '#ffffff'             : '#111118',
    accent:   isLight ? '#059669'             : '#34d399',
    text:     isLight ? '#111827'             : '#f9fafb',
    muted:    isLight ? 'rgba(17,24,39,0.45)' : 'rgba(249,250,251,0.35)',
    border:   isLight ? 'rgba(0,0,0,0.10)'   : 'rgba(255,255,255,0.08)',
    inputBg:  isLight ? 'rgba(0,0,0,0.04)'   : 'rgba(255,255,255,0.04)',
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
      google_not_configured:       'Google login is not configured on server.',
      invalid_oauth_state:         'Google login validation failed. Please try again.',
      google_token_exchange_failed:'Could not complete Google token exchange.',
      missing_google_access_token: 'Google did not return an access token.',
      google_profile_fetch_failed: 'Could not fetch your Google profile.',
      google_email_not_verified:   'Your Google email must be verified to continue.',
      account_deactivated:         'This account is deactivated. Contact support.',
      google_auth_failed:          'Google login failed. Please try again.',
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
        viewMode === 'login'           ? 'Login failed'
          : viewMode === 'register'    ? 'Registration failed'
          : viewMode === 'forgot-password' ? 'Reset request failed'
          : 'Password reset failed',
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin        = viewMode === 'login';
  const isRegister     = viewMode === 'register';
  const isForgotPassword = viewMode === 'forgot-password';
  const isResetPassword  = viewMode === 'reset-password';
  const showSocialBlock  = isLogin || isRegister;

  const px = (mousePos.x - 0.5) * 24;
  const py = (mousePos.y - 0.5) * 24;

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: theme.muted, display: 'flex', padding: 0,
      }}
    >
      {showPassword
        ? <IconEyeOff size={15} strokeWidth={1.5} />
        : <IconEye    size={15} strokeWidth={1.5} />}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        .login-tab {
          flex: 1; padding: 8px 0; border-radius: 8px; border: none;
          background: transparent; font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.18s; letter-spacing: 0.02em;
        }
        .primary-btn {
          width: 100%; padding: 12px;
          background: linear-gradient(135deg, #34d399, #6366f1);
          border: none; border-radius: 10px;
          font-size: 13px; font-weight: 600; color: #fff;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.01em;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          box-shadow: 0 4px 20px rgba(52,211,153,0.22);
        }
        .primary-btn:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(52,211,153,0.32);
        }
        .primary-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

        .ghost-btn {
          width: 100%; padding: 11px;
          border-radius: 10px; font-size: 13px; font-weight: 400;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
        }
        .ghost-btn:hover { transform: translateY(-1px); }

        .back-btn {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; background: none; border: none; cursor: pointer;
          padding: 0; font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.04em; margin-bottom: 12px; transition: color 0.15s;
        }

        .divider-row {
          display: flex; align-items: center; gap: 12px;
          margin: 14px 0; font-size: 11px; letter-spacing: 0.08em;
        }
        .divider-row div { flex: 1; height: 1px; }

        .forgot-link {
          font-size: 11px; background: none; border: none;
          cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0;
          transition: opacity 0.15s; color: #34d399;
        }
        .forgot-link:hover { opacity: 0.75; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(.22,1,.36,1) both; }

        @keyframes floatAnim {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        .float-anim { animation: floatAnim 3.5s ease-in-out infinite; }

        .ring {
          position: absolute; border-radius: 50%;
          border: none;
          pointer-events: none;
        }

        .cursor-glow {
          position: absolute; width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%);
          pointer-events: none; z-index: 5;
          transform: translate(-50%, -50%);
        }

        .toggle-btn {
          position: absolute; top: 16px; right: 16px; z-index: 200;
          display: flex; align-items: center; gap: 8px;
          border-radius: 999px; padding: 7px 14px;
          cursor: pointer; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          transition: all 0.2s; border: 1px solid;
        }
        .toggle-track {
          width: 30px; height: 17px; border-radius: 999px;
          position: relative; transition: background 0.25s;
        }
        .toggle-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 13px; height: 13px; border-radius: 50%;
          background: #fff; transition: transform 0.22s;
        }

        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          font-family: 'DM Sans', sans-serif;
          background: ${theme.bg};
          color: ${theme.text};
          transition: background 0.35s, color 0.35s;
          position: relative;
          overflow: hidden;
        }
        .login-hero {
          position: relative;
          overflow: hidden;
          background: ${theme.bg};
          transition: background 0.35s;
          cursor: none;
        }
        .login-form {
          background: ${theme.panel};
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 37px 60px 32px 1px;
          min-height: 100vh;
          overflow-y: hidden;
          transition: background 0.35s, border-color 0.35s;
        }
        .login-form-content {
          width: 100%;
          max-width: 340px;
        }

        @media (max-width: 1024px) {
          .login-root {
            grid-template-columns: 1fr;
          }
          .login-hero {
            display: none;
          }
          .login-form {
            padding: 28px 24px;
            min-height: 100svh;
          }
          .login-form-content {
            max-width: 420px;
          }
        }

        @media (max-width: 640px) {
          .login-form {
            padding: 20px 16px;
          }
          .login-form-content {
            max-width: 100%;
          }
          .login-tab {
            padding: 7px 0;
            font-size: 12px;
          }
          .primary-btn,
          .ghost-btn {
            padding-top: 10px;
            padding-bottom: 10px;
            font-size: 12px;
          }
        }

        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Root ── */}
      <div
        className="login-root"
      >

        {/* ── Theme toggle ── */}
        <button
          className="toggle-btn"
          onClick={() => setIsLight(!isLight)}
          style={{
            background: theme.panel,
            borderColor: theme.border,
            color: theme.muted,
          }}
        >
          {isLight
            ? <IconMoon size={13} strokeWidth={1.5} />
            : <IconSun  size={13} strokeWidth={1.5} />}
          <div
            className="toggle-track"
            style={{ background: isLight ? theme.accent : theme.border }}
          >
            <div
              className="toggle-thumb"
              style={{ transform: isLight ? 'translateX(13px)' : 'translateX(0)' }}
            />
          </div>
        </button>

        {/* ══════════════════════════════════════════════════
            LEFT — Spline 3D scene
        ══════════════════════════════════════════════════ */}
        <div
          className="login-hero"
          ref={leftPanelRef}
          style={{}}
        >
          {/* Cursor glow */}
          <div
            className="cursor-glow"
            style={{
              left: `${mousePos.x * 100}%`,
              top:  `${mousePos.y * 100}%`,
            }}
          />

          {/* Decorative rings */}
          <div className="ring" style={{
            top: -100, right: -80, width: 420, height: 420,
            transform: `translate(${px * 0.3}px, ${py * 0.3}px)`,
            transition: 'transform 0.12s ease-out',
          }} />
          <div className="ring" style={{
            top: 80, right: -180, width: 600, height: 600,
            transform: `translate(${px * 0.15}px, ${py * 0.15}px)`,
            transition: 'transform 0.18s ease-out',
          }} />
          <div className="ring" style={{
            bottom: 60, left: -100, width: 360, height: 360,
            transform: `translate(${-px * 0.2}px, ${-py * 0.2}px)`,
            transition: 'transform 0.14s ease-out',
          }} />

          {/* Logo top-left */}
          <div
            style={{
              position: 'absolute', top: 32, left: 36, zIndex: 20,
              display: 'flex', alignItems: 'center', gap: 10,
              transform: `translate(${px * 0.08}px, ${py * 0.08}px)`,
              transition: 'transform 0.1s ease-out',
            }}
          >
          
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', transition: 'color 0.35s' }}>
                ML Task Scheduler
              </div>
              <div style={{ fontSize: 10, color: 'rgba(52,211,153,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Fog Computing Platform
              </div>
            </div>
          </div>

          {/* Spline 3D scene */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <SplineErrorBoundary>
            <Spline
              scene="https://prod.spline.design/jpIU5vC4VhqeXNkc/scene.splinecode"
              onLoad={(spline) => {
                splineRef.current = spline;
                setSplineLoaded(true);
              }}
              style={{ position: 'absolute', inset: 0, width: '90%', height: '90%',left:'20%',top:'8%' }}
            />
            </SplineErrorBoundary>
            {/* Loading shimmer */}
            {!splineLoaded && (
              <div style={{
                position: 'absolute', inset: 0,
                background: theme.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16,
                transition: 'background 0.35s',
              }}>
                <div
                  className="float-anim"
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'linear-gradient(135deg,#34d399,#6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(52,211,153,0.28)',
                  }}
                >
                  <IconBrain size={24} color="#fff" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 12, color: 'rgba(52,211,153,0.6)', letterSpacing: '0.1em' }}>
                  LOADING …
                </p>
              </div>
            )}
          </div>

          {/* Bottom overlay — text + stats */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
            padding: '28px 36px',
            background: theme.overlayGrad,
            transition: 'background 0.35s',
          }}>
            <div style={{
              transform: `translate(${px * 0.05}px, ${py * 0.05}px)`,
              transition: 'transform 0.15s ease-out',
              marginBottom: 24,
            }}>
              
              <h1 style={{
                fontFamily: "'Fraunces', serif", fontWeight: 300,
                fontSize: 32, lineHeight: 1.12, color: theme.text,
                marginBottom: 16, letterSpacing: '-0.01em',
                transition: 'color 0.35s',
              }}>
                Intelligent task<br />allocation for{' '}
                <em style={{ fontStyle: 'italic', color: theme.accent, transition: 'color 0.35s' }}>fog.</em>
              </h1>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 22 }}>
              <StatPill value="6"   label="Algorithms"   isLight={isLight} />
              <StatPill value="53+" label="API Endpoints" isLight={isLight} />
              <StatPill value="31%" label="Energy Saved"  isLight={isLight} />
              <StatPill value="103" label="Tests Passing" isLight={isLight} />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            RIGHT — form panel
        ══════════════════════════════════════════════════ */}
        <div
          className="login-form"
          style={{
            background: theme.panel,
          }}
        >
          <div className="login-form-content fade-up">

            {/* Back button */}
            {(isForgotPassword || isResetPassword) && (
              <button
                className="back-btn"
                style={{ color: theme.muted }}
                onClick={() => {
                  setViewMode('login');
                  setResetEmailSent(false);
                  setResetToken('');
                }}
              >
                <IconArrowLeft size={12} strokeWidth={1.5} />
                Back to sign in
              </button>
            )}

            {/* Header — login / register */}
            {showSocialBlock && (
              <>
                <p style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: '0.18em',
                  color: theme.accent, textTransform: 'uppercase', marginBottom: 10,
                  transition: 'color 0.35s',
                }}>
                  {isLogin ? 'Welcome back' : 'Get started'}
                </p>
                <h2 style={{
                  fontFamily: "'Fraunces', serif", fontSize: 26,
                  fontWeight: 300, color: theme.text,
                  marginBottom: 14, lineHeight: 1.2, transition: 'color 0.35s',
                }}>
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </h2>

                {/* Tabs */}
                <div style={{
                  display: 'flex', gap: 4,
                  background: theme.inputBg,
                  borderRadius: 10, padding: 4, marginBottom: 14,
                  transition: 'background 0.35s',
                }}>
                  {(['login', 'register'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      className="login-tab"
                      onClick={() => setViewMode(mode)}
                      style={{
                        background: viewMode === mode ? 'rgba(52,211,153,0.12)' : 'transparent',
                        color: viewMode === mode ? theme.accent : theme.muted,
                        border: viewMode === mode ? '1px solid rgba(52,211,153,0.22)' : '1px solid transparent',
                        transition: 'color 0.35s',
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
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', color: theme.accent, textTransform: 'uppercase', marginBottom: 10 }}>
                  Password recovery
                </p>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 300, color: theme.text, marginBottom: 8 }}>
                  Forgot your password?
                </h2>
                <p style={{ fontSize: 12, color: theme.muted, lineHeight: 1.65 }}>
                  Enter your email and we'll send reset instructions.
                </p>
              </div>
            )}

            {/* Reset password header */}
            {isResetPassword && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', color: theme.accent, textTransform: 'uppercase', marginBottom: 10 }}>
                  Set new password
                </p>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 300, color: theme.text }}>
                  Reset password
                </h2>
              </div>
            )}

            {/* Email sent success */}
            {isForgotPassword && resetEmailSent ? (
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                }}>
                  <IconCircleCheck size={26} color={theme.accent} strokeWidth={1.5} />
                </div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 300, color: theme.text, marginBottom: 8 }}>
                  Check your inbox
                </h3>
                <p style={{ fontSize: 12, color: theme.muted, lineHeight: 1.65 }}>
                  Reset instructions sent to{' '}
                  <span style={{ color: theme.accent }}>{formData.email}</span>
                </p>
                {resetToken && import.meta.env.DEV && (
                  <div style={{
                    marginTop: 18, padding: '12px 14px',
                    background: theme.inputBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10, textAlign: 'left',
                  }}>
                    <p style={{ fontSize: 10, color: theme.muted, marginBottom: 6 }}>DEV MODE — reset token</p>
                    <input
                      readOnly value={resetToken}
                      style={{
                        width: '100%', padding: '7px 10px',
                        background: theme.bg, border: `1px solid ${theme.border}`,
                        borderRadius: 8, fontSize: 11, color: theme.accent,
                        fontFamily: 'monospace', outline: 'none',
                        marginBottom: 8, boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => setViewMode('reset-password')}
                      style={{ fontSize: 12, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0 }}
                    >
                      Continue to reset password →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Main form ── */
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Google + Demo — login/register only */}
                {showSocialBlock && (
                  <>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={handleGoogleLogin}
                      style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.muted }}
                    >
                      <IconBrandGoogle size={15} strokeWidth={1.5} />
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      style={{ background: theme.inputBg, border: '1px solid rgba(52,211,153,0.20)', color: theme.accent }}
                      onClick={() => {
                        setFormData({ ...formData, email: 'demo@example.com', password: 'password123', name: '' });
                        setViewMode('login');
                      }}
                    >
                      <IconCircleCheck size={14} strokeWidth={1.5} />
                      Use Demo Account
                    </button>
                    <div className="divider-row" style={{ color: theme.muted }}>
                      <div style={{ background: theme.border }} />
                      or continue with email
                      <div style={{ background: theme.border }} />
                    </div>
                  </>
                )}

                {/* Name — register */}
                {isRegister && (
                  <Field
                    label="Full name" icon={IconUser}
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(v) => setFormData({ ...formData, name: v })}
                    required={isRegister} autoFocus={isRegister}
                    isLight={isLight}
                  />
                )}

                {/* Email */}
                {(isLogin || isRegister || isForgotPassword) && (
                  <Field
                    label="Email address" icon={IconMail}
                    type="email" placeholder="you@example.com"
                    value={formData.email}
                    onChange={(v) => setFormData({ ...formData, email: v })}
                    required autoFocus={isLogin || isForgotPassword}
                    isLight={isLight}
                  />
                )}

                {/* Password */}
                {(isLogin || isRegister) && (
                  <Field
                    label="Password" icon={IconLock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(v) => setFormData({ ...formData, password: v })}
                    required minLength={8} rightSlot={eyeToggle}
                    isLight={isLight}
                  />
                )}

                {/* Remember / forgot */}
                {isLogin && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: theme.muted, cursor: 'pointer' }}>
                      <input type="checkbox" style={{ accentColor: theme.accent, width: 13, height: 13 }} />
                      Remember me
                    </label>
                    <button
                      type="button"
                      className="forgot-link"
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
                      label="New password" icon={IconLock}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.newPassword}
                      onChange={(v) => setFormData({ ...formData, newPassword: v })}
                      required minLength={8} rightSlot={eyeToggle} autoFocus
                      isLight={isLight}
                    />
                    <Field
                      label="Confirm password" icon={IconLock}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(v) => setFormData({ ...formData, confirmPassword: v })}
                      required minLength={8}
                      isLight={isLight}
                    />
                  </>
                )}

                {/* Submit */}
                <button type="submit" className="primary-btn" disabled={isLoading} style={{ marginTop: 2 }}>
                  {isLoading ? (
                    <>
                      <IconLoader2 size={15} strokeWidth={1.5} className="animate-spin" />
                      {isLogin ? 'Signing in…' : isRegister ? 'Creating account…' : isForgotPassword ? 'Sending…' : 'Resetting…'}
                    </>
                  ) : (
                    <>
                      {isLogin ? 'Sign In' : isRegister ? 'Create Account' : isForgotPassword ? 'Send Reset Link' : 'Reset Password'}
                      <IconArrowRight size={14} strokeWidth={1.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Switch mode */}
            {showSocialBlock && (
              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: theme.muted }}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setViewMode(isLogin ? 'register' : 'login')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: theme.accent, fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12, padding: 0, fontWeight: 500,
                    transition: 'color 0.35s',
                  }}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}

            {/* Footer */}
            <p style={{
              textAlign: 'center', marginTop: 14, fontSize: 10,
              color: theme.muted, opacity: 0.3,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              BITS Pilani Online · Team Byte_hogs · BSc CS
            </p>
          </div>
        </div>
      </div>
    </>
  );
}