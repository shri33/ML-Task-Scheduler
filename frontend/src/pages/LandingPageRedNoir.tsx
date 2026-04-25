import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Github, CheckCircle, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LandingPageRedNoir() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isDemoMode } = useAuth();
  const toast = useToast();
  const [showAuthChooser, setShowAuthChooser] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const isRealUser = isAuthenticated && !isDemoMode && !!user;
  const avatarSeed = user?.name || user?.email || 'User';
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=ef233c&textColor=ffffff`;

  const openAuthChooser = () => setShowAuthChooser(true);

  const handleDemoLogin = async () => {
    try {
      setAuthLoading(true);
      await login('demo@example.com', 'password123');
      toast.success('Demo login successful', 'Welcome to the dashboard.');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Demo login failed', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setAuthLoading(false);
      setShowAuthChooser(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/v1/auth/google`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-inter relative overflow-x-hidden selection-red">
      
      {/* ════════════════════════
          GLOBAL BACKGROUND
      ════════════════════════ */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0505] to-black"></div>
        
        {/* Animated stars */}
        <div className="absolute top-0 left-0 w-[1px] h-[1px] bg-transparent opacity-30" 
          style={{
            boxShadow: '234px 124px #fff, 654px 345px #fff, 876px 12px #fff, 1200px 800px #fff, 400px 1500px #fff, 1800px 200px #fff, 100px 1000px #fff, 900px 1900px #fff, 500px 600px #fff, 1400px 100px #fff, 300px 400px #fff, 1600px 1200px #fff',
            animation: 'animStar 50s linear infinite'
          }}
        ></div>
        
        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ef233c]/5 rounded-full blur-[120px]"></div>
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_80%)]"></div>
      </div>

      {/* ════════════════════════
          TOP BLUR HEADER
      ════════════════════════ */}
      <div className="fixed inset-0 z-40 top-0 h-[120px] pointer-events-none bg-gradient-to-b from-black/80 to-transparent backdrop-blur-lg mask-image-[linear-gradient(to_bottom,black,transparent)]"></div>

      {/* ════════════════════════
          NAVBAR
      ════════════════════════ */}
      <header className="fixed top-0 left-0 w-full z-50 pt-6 px-4">
        <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45"></div>
            <span className="text-lg font-bold font-manrope tracking-tight">ML Task Scheduler</span>
          </div>
          
          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8  bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3">
            <a href="#features" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#algorithms" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Algorithms</a>
            <a href="#team" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Team</a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isRealUser ? (
              <button
                onClick={() => navigate('/profile')}
                className="hidden md:flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl transition hover:border-[#ef233c]/60 hover:bg-black/80"
              >
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="h-8 w-8 rounded-full border border-white/10 object-cover"
                />
                <div className="text-left leading-tight">
                  <div className="text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Account</div>
                </div>
              </button>
            ) : (
              <button
                onClick={openAuthChooser}
                className="hidden md:block text-sm font-medium text-zinc-300 hover:text-white"
              >
                Log In
              </button>
            )}

            <button
              onClick={() => navigate('/login')}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white/5 px-6 py-2 transition-transform active:scale-95"
            >
              <span className="absolute inset-0 border border-white/10 rounded-full"></span>
              <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ef233c_100%)] opacity-0 group-hover:opacity-100 transition-opacity"></span>
              <span className="absolute inset-[1px] rounded-full bg-black"></span>
              <span className="relative z-10 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                Launch App <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ════════════════════════
            HERO SECTION
        ════════════════════════ */}
        <section className="min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-6">
          <div className="text-center max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef233c]"></span>
              </span>
              <span className="text-xs font-medium text-red-100/90 tracking-wide font-manrope">
                BITS Pilani Online · BSc CS · Team Byte_hogs
              </span>
              <ArrowRight className="w-3 h-3 text-red-400" />
            </div>

            {/* Headline */}
            <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter font-manrope leading-[1.1] mb-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">Intelligent Task</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">
                Allocation for <span className="text-[#ef233c] inline-block relative">
                  Fog
                  <svg className="absolute w-full h-3 -bottom-2 left-0 text-[#ef233c] opacity-60" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-up" style={{ animationDelay: '0.3s' }}>
              A production-grade system with 6 bio-inspired scheduling algorithms, 3 ML models, and a full telemetry pipeline — based on Wang & Li (2019).
            </p>

            {/* CTAs */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={openAuthChooser}
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8 py-4 transition-transform active:scale-95"
              >
                <span className="absolute inset-0 border border-white/10 rounded-full"></span>
                <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ef233c_100%)] opacity-100"></span>
                <span className="absolute inset-[2px] rounded-full bg-gradient-to-b from-[#24030a] via-[#0a0002] to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-8px_16px_rgba(0,0,0,0.65),inset_0_0_18px_rgba(239,35,60,0.14)]"></span>
                <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(120%_90%_at_50%_-20%,rgba(255,255,255,0.22),transparent_50%)]"></span>
                <span className="relative z-10 flex items-center gap-2 font-medium text-white">
                  Enter the System
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
              
              <a
                href="https://github.com/shri33/ML-Task-Scheduler"
                target="_blank"
                rel="noreferrer"
                className="group px-8 py-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
            </div>

            {/* Demo credentials */}
            <p className="text-sm text-gray-400 mt-6">
              Demo:{' '}
              <code className="font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded">demo@example.com</code> /{' '}
              <code className="font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded">password123</code>
            </p>
          </div>

          {/* Logo Strip */}
          <div className="w-full mt-32 border-y border-white/5 bg-white/[0.02] backdrop-blur-sm py-10 opacity-60 hover:opacity-100 transition-opacity">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <p className="text-sm font-bold tracking-widest text-zinc-500 uppercase shrink-0">Built with:</p>
              <div className="flex flex-wrap justify-center gap-8 md:gap-16 items-center w-full text-sm font-semibold text-zinc-400">
                <span>React 18</span>
                <span>TypeScript</span>
                <span>Node.js</span>
                <span>Python</span>
                <span>PostgreSQL</span>
                <span>Redis</span>
                <span>Docker</span>
                <span>scikit-learn</span>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            FEATURES SECTION
        ════════════════════════ */}
        <section id="features" className="py-32 px-6 scroll-mt-28">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 text-center max-w-3xl mx-auto animate-fade-up">
              <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight font-manrope mb-6">
                The Platform for<br />
                <span className="text-[#ef233c]">Intelligent Scheduling</span>
              </h2>
              <p className="text-lg text-zinc-400 font-light">
                Replace fragmented tools with one cohesive research-grade system.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Main Feature */}
              <div className="lg:col-span-2 lg:row-span-2 group relative overflow-hidden p-8 border border-white/10 bg-gradient-to-b from-zinc-900/50 to-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10 h-full flex flex-col">
                  <div className="mb-6 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-[#ef233c]">
                    <Brain className="w-6 h-6" />
                  </div>
                  <h3 className="text-3xl font-semibold text-white font-manrope mb-4 tracking-tight">Bio-Inspired Scheduling</h3>
                  <p className="text-zinc-400 text-lg leading-relaxed">6 algorithms — IPSO, IACO, Hybrid HH, FCFS, Round-Robin, Min-Min — delivering up to 31% energy reduction over baseline.</p>
                  <div className="mt-auto flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                    <span className="text-xs font-mono text-[#ef233c]">EXPLORE FEATURE</span>
                    <ArrowRight className="w-4 h-4 text-[#ef233c]" />
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" style={{ background: 'radial-gradient(circle at top right, #ef233c, transparent 70%)' }}></div>
              </div>

              {/* Feature 2 */}
              <div className="lg:col-span-2 group relative overflow-hidden p-8 border border-white/10 bg-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-4 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-blue-400">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-white font-manrope mb-2">ML Prediction Engine</h3>
                  <p className="text-zinc-400">Random Forest, XGBoost & Gradient Boosting with SHAP explainability, Optuna tuning, and conformal prediction.</p>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" style={{ background: 'radial-gradient(circle at top right, #3b82f6, transparent 70%)' }}></div>
              </div>

              {/* Feature 3 */}
              <div className="group relative overflow-hidden p-8 border border-white/10 bg-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10">
                  <div className="mb-4 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-sky-400">
                    <span className="text-2xl">☁️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white font-manrope mb-2">3-Layer Fog Architecture</h3>
                  <p className="text-sm text-zinc-400">Terminal devices → fog nodes → cloud with fault tolerance analysis and real-time load balancing.</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="group relative overflow-hidden p-8 border border-white/10 bg-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10">
                  <div className="mb-4 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-emerald-400">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white font-manrope mb-2">Live Telemetry</h3>
                  <p className="text-sm text-zinc-400">Prometheus + Grafana pipeline with WebSocket live updates and historical analytics.</p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="group relative overflow-hidden p-8 border border-white/10 bg-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10">
                  <div className="mb-4 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-amber-400">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white font-manrope mb-2">Production Security</h3>
                  <p className="text-sm text-zinc-400">JWT httpOnly cookies, CSRF protection, bcrypt hashing, RBAC, and Zod validation.</p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="group relative overflow-hidden p-8 border border-white/10 bg-black hover:border-white/20 transition-all rounded-xl">
                <div className="relative z-10">
                  <div className="mb-4 inline-flex p-3 rounded-lg bg-white/5 border border-white/10 text-purple-400">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white font-manrope mb-2">Real-Time Updates</h3>
                  <p className="text-sm text-zinc-400">Socket.IO WebSocket events keep every client in sync — no manual refresh needed.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            STATS SECTION
        ════════════════════════ */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { value: '16', label: 'DB Models', sub: '16 tables, 6 enums' },
                { value: '53+', label: 'API Endpoints', sub: 'REST / Swagger' },
                { value: '6', label: 'Algorithms', sub: 'Bio-inspired & classic' },
                { value: '103', label: 'Backend Tests', sub: 'All passing ✓' },
                { value: '31%', label: 'Energy Saved', sub: 'HH vs Round-Robin' },
              ].map((s) => (
                <div key={s.label} className="p-6 border border-white/10 bg-white/[0.02] rounded-xl text-center hover:border-white/20 transition-all">
                  <div className="text-4xl font-bold text-white mb-2 font-manrope">{s.value}</div>
                  <div className="text-sm font-semibold text-white mb-1">{s.label}</div>
                  <div className="text-xs text-zinc-500">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            TESTIMONIAL
        ════════════════════════ */}
        <section className="w-full bg-[#ef233c] py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center gap-1 text-black mb-6">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-2xl">★</span>
              ))}
            </div>
            <h3 className="text-3xl md:text-5xl font-bold text-black font-manrope leading-tight mb-8">
              "A complete research platform — fog scheduling, ML prediction, telemetry, and production infrastructure all in one system."
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white text-lg">👨‍💻</div>
              <div className="text-left">
                <div className="text-black font-bold text-lg">Team Byte_hogs</div>
                <div className="text-black/70 font-medium">BITS Pilani Online · BSc CS</div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            ALGORITHMS SECTION
        ════════════════════════ */}
        <section id="algorithms" className="py-32 px-6 scroll-mt-28">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-semibold text-white font-manrope mb-4">Algorithm Benchmark</h2>
              <p className="text-zinc-400">Completion delay (ms) — lower is better. Wang & Li (2019) reproduction.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Algorithm</th>
                    <th className="text-right py-4 px-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Delay (ms)</th>
                    <th className="text-right py-4 px-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Energy (J)</th>
                    <th className="text-right py-4 px-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Reliable %</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Hybrid HH', delay: 1933, energy: 13.28, reliable: 28, best: true },
                    { name: 'IPSO', delay: 1765, energy: 12.33, reliable: 34, best: false },
                    { name: 'IACO', delay: 1879, energy: 12.52, reliable: 28, best: false },
                    { name: 'FCFS', delay: 2129, energy: 15.54, reliable: 22, best: false },
                    { name: 'Round-Robin', delay: 2171, energy: 19.04, reliable: 24, best: false },
                    { name: 'Min-Min', delay: 2208, energy: 14.42, reliable: 32, best: false },
                  ].map((algo) => (
                    <tr key={algo.name} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 flex items-center gap-2">
                        {algo.best && <span className="px-2 py-0.5 bg-[#ef233c] text-white text-[10px] font-bold rounded-full">BEST</span>}
                        <span className={algo.best ? 'text-[#ef233c] font-semibold' : 'text-zinc-300'}>{algo.name}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-300">{algo.delay}</td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-300">{algo.energy}</td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-300">{algo.reliable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            INFRASTRUCTURE SECTION
        ════════════════════════ */}
        <section className="py-32 px-6 bg-white/[0.02]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-semibold text-white font-manrope mb-4">Production Infrastructure</h2>
              <p className="text-zinc-400">Enterprise-grade platform engineering included.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Docker Compose', desc: '5 containers with health checks' },
                { name: 'Kubernetes', desc: 'Full manifests: deployments, ingress, configmaps' },
                { name: 'Helm Charts', desc: 'Parameterized deployment charts' },
                { name: 'Terraform', desc: 'Infrastructure as Code for cloud provisioning' },
                { name: 'Istio Service Mesh', desc: 'mTLS, canary releases, rate limiting' },
                { name: 'ArgoCD GitOps', desc: 'Continuous deployment pipeline' },
                { name: 'Prometheus + Grafana', desc: 'Metrics collection and dashboards' },
                { name: 'KEDA Autoscaling', desc: 'Event-driven horizontal pod autoscaling' },
                { name: 'Chaos Mesh', desc: 'Chaos engineering for fault tolerance testing' },
              ].map((item) => (
                <div key={item.name} className="flex items-start gap-3 p-4 border border-white/10 rounded-lg bg-white/[0.02] hover:border-[#ef233c]/50 transition-colors">
                  <CheckCircle className="w-4 h-4 text-[#ef233c] mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-white">{item.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            TEAM SECTION
        ════════════════════════ */}
        <section id="team" className="py-32 px-6 scroll-mt-28">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-semibold text-white font-manrope mb-12">The Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Shri Srivastava', id: '2023ebcs593', role: 'Lead Developer', emoji: '👨‍💻' },
                { name: 'Ichha Dwivedi', id: '2023ebcs125', role: 'Developer', emoji: '👩‍💻' },
                { name: 'Aditi Singh', id: '2023ebcs498', role: 'Developer', emoji: '👩‍💻' },
              ].map((member) => (
                <div key={member.name} className="p-6 border border-white/10 rounded-lg bg-white/[0.02] hover:border-white/20 transition-all text-center">
                  <div className="text-4xl mb-3">{member.emoji}</div>
                  <div className="font-bold text-white mb-1">{member.name}</div>
                  <div className="text-xs font-semibold text-[#ef233c] mb-2">{member.role}</div>
                  <div className="font-mono text-[10px] text-zinc-500">{member.id}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            FINAL CTA
        ════════════════════════ */}
        <section className="py-32 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-bold font-manrope mb-8 tracking-tighter">
              Ready to <span className="text-[#ef233c]">Build?</span>
            </h2>
            <p className="text-xl text-zinc-400 mb-12">
              Log in with a demo account and run real experiments across all 6 scheduling algorithms instantly.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button
                onClick={() => navigate('/login')}
                className="relative overflow-hidden rounded-full border-2 border-transparent bg-gradient-to-r from-[#ef233c] to-[#ef233c] p-[2px] transition-all hover:shadow-lg hover:shadow-[#ef233c]/50 active:scale-95"
              >
                <button
                  onClick={() => navigate('/login')}
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-black px-8 py-4 transition-transform active:scale-95"
                >
                  <span className="absolute inset-0 border-2 border-transparent rounded-full"></span>
                  <span className="absolute inset-[-2px] animate-spin bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ef233c_100%)]" style={{ animationDuration: '2.5s' }}></span>
                  <span className="absolute inset-[2px] rounded-full bg-black"></span>
                  <span className="relative z-10 flex items-center gap-2 font-medium text-white">
                    Enter the System
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
                <span className="rounded-full bg-black px-8 py-4 font-bold text-white flex items-center justify-center gap-2">
                  Launch the App
                  <ArrowRight className="h-5 w-5" />
                </span>
              </button>
              
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-4 rounded-full border border-white/20 text-white font-bold hover:border-white/40 transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ════════════════════════
          FOOTER
      ════════════════════════ */}
      <footer className="bg-black border-t border-white/5 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-[#ef233c] rounded-sm rotate-45"></div>
              <span className="text-xl font-bold font-manrope">ML Task Scheduler</span>
            </div>
            <p className="text-zinc-500 max-w-xs leading-relaxed text-sm">
              Pioneering intelligent task allocation with bio-inspired algorithms, ML prediction, and production infrastructure.
            </p>
          </div>
          
          <div>
            <h4 className="text-xs font-bold text-[#ef233c] uppercase tracking-widest mb-4">Platform</h4>
            <ul className="space-y-3 text-zinc-400 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#algorithms" className="hover:text-white transition-colors">Algorithms</a></li>
              <li><a href="#team" className="hover:text-white transition-colors">Team</a></li>
              <li><a href="/login" className="hover:text-white transition-colors">Dashboard</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-xs font-bold text-[#ef233c] uppercase tracking-widest mb-4">Research</h4>
            <ul className="space-y-3 text-zinc-400 text-sm">
              <li>Wang & Li (2019)</li>
              <li>IPSO Algorithm</li>
              <li>SHAP Explainability</li>
              <li>Conformal Prediction</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between text-zinc-600 text-[10px] uppercase tracking-widest">
          <p>© 2025–26 Team Byte_hogs · BITS Pilani Online</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="https://github.com/shri33/ML-Task-Scheduler" target="_blank" rel="noreferrer" className="hover:text-zinc-400">GitHub</a>
            <a href="#" className="hover:text-zinc-400">Twitter</a>
            <a href="#" className="hover:text-zinc-400">LinkedIn</a>
          </div>
        </div>
      </footer>

      {showAuthChooser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/95 p-6 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-xl font-semibold font-manrope text-white">Choose Sign-In Method</h3>
              <p className="mt-1 text-sm text-zinc-400">Continue with demo user or sign in with Google.</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDemoLogin}
                disabled={authLoading}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-white transition hover:border-[#ef233c]/70 hover:bg-white/[0.06] disabled:opacity-60"
              >
                <div className="font-medium">Continue with Demo User</div>
                <div className="text-xs text-zinc-400">demo@example.com / password123</div>
              </button>

              <button
                onClick={handleGoogleLogin}
                className="w-full rounded-xl border border-[#ef233c]/60 bg-[#ef233c]/10 px-4 py-3 text-left text-white transition hover:bg-[#ef233c]/20"
              >
                <div className="font-medium">Continue with Google</div>
                <div className="text-xs text-zinc-300">Secure OAuth sign-in</div>
              </button>
            </div>

            <button
              onClick={() => setShowAuthChooser(false)}
              className="mt-4 w-full rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
