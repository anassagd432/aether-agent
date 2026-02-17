/**
 * AuthPage — Premium split-screen authentication
 *
 * Left panel:  Animated brand showcase with gradient orbs, typewriter tagline, feature stats
 * Right panel: Login/Signup form with OAuth (GitHub + Google), email/password, password strength meter
 *
 * Fully animated with framer-motion throughout.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Github, Mail, Eye, EyeOff, AlertCircle, Loader2,
    Shield, Sparkles, Zap, Lock, Terminal, ChevronRight, CheckCircle2
} from 'lucide-react';
import { useAuth, type UserType } from '../hooks/useAuth';
import { validatePassword, isValidEmail } from '../lib/security/sanitize';

// ==================== TYPES ====================

interface AuthPageProps {
    userType: UserType;
    onBack?: () => void;
    onAuthenticated: () => void;
}

// ==================== ANIMATION VARIANTS ====================

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const slideVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

// ==================== TAGLINES ====================

const TAGLINES = [
    'Build full-stack apps with AI agents',
    'From idea to production in minutes',
    '6 specialized agents. 1 command.',
    'Your AI engineering team, ready.',
];

// ==================== TYPEWRITER HOOK ====================

function useTypewriter(phrases: string[], typingSpeed = 50, pauseMs = 2500) {
    const [text, setText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const current = phrases[phraseIndex];

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                setText(current.slice(0, charIndex + 1));
                setCharIndex(prev => prev + 1);

                if (charIndex + 1 >= current.length) {
                    setTimeout(() => setIsDeleting(true), pauseMs);
                }
            } else {
                setText(current.slice(0, charIndex - 1));
                setCharIndex(prev => prev - 1);

                if (charIndex <= 1) {
                    setIsDeleting(false);
                    setPhraseIndex(prev => (prev + 1) % phrases.length);
                    setCharIndex(0);
                }
            }
        }, isDeleting ? typingSpeed / 2 : typingSpeed);

        return () => clearTimeout(timeout);
    }, [charIndex, isDeleting, phraseIndex, phrases, typingSpeed, pauseMs]);

    return text;
}

// ==================== PASSWORD STRENGTH ====================

function getPasswordStrength(password: string): { level: number; color: string; label: string } {
    if (!password) return { level: 0, color: '', label: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, color: 'bg-red-500', label: 'Weak' };
    if (score <= 2) return { level: 2, color: 'bg-orange-500', label: 'Fair' };
    if (score <= 3) return { level: 3, color: 'bg-yellow-500', label: 'Good' };
    if (score <= 4) return { level: 4, color: 'bg-emerald-500', label: 'Strong' };
    return { level: 5, color: 'bg-green-500', label: 'Excellent' };
}

// ==================== FLOATING ORB COMPONENT ====================

const FloatingOrb: React.FC<{ color: string; size: number; x: string; y: string; delay: number }> = ({ color, size, x, y, delay }) => (
    <motion.div
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: size, height: size, background: color, left: x, top: y }}
        animate={{
            x: [0, 30, -20, 10, 0],
            y: [0, -25, 15, -10, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
        }}
        transition={{ duration: 12 + delay, repeat: Infinity, ease: 'linear' }}
    />
);

// ==================== LEFT BRAND PANEL ====================

const BrandPanel: React.FC<{ isDeveloper: boolean }> = ({ isDeveloper }) => {
    const tagline = useTypewriter(TAGLINES, 55, 2800);

    const features = [
        { icon: Zap, label: '6 AI Agents', desc: 'autonomous squad' },
        { icon: Shield, label: '13 Models', desc: 'across 7 providers' },
        { icon: Lock, label: 'Zero Lock-in', desc: 'bring your own keys' },
    ];

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="hidden lg:flex flex-col justify-between h-full relative overflow-hidden rounded-3xl p-10"
            style={{ background: 'linear-gradient(135deg, rgba(7,8,15,0.95) 0%, rgba(15,23,42,0.9) 100%)' }}
        >
            {/* Orbs */}
            <FloatingOrb color="rgba(6,182,212,0.15)" size={300} x="10%" y="20%" delay={0} />
            <FloatingOrb color="rgba(168,85,247,0.12)" size={250} x="60%" y="60%" delay={3} />
            <FloatingOrb color="rgba(6,182,212,0.08)" size={200} x="70%" y="10%" delay={6} />

            {/* Top */}
            <div className="relative z-10">
                <motion.div variants={itemVariants} className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-amber-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">Agdi</span>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
                        {tagline}
                        <motion.span
                            className="inline-block w-0.5 h-7 bg-cyan-400 ml-1 align-middle"
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                        />
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        {isDeveloper
                            ? 'Access the full Agdi IDE with CLI integration, multi-agent orchestration, and unlimited builds.'
                            : 'Describe your app in plain English and watch your AI engineering team build it autonomously.'}
                    </p>
                </motion.div>
            </div>

            {/* Features */}
            <div className="relative z-10">
                <motion.div variants={itemVariants} className="space-y-4 mb-10">
                    {features.map((f, i) => (
                        <motion.div
                            key={f.label}
                            variants={itemVariants}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
                            whileHover={{ x: 6, backgroundColor: 'rgba(255,255,255,0.06)' }}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-cyan-500/20 text-cyan-400' : i === 1 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                <f.icon className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-white text-sm font-medium">{f.label}</div>
                                <div className="text-slate-500 text-[11px]">{f.desc}</div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Terminal preview */}
                <motion.div
                    variants={itemVariants}
                    className="rounded-xl bg-slate-950/80 border border-white/[0.06] p-4 font-mono text-xs"
                >
                    <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                        <span className="ml-2 text-[10px] text-slate-600">terminal</span>
                    </div>
                    <div className="text-slate-500">$</div>
                    <motion.div
                        className="text-cyan-400 mt-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                    >
                        agdi squad "SaaS dashboard"
                    </motion.div>
                    <motion.div
                        className="text-slate-500 mt-2 text-[10px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.5 }}
                    >
                        ✓ Planner → Architect → Engineer → QA → DevOps → Deployed
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

// ==================== MAIN AUTH PAGE ====================

const AuthPage: React.FC<AuthPageProps> = ({ userType, onBack, onAuthenticated }) => {
    const auth = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isDeveloper = userType === 'developer';
    const passwordCheck = useMemo(() => validatePassword(password), [password]);
    const emailValid = useMemo(() => !email || isValidEmail(email), [email]);
    const strength = useMemo(() => getPasswordStrength(password), [password]);

    const handleOAuth = async (provider: 'github' | 'google') => {
        if (provider === 'github') {
            await auth.signInWithGithub();
        } else {
            await auth.signInWithGoogle();
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        if (!isValidEmail(email)) return;
        if (mode === 'signup' && !passwordCheck.valid) return;

        setIsSubmitting(true);
        try {
            if (mode === 'signup') {
                await auth.signUp(email, password, userType);
            } else {
                await auth.signInWithEmail(email, password);
            }
            setTimeout(() => {
                if (auth.isAuthenticated) onAuthenticated();
                setIsSubmitting(false);
            }, 1000);
        } catch {
            setIsSubmitting(false);
        }
    };

    // Redirect once authenticated
    useEffect(() => {
        if (auth.isAuthenticated) {
            auth.setUserType(userType);
            onAuthenticated();
        }
    }, [auth.isAuthenticated, userType, onAuthenticated, auth]);

    // ==================== DEV MODE FALLBACK ====================
    if (!auth.isConfigured) {
        return (
            <div className="fixed inset-0 bg-[#07080f] flex items-center justify-center z-50">
                {/* Background orbs */}
                <FloatingOrb color="rgba(6,182,212,0.1)" size={400} x="20%" y="30%" delay={0} />
                <FloatingOrb color="rgba(168,85,247,0.08)" size={350} x="60%" y="50%" delay={4} />

                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                    className="max-w-md w-full mx-4 p-10 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl text-center relative z-10"
                >
                    <motion.div
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mx-auto mb-6"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                    >
                        <Terminal className="w-7 h-7 text-cyan-400" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-white mb-2">Development Mode</h2>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                        Supabase auth is not configured.<br />In production, users authenticate here.
                    </p>
                    <motion.button
                        onClick={() => {
                            auth.setUserType(userType);
                            onAuthenticated();
                        }}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-500 text-white font-bold text-sm cursor-pointer relative overflow-hidden group"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Continue as {isDeveloper ? 'Developer' : 'Business Owner'}
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-400"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        />
                    </motion.button>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="mt-4 text-sm text-slate-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    // ==================== MAIN AUTH UI ====================
    return (
        <div className="fixed inset-0 bg-[#07080f] z-50 flex">
            {/* FLOATING PARTICLES (behind everything) */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: Math.random() * 3 + 1,
                            height: Math.random() * 3 + 1,
                            background: `rgba(${isDeveloper ? '6,182,212' : '168,85,247'},${Math.random() * 0.25 + 0.05})`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{ y: [0, -40, 0], opacity: [0.15, 0.5, 0.15] }}
                        transition={{ repeat: Infinity, duration: 5 + Math.random() * 5, delay: Math.random() * 3 }}
                    />
                ))}
            </div>

            {/* LEFT — BRAND PANEL (desktop only) */}
            <div className="hidden lg:block w-[42%] p-4">
                <BrandPanel isDeveloper={isDeveloper} />
            </div>

            {/* RIGHT — AUTH FORM */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-full max-w-md relative z-10"
                >
                    {/* Back button */}
                    {onBack && (
                        <motion.button
                            variants={itemVariants}
                            onClick={onBack}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8 cursor-pointer group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back
                        </motion.button>
                    )}

                    {/* Header */}
                    <motion.div variants={itemVariants} className="mb-8">
                        <div className="lg:hidden flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-amber-600 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-white">Agdi</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {mode === 'login' ? 'Welcome back' : 'Create your account'}
                        </h1>
                        <p className="text-slate-400 text-sm">
                            {mode === 'login'
                                ? 'Sign in to continue building with Agdi'
                                : 'Start building full-stack apps with AI agents'}
                        </p>
                    </motion.div>

                    {/* FORM CARD */}
                    <motion.div
                        variants={itemVariants}
                        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-8"
                    >
                        {/* Tab switcher */}
                        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] mb-8">
                            {(['login', 'signup'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setMode(tab)}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${mode === tab
                                            ? 'bg-white/[0.08] text-white shadow-lg'
                                            : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    {tab === 'login' ? 'Sign In' : 'Sign Up'}
                                </button>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={mode}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.25 }}
                            >
                                {/* OAuth buttons */}
                                <div className="space-y-3 mb-6">
                                    <motion.button
                                        onClick={() => handleOAuth('github')}
                                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-sm font-medium border border-white/[0.06] transition-all cursor-pointer"
                                        whileHover={{ scale: 1.01, y: -1 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        <Github className="w-5 h-5" />
                                        Continue with GitHub
                                    </motion.button>

                                    <motion.button
                                        onClick={() => handleOAuth('google')}
                                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium border border-white/[0.06] transition-all cursor-pointer"
                                        whileHover={{ scale: 1.01, y: -1 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Continue with Google
                                    </motion.button>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-3 my-6">
                                    <div className="flex-1 h-px bg-white/[0.06]" />
                                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">or continue with email</span>
                                    <div className="flex-1 h-px bg-white/[0.06]" />
                                </div>

                                {/* Email form */}
                                <form onSubmit={handleEmailSubmit} className="space-y-5">
                                    {/* Email */}
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2 font-medium">Email address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="you@company.com"
                                                className={`w-full bg-white/[0.03] border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-300 ${email && !emailValid
                                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                                                        : 'border-white/[0.06] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20'
                                                    }`}
                                                required
                                            />
                                        </div>
                                        {email && !emailValid && (
                                            <motion.p
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1"
                                            >
                                                <AlertCircle className="w-3 h-3" /> Please enter a valid email
                                            </motion.p>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2 font-medium">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className={`w-full bg-white/[0.03] border rounded-xl pl-11 pr-12 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-300 ${mode === 'signup' && password && !passwordCheck.valid
                                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                                                        : 'border-white/[0.06] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20'
                                                    }`}
                                                required
                                                minLength={8}
                                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer p-0.5"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Password strength meter */}
                                        {mode === 'signup' && password && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-3"
                                            >
                                                <div className="flex gap-1 mb-1.5">
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <div
                                                            key={i}
                                                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= strength.level ? strength.color : 'bg-white/[0.06]'
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] ${passwordCheck.valid ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                        {passwordCheck.valid ? (
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3" /> {strength.label}
                                                            </span>
                                                        ) : (
                                                            passwordCheck.reason
                                                        )}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Forgot password (login only) */}
                                    {mode === 'login' && (
                                        <div className="text-right">
                                            <button type="button" className="text-[11px] text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer">
                                                Forgot password?
                                            </button>
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting || !email || !password || (mode === 'signup' && !passwordCheck.valid)}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer relative overflow-hidden"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                        ) : (
                                            <span className="flex items-center justify-center gap-2">
                                                {mode === 'signup' ? 'Create Account' : 'Sign In'}
                                                <ChevronRight className="w-4 h-4" />
                                            </span>
                                        )}
                                    </motion.button>
                                </form>

                                {/* Toggle mode */}
                                <p className="text-center text-xs text-slate-500 mt-6">
                                    {mode === 'login' ? (
                                        <>
                                            Don&apos;t have an account?{' '}
                                            <button
                                                onClick={() => setMode('signup')}
                                                className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                                            >
                                                Sign up
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            Already have an account?{' '}
                                            <button
                                                onClick={() => setMode('login')}
                                                className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                                            >
                                                Sign in
                                            </button>
                                        </>
                                    )}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {/* Error */}
                        <AnimatePresence>
                            {auth.error && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -8, height: 0 }}
                                    className="flex items-center gap-2 mt-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20"
                                >
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className="text-xs text-red-300">{auth.error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Security note */}
                    <motion.p
                        variants={itemVariants}
                        className="text-center text-[10px] text-slate-600 mt-6 flex items-center justify-center gap-1.5"
                    >
                        <Shield className="w-3 h-3" />
                        Secured by Supabase • Encrypted • Your data is never shared
                    </motion.p>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthPage;
