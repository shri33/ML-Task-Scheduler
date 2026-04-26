import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconBrain,
  IconBolt,
  IconCloud,
  IconChartBar,
  IconShield,
  IconWifi,
  IconArrowRight,
  IconBrandGithub,
  IconBrandLinkedin,
  IconCircleCheck,
  IconChevronRight,
  IconMoon,
  IconSun,
  IconBrandReact,
  IconBrandTypescript,
  IconBrandNodejs,
  IconBrandPython,
  IconBrandDocker,
  IconDatabase
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import FloatingParticles from '../components/FloatingParticles';
import ShinyButton from '../components/ShinyButton';

/* ── Animated counter on scroll-in ─────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const dur = 1300;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(ease * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

/* ── Algorithm benchmark data ───────────────── */
const ALGOS = [
  { name: 'Hybrid HH',   delay: 1933, energy: 13.28, reliable: 28, best: true },
  { name: 'IPSO',        delay: 1765, energy: 12.33, reliable: 34, best: false },
  { name: 'IACO',        delay: 1879, energy: 12.52, reliable: 28, best: false },
  { name: 'FCFS',        delay: 2129, energy: 15.54, reliable: 22, best: false },
  { name: 'Round-Robin', delay: 2171, energy: 19.04, reliable: 24, best: false },
  { name: 'Min-Min',     delay: 2208, energy: 14.42, reliable: 32, best: false },
];
const MAX_DELAY = 2400;

/* ── Feature data ──────────────────────────── */
const FEATURES = [
  {
    icon: IconBrain,
    title: 'Bio-Inspired Scheduling',
    desc: '6 algorithms — IPSO, IACO, Hybrid HH, FCFS, Round-Robin, Min-Min — delivering up to 31% energy reduction over baseline.',
    accent: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-50 dark:bg-black/30',
    span: 'md:col-span-2',
  },
  {
    icon: IconBolt,
    title: 'ML Prediction Engine',
    desc: 'Random Forest, XGBoost & Gradient Boosting with SHAP explainability, Optuna tuning, and conformal prediction.',
    accent: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    span: '',
  },
  {
    icon: IconCloud,
    title: '3-Layer Fog Architecture',
    desc: 'Terminal devices → fog nodes → cloud — with fault tolerance analysis and real-time load balancing.',
    accent: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-900/30',
    span: '',
  },
  {
    icon: IconChartBar,
    title: 'Live Telemetry',
    desc: 'Prometheus + Grafana pipeline with WebSocket live updates, PDF/CSV export, and historical analytics.',
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    span: '',
  },
  {
    icon: IconShield,
    title: 'Production Security',
    desc: 'JWT httpOnly cookies, CSRF double-submit, bcrypt, RBAC, circuit breaker, and Zod schema validation.',
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    span: '',
  },
  {
    icon: IconWifi,
    title: 'Real-Time Updates',
    desc: 'Socket.IO WebSocket events keep every client in sync — no manual refresh needed.',
    accent: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    span: '',
  },
];

/* ── Pages list ────────────────────────────── */
const PAGES = [
  { emoji: '🌫️', name: 'Fog Computing',  tag: 'Algorithm Comparison', lines: '517L', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { emoji: '📱', name: 'Devices',         tag: 'IoT Management',        lines: '476L', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { emoji: '📈', name: 'Analytics',       tag: 'Charts & Dashboards',   lines: '417L', color: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' },
  { emoji: '⚙️', name: 'Tasks',           tag: 'CRUD + Filters',        lines: '409L', color: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400' },
  { emoji: '🔬', name: 'Experiments',     tag: 'Paper Fig 5–8',          lines: '310L', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { emoji: '🗂️', name: 'Dashboard',      tag: 'Real-time Stats',        lines: '276L', color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { emoji: '📋', name: 'Kanban',         tag: 'Task Management',       lines: '240L', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { emoji: '💬', name: 'Chat & Mail',     tag: 'Team Collaboration',    lines: '520L', color: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' },
  { emoji: '🖥️', name: 'Resources',      tag: 'Load Monitoring',        lines: '268L', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { emoji: '👤', name: 'Profile',         tag: 'Settings & Prefs',       lines: '416L', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { emoji: '🔐', name: 'Auth',            tag: 'JWT + CSRF + RBAC',      lines: '~600L', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
];

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [barsVisible, setBarsVisible] = useState(false);
  const benchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = benchRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setBarsVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors relative">
      <FloatingParticles />
      {/* ════════════════════════
          NAVBAR
      ════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-primary-600 rounded-lg flex items-center justify-center shadow-md">
                <img src="/logo.svg" alt="Logo" className="h-4 w-4 brightness-0 invert" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
                ML Task Scheduler
              </span>
            </div>

            {/* Nav links — desktop */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {['Features', 'Algorithms', 'Team'].map((l) => (
                <a
                  key={l}
                  href={`#${l.toLowerCase()}`}
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {l}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? <IconMoon className="h-5 w-5" stroke={1.5} /> : <IconSun className="h-5 w-5" stroke={1.5} />}
              </button>
              <button
                id="lp-nav-login"
                onClick={() => navigate('/login')}
                className="hidden sm:block btn btn-secondary text-sm py-2 px-4"
              >
                Log In
              </button>
              <button
                id="lp-nav-launch"
                onClick={() => navigate('/login')}
                className="btn btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
              >
                Launch App
                <IconArrowRight className="h-4 w-4" stroke={1.5} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ════════════════════════
            HERO
        ════════════════════════ */}
        <section className="relative overflow-hidden py-20 sm:py-28 px-4">
          {/* Subtle grid background */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(37,99,235,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.04) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          {/* Gradient blobs */}
          <div className="absolute top-0 -left-40 w-[600px] h-[600px] bg-primary-200/30 dark:bg-black/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-indigo-200/20 dark:bg-black/30 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-black/30 border border-primary-200 dark:border-primary-800 mb-6 animate-fade-in-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
              </span>
              <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 tracking-wide">
                BITS Pilani Online · BSc CS · Team Byte_hogs
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 animate-fade-in-up">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Intelligent Task
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400">
                Allocation for Fog
              </span>
            </h1>

            {/* ── TECH STACK MARQUEE ── */}
            <div className="mt-12 mb-16 overflow-hidden relative">
               <div className="flex items-center justify-center mb-6">
                  <span className="h-px w-8 bg-gray-200 dark:bg-gray-800" />
                  <span className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Built With</span>
                  <span className="h-px w-8 bg-gray-200 dark:bg-gray-800" />
               </div>
               <div className="flex overflow-hidden group">
                  <div className="flex animate-marquee whitespace-nowrap gap-8 items-center py-4">
                     {[
                       { name: 'React 18', icon: <IconBrandReact className="w-5 h-5 text-sky-500" /> },
                       { name: 'TypeScript', icon: <IconBrandTypescript className="w-5 h-5 text-blue-600" /> },
                       { name: 'Node.js', icon: <IconBrandNodejs className="w-5 h-5 text-emerald-500" /> },
                       { name: 'Python Flask', icon: <IconBrandPython className="w-5 h-5 text-yellow-500" /> },
                       { name: 'PostgreSQL', icon: <IconDatabase className="w-5 h-5 text-blue-400" /> },
                       { name: 'Redis', icon: <IconBolt className="w-5 h-5 text-rose-500" /> },
                       { name: 'Docker', icon: <IconBrandDocker className="w-5 h-5 text-blue-500" /> },
                       { name: 'scikit-learn', icon: <IconBrain className="w-5 h-5 text-orange-500" /> },
                     ].map((tech, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all grayscale hover:grayscale-0">
                           {tech.icon}
                           <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{tech.name}</span>
                        </div>
                     ))}
                     {/* Duplicate */}
                     {[
                       { name: 'React 18', icon: <IconBrandReact className="w-5 h-5 text-sky-500" /> },
                       { name: 'TypeScript', icon: <IconBrandTypescript className="w-5 h-5 text-blue-600" /> },
                       { name: 'Node.js', icon: <IconBrandNodejs className="w-5 h-5 text-emerald-500" /> },
                       { name: 'Python Flask', icon: <IconBrandPython className="w-5 h-5 text-yellow-500" /> },
                       { name: 'PostgreSQL', icon: <IconDatabase className="w-5 h-5 text-blue-400" /> },
                       { name: 'Redis', icon: <IconBolt className="w-5 h-5 text-rose-500" /> },
                       { name: 'Docker', icon: <IconBrandDocker className="w-5 h-5 text-blue-500" /> },
                       { name: 'scikit-learn', icon: <IconBrain className="w-5 h-5 text-orange-500" /> },
                     ].map((tech, i) => (
                        <div key={'d-'+i} className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all grayscale hover:grayscale-0">
                           {tech.icon}
                           <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{tech.name}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up">
              A production-grade system with 6 bio-inspired scheduling algorithms, 3 ML models,
              and a full telemetry pipeline — based on Wang &amp; Li (2019) Sensors 19(5), 1023.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in-up">
              <ShinyButton
                id="lp-hero-launch"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto"
              >
                Enter the System
                <IconArrowRight className="h-5 w-5 ml-2" stroke={1.5} />
              </ShinyButton>
              <a
                id="lp-hero-github"
                href="https://github.com/shri33/ML-Task-Scheduler"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary text-base px-8 py-3.5 gap-2 w-full sm:w-auto"
              >
                <IconBrandGithub className="h-5 w-5" stroke={1.5} />
                View on GitHub
              </a>
            </div>

            {/* Demo credentials hint */}
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Demo login:{' '}
              <code className="font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                demo@example.com
              </code>{' '}
              /{' '}
              <code className="font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                password123
              </code>
            </p>
          </div>
        </section>

        {/* ════════════════════════
            TECH STRIP
        ════════════════════════ */}
        <div className="border-y border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm py-5 px-4">
          <div className="max-w-5xl mx-auto flex items-center gap-8 flex-wrap justify-center">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest shrink-0">Built with</p>
            {['React 18', 'TypeScript', 'Node.js', 'Python Flask', 'PostgreSQL', 'Redis', 'Docker', 'scikit-learn'].map((t) => (
              <span key={t} className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t}</span>
            ))}
          </div>
        </div>

        {/* ════════════════════════
            STATS ROW
        ════════════════════════ */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { value: 16,  suffix: '',  label: 'DB Models',        sub: '16 tables, 6 enums' },
              { value: 53,  suffix: '+', label: 'API Endpoints',    sub: 'REST / Swagger docs' },
              { value: 6,   suffix: '',  label: 'Algorithms',       sub: 'Bio-inspired & classic' },
              { value: 103, suffix: '',  label: 'Backend Tests',    sub: 'All passing ✓' },
              { value: 31,  suffix: '%', label: 'Energy Saved',     sub: 'HH vs Round-Robin' },
            ].map((s) => (
              <div key={s.label} className="card text-center py-6">
                <div className="kpi-value mb-1">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{s.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════
            FEATURES
        ════════════════════════ */}
        <section id="features" className="py-16 px-4 bg-white/50 dark:bg-gray-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="page-title mb-3">The Platform for Intelligent Scheduling</h2>
              <p className="page-subtitle text-base">Replace fragmented tools with one cohesive research-grade system.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className={clsx('card group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300', f.span)}
                >
                  <div className={clsx('inline-flex p-3 rounded-xl mb-4', f.bg)}>
                    <f.icon className={clsx('h-6 w-6', f.accent)} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            ALGORITHM BENCHMARK
        ════════════════════════ */}
        <section id="algorithms" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="page-title mb-3">Live Algorithm Benchmark</h2>
              <p className="page-subtitle text-base">
                Completion delay (ms) — lower is better. Wang &amp; Li (2019) reproduction.
              </p>
            </div>

            <div ref={benchRef} className="card overflow-hidden p-0">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_2fr_90px_90px_90px] gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Algorithm', 'Delay (ms)', 'ms', 'Energy', 'Reliable'].map((h) => (
                  <span key={h} className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{h}</span>
                ))}
              </div>

              {ALGOS.map((a, i) => {
                const pct = (a.delay / MAX_DELAY) * 100;
                return (
                  <div
                    key={a.name}
                    className={clsx(
                      'grid grid-cols-[1fr_2fr_90px_90px_90px] gap-4 px-6 py-4 items-center transition-colors hover:bg-primary-50/50 dark:hover:bg-black/30',
                      i < ALGOS.length - 1 && 'border-b border-gray-100 dark:border-gray-700/50'
                    )}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-2">
                      {a.best && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-black/30 text-primary-700 dark:text-primary-300 font-bold uppercase tracking-wider">
                          Best
                        </span>
                      )}
                      <span className={clsx('font-semibold text-sm', a.best ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400')}>
                        {a.name}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-1000 ease-out',
                          a.best
                            ? 'bg-gradient-to-r from-primary-500 to-indigo-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        )}
                        style={{ width: barsVisible ? `${pct}%` : '0%' }}
                      />
                    </div>

                    {/* Delay */}
                    <span className={clsx('text-right font-mono text-sm font-semibold', a.best ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400')}>
                      {a.delay.toLocaleString()}
                    </span>

                    {/* Energy */}
                    <span className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                      {a.energy}J
                    </span>

                    {/* Reliable */}
                    <span className="text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                      {a.reliable}
                    </span>
                  </div>
                );
              })}

              {/* Summary footer */}
              <div className="px-6 py-4 border-t border-primary-100 dark:border-primary-900/30 bg-primary-50/50 dark:bg-black/30">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="text-primary-600 dark:text-primary-400 font-semibold">HH vs Round-Robin: </span>
                  10.96% delay reduction · 30.25% energy reduction · highest reliability across all task counts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            HIGHLIGHT BAND
        ════════════════════════ */}
        <div className="py-20 px-4 bg-gradient-to-r from-primary-600 to-indigo-600">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center gap-1 mb-5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-8 tracking-tight">
              "A complete research platform — fog scheduling, ML prediction, telemetry, and production infrastructure all in one system."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">🧑‍💻</div>
              <div className="text-left">
                <div className="font-bold text-white">Team Byte_hogs</div>
                <div className="text-white/70 text-sm">BITS Pilani Online · BSc Computer Science</div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════
            PAGES GRID
        ════════════════════════ */}
        <section className="py-16 px-4 bg-white/50 dark:bg-gray-900/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="page-title mb-2">11 Full-Stack Pages</h2>
              <p className="page-subtitle text-base">Every module production-ready with filtering, pagination, export &amp; real-time updates.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {PAGES.map((p) => (
                <div key={p.name} className="card group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center">
                  <div className={clsx(
                    "w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 transition-all duration-500",
                    "border border-white/50 dark:border-gray-700/50 shadow-inner",
                    "group-hover:scale-110 group-hover:rotate-3",
                    "animate-bounce-soft",
                    p.color
                  )}>
                    {p.emoji}
                  </div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 transition-colors">{p.name}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-gray-400 dark:text-gray-500 mb-3">{p.tag}</div>
                  <div className="w-full pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700">
                      {p.lines}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            TEAM
        ════════════════════════ */}
        <section id="team" className="py-24 px-4 bg-slate-50 dark:bg-gray-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="page-title mb-4">The Team</h2>
              <p className="page-subtitle text-base">BITS Pilani Online · BSc Computer Science · Team Byte_hogs</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { 
                  name: 'Shri Srivastava', 
                  id: '2023ebcs593', 
                  role: 'Team Leader, Developer', 
                  img: 'https://media.licdn.com/dms/image/v2/D4D03AQEcj0OjaV1cTA/profile-displayphoto-scale_400_400/B4DZlmASTzJgAg-/0/1758352977139?e=1778716800&v=beta&t=BSLicgDEEWtzCFIlfgDH_f1ovuIxWYLyrYq9FEKfh88',
                  li: 'https://www.linkedin.com/in/shri-srivastava-ab04a5175/'
                },
                { 
                  name: 'Ichha Dwivedi',   
                  id: '2023ebcs125', 
                  role: 'Developer',       
                  img: 'https://media.licdn.com/dms/image/v2/D5635AQF4HfjRIXfDrg/profile-framedphoto-shrink_400_400/B56ZskJ.5VJ8Ac-/0/1765838155604?e=1777762800&v=beta&t=OaVHII6Mm1ZT1yogIY5awzOKQwoCrdLa1MzfEwpWW-U',
                  li: 'https://www.linkedin.com/in/ichha-dwivedi-55b246288/'
                },
                { 
                  name: 'Aditi Singh',     
                  id: '2023ebcs498', 
                  role: 'Developer',       
                  img: 'https://media.licdn.com/dms/image/v2/D4D03AQHbXw028qVAFA/profile-displayphoto-scale_400_400/B4DZi9lKpqH4Ao-/0/1755527296321?e=1778716800&v=beta&t=8l36p8D5Gf9VLS9UyXfv6PSh_6VQjQgt2MrQs6hXuOc',
                  li: 'https://www.linkedin.com/in/aditi-singh-041866306/'
                },
              ].map((m) => (
                <div key={m.name} className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center group">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary-500 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity" />
                    <img 
                      src={m.img} 
                      alt={m.name} 
                      className="relative w-28 h-28 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
                    />
                  </div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg mb-1">{m.name}</div>
                  <div className="text-xs font-bold text-primary-600 dark:text-primary-400 mb-2 uppercase tracking-widest">{m.role}</div>
                  <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 mb-6">{m.id}</div>
                  
                  <a 
                    href={m.li} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-3 bg-slate-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-gray-700 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600"
                  >
                    <IconBrandLinkedin className="h-6 w-6" stroke={1.5} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            INFRASTRUCTURE LIST
        ════════════════════════ */}
        <section className="py-16 px-4 bg-white/50 dark:bg-gray-900/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="page-title mb-2">Production Infrastructure</h2>
              <p className="page-subtitle text-base">Enterprise-grade platform engineering included.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { t: 'Docker Compose', d: '5 containers with health checks' },
                { t: 'Kubernetes', d: 'Full manifests: deployments, ingress, configmaps' },
                { t: 'Helm Charts', d: 'Parameterized deployment charts' },
                { t: 'Terraform', d: 'Infrastructure as Code for cloud provisioning' },
                { t: 'Istio Service Mesh', d: 'mTLS, canary releases, rate limiting' },
                { t: 'ArgoCD GitOps', d: 'Continuous deployment pipeline' },
                { t: 'Prometheus + Grafana', d: 'Metrics collection and dashboards' },
                { t: 'KEDA Autoscaling', d: 'Event-driven horizontal pod autoscaling' },
                { t: 'Chaos Mesh', d: 'Chaos engineering for fault tolerance testing' },
              ].map((item) => (
                <div key={item.t} className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                  <IconCircleCheck className="h-4 w-4 text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" stroke={1.5} />
                  <div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{item.t}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            FINAL CTA
        ════════════════════════ */}
        <section className="py-20 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Ready to{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400">
                Schedule?
              </span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-10 leading-relaxed">
              Log in with a demo account and run real experiments across all 6 scheduling algorithms instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button
                id="lp-cta-launch"
                onClick={() => navigate('/login')}
                className="btn btn-primary text-base px-10 py-3.5 gap-2 shadow-lg shadow-primary-500/25"
              >
                Launch the App
                <IconChevronRight className="h-5 w-5" stroke={1.5} />
              </button>
              <button
                id="lp-cta-register"
                onClick={() => navigate('/register')}
                className="btn btn-secondary text-base px-10 py-3.5"
              >
                Create Account
              </button>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Demo:{' '}
              <code className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs">
                demo@example.com
              </code>{' '}
              /{' '}
              <code className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs">
                password123
              </code>
            </p>
          </div>
        </section>
      </main>

      {/* ════════════════════════
          FOOTER
      ════════════════════════ */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <img src="/logo.svg" alt="Logo" className="h-4 w-4 brightness-0 invert" />
                </div>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white">ML Task Scheduler</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Intelligent task allocation across fog computing layers — powered by bio-inspired algorithms and machine learning.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                BITS Pilani Online · BSc Computer Science · 2025–26
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-4">Platform</h4>
              <ul className="space-y-3">
                {['Dashboard', 'Fog Computing', 'Experiments', 'Analytics', 'Reports'].map((l) => (
                  <li key={l}>
                    <button
                      onClick={() => navigate('/login')}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left"
                    >
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-4">Research</h4>
              <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
                {['Wang & Li (2019)', 'IPSO Algorithm', 'IACO Algorithm', 'SHAP Explainability', 'Conformal Prediction'].map(
                  (l) => <li key={l}>{l}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 dark:text-gray-500">
            <p>© 2025–26 Team Byte_hogs · BITS Pilani Online · All rights reserved.</p>
            <div className="flex items-center gap-4">
              <p>Based on Wang &amp; Li (2019) · Sensors 19(5), 1023</p>
              <a
                href="https://github.com/shri33/ML-Task-Scheduler"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <IconBrandGithub className="h-3.5 w-3.5" stroke={1.5} />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
