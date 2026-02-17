
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Terminal, Globe, Monitor, Copy, Check, Cpu, Sparkles } from 'lucide-react';
import { Page } from '../types';
import SquadVisualizer from './SquadVisualizer';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HeroProps {
  onScrollToSection?: (sectionId: string) => void;
  onNavigate?: (page: Page) => void;
}

type TabType = 'desktop' | 'terminal' | 'web';

// ==================== ANIMATION VARIANTS ====================

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

// ==================== FLOATING ORB ====================

const FloatingOrb: React.FC<{ color: string; size: number; x: string; y: string; duration: number }> = ({ color, size, x, y, duration }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ width: size, height: size, background: color, left: x, top: y, filter: `blur(${size / 3}px)` }}
    animate={{
      x: [0, 40, -30, 20, 0],
      y: [0, -35, 25, -15, 0],
      scale: [1, 1.1, 0.9, 1.05, 1],
    }}
    transition={{ duration, repeat: Infinity, ease: 'linear' }}
  />
);

// ==================== ANIMATED COUNTER ====================

const AnimatedCounter: React.FC<{ target: number; duration?: number; suffix?: string }> = ({ target, duration = 1.5, suffix = '' }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <>{count.toLocaleString()}{suffix}</>;
};

// ==================== MAIN HERO ====================

const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('desktop');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install -g agdi');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden pt-32 pb-20">

      {/* ===== ANIMATED BACKGROUND ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <FloatingOrb color="rgba(6,182,212,0.08)" size={500} x="10%" y="20%" duration={18} />
        <FloatingOrb color="rgba(34,211,238,0.06)" size={450} x="65%" y="10%" duration={22} />
        <FloatingOrb color="rgba(34,211,238,0.04)" size={400} x="40%" y="60%" duration={20} />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />

        {/* Radial glow behind headline */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-cyan-500/[0.07] via-cyan-400/[0.03] to-transparent rounded-full blur-3xl" />

        {/* Floating particles */}
        {Array.from({ length: 25 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              background: `rgba(${Math.random() > 0.5 ? '6,182,212' : '34,211,238'},${Math.random() * 0.3 + 0.1})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -(20 + Math.random() * 40), 0],
              opacity: [0.1, 0.6, 0.1],
            }}
            transition={{
              repeat: Infinity,
              duration: 4 + Math.random() * 6,
              delay: Math.random() * 4,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ===== CONTENT ===== */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center text-center"
      >

        {/* 1. Version Badge */}
        <motion.div variants={itemVariants}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/60 border border-white/10 text-slate-400 text-xs font-mono mb-8 backdrop-blur-md shadow-lg">
            <motion.span
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            AGDI v3.3.5
          </div>
        </motion.div>

        {/* 2. Headline */}
        <motion.div variants={itemVariants} className="mb-6 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            The Autonomous <br className="hidden md:block" />
            <motion.span
              className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-500 bg-[length:200%_auto]"
              animate={{ backgroundPosition: ['0% center', '100% center', '0% center'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            >
              Software Engineer.
            </motion.span>
          </h1>
        </motion.div>

        {/* 3. Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          Plan, code, and deploy full-stack applications with an intelligent agent squad. Available as CLI and Web IDE — bring your own keys.
        </motion.p>

        {/* 4. Auth CTAs */}
        <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mb-16">
          <motion.button
            onClick={() => onNavigate?.(Page.WIZARD)}
            className="px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:shadow-[0_0_45px_rgba(34,211,238,0.45)] transition-all cursor-pointer flex items-center gap-2.5 relative overflow-hidden group"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Sign Up Free
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-300"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
          <motion.button
            onClick={() => onNavigate?.(Page.AUTH)}
            className="px-8 py-3.5 text-sm font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/25 rounded-full transition-all cursor-pointer backdrop-blur-sm bg-white/[0.03] hover:bg-white/[0.06]"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Log In
          </motion.button>
        </motion.div>

        {/* 5. The Switcher Interface */}
        <motion.div variants={itemVariants} className="w-full max-w-5xl mx-auto mb-14">

          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <motion.div
              className="p-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 inline-flex shadow-xl"
              whileHover={{ boxShadow: '0 0 30px rgba(6,182,212,0.1)' }}
            >
              {([
                { key: 'desktop' as TabType, icon: Monitor, label: 'Desktop' },
                { key: 'terminal' as TabType, icon: Terminal, label: 'CLI' },
                { key: 'web' as TabType, icon: Globe, label: 'Web' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-300 cursor-pointer",
                    activeTab === tab.key
                      ? "bg-white text-slate-950 shadow-lg"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </motion.div>
          </div>

          {/* Content Container */}
          <motion.div
            className="relative w-full aspect-[16/9] md:aspect-[2/1] lg:aspect-[16/9] lg:h-[600px] bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">

              {/* TAB A: DESKTOP */}
              {activeTab === 'desktop' && (
                <motion.div
                  key="desktop"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  className="absolute inset-0 flex flex-col"
                >
                  {/* Mock Window Header */}
                  <div className="h-10 bg-black/40 border-b border-white/5 flex items-center px-4 justify-between shrink-0">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">Agdi IDE - Untitled Project</div>
                    <div className="w-16"></div>
                  </div>

                  {/* IDE Content */}
                  <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
                    <motion.div
                      className="text-center z-10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    >
                      <motion.div
                        className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-cyan-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-cyan-500/20"
                        animate={{ rotate: [0, 3, -3, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Cpu className="w-10 h-10 text-white" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white mb-2">Agdi Desktop</h3>
                      <p className="text-slate-400 mb-8 max-w-md mx-auto">
                        The full power of Agdi, native on your machine. Local file system access, offline mode, and zero-latency editing.
                      </p>
                      <div className="flex flex-col items-center gap-4">
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold rounded-full text-sm tracking-wide">
                          🚧 Coming Soon
                        </span>
                        <a
                          href="https://discord.gg/pPkZ93Yb"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4"
                        >
                          Join Discord to get notified when it launches
                        </a>
                      </div>
                    </motion.div>

                    {/* Background Code Decorations */}
                    <motion.div
                      className="absolute top-10 left-10 opacity-10 blur-[1px] select-none pointer-events-none text-left font-mono text-xs text-cyan-300"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.1 }}
                      transition={{ delay: 0.5, duration: 1 }}
                    >
                      <p>import React from 'react';</p>
                      <p>import {'{ Agdi }'} from '@agdi/core';</p>
                      <p>&nbsp;</p>
                      <p>export const App = () =&gt; {'{'}</p>
                      <p>&nbsp;&nbsp;return (</p>
                      <p>&nbsp;&nbsp;&nbsp;&nbsp;&lt;Agdi.Provider&gt;</p>
                    </motion.div>
                    <motion.div
                      className="absolute bottom-10 right-10 opacity-10 blur-[1px] select-none pointer-events-none text-right font-mono text-xs text-cyan-300"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.1 }}
                      transition={{ delay: 0.8, duration: 1 }}
                    >
                      <p>const agent = new Architect();</p>
                      <p>await agent.analyze(repo);</p>
                      <p>return agent.build();</p>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* TAB B: TERMINAL */}
              {activeTab === 'terminal' && (
                <motion.div
                  key="terminal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  className="absolute inset-0 flex flex-col bg-[#0d1117]"
                >
                  {/* Terminal Header */}
                  <div className="h-10 bg-slate-800/50 border-b border-white/5 flex items-center px-4 justify-between shrink-0">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                      <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                      <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">bash — 80x24</div>
                    <div className="w-16"></div>
                  </div>

                  {/* Terminal Content */}
                  <div className="flex-1 p-6 text-left font-mono text-sm overflow-hidden flex flex-col items-center justify-center">
                    <div className="w-full max-w-lg">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-slate-400 mb-2">$ agdi init my-awesome-project</motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-cyan-400 mb-1">➜  Initializing Agdi Environment...</motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-slate-300 mb-1">   ✓ Cloning repository</motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} className="text-slate-300 mb-1">   ✓ Installing dependencies</motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-slate-300 mb-8">   ✓ Spawning agents... <span className="animate-pulse">_</span></motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.6, duration: 0.4 }}
                        className="p-4 rounded-xl bg-slate-800/50 border border-white/10 flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={handleCopy}
                      >
                        <code className="text-green-400 font-bold">$ npm install -g agdi</code>
                        <div className="text-slate-400 group-hover:text-white transition-colors">
                          {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                        className="text-center mt-4 text-xs text-slate-500"
                      >
                        Click to copy install command
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB C: WEB (SquadVisualizer) */}
              {activeTab === 'web' && (
                <motion.div
                  key="web"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                >
                  <SquadVisualizer />
                  {/* Overlay CTA */}
                  <div className="absolute bottom-8 right-8 z-30">
                    <motion.button
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 backdrop-blur-md border border-white/20 text-white font-bold rounded-xl transition-all shadow-xl flex items-center gap-2 cursor-pointer"
                      onClick={() => onNavigate && onNavigate(Page.WIZARD)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      ✨ Build Your App
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* 6. The Trust Bar */}
        <motion.div
          variants={itemVariants}
          className="w-full max-w-5xl mx-auto px-6 py-5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900"></div>
              <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-900"></div>
              <div className="w-8 h-8 rounded-full bg-slate-500 border-2 border-slate-900 text-[10px] flex items-center justify-center text-white font-bold">+6k</div>
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-sm">
                <AnimatedCounter target={6000} duration={2} suffix="+" /> Downloads
              </div>
              <div className="text-slate-500 text-xs">In the last 3 weeks on npm</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-center">
            {[
              { value: 13, label: 'AI Models' },
              { value: 6, label: 'Agents' },
              { value: 7, label: 'Providers' },
              { value: 0, label: 'Lock-in' },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <div className="w-px h-8 bg-white/10"></div>}
                <div>
                  <div className="text-lg font-bold text-white">
                    <AnimatedCounter target={stat.value} duration={1.5 + i * 0.3} />
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default Hero;
