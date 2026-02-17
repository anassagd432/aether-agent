/**
 * ComingSoon - Full-screen overlay for soft launch
 * Styled to match the landing page aesthetic
 * Integrated with Mailchimp newsletter API
 */

import React, { useState } from 'react';
import { Zap, Mail, Twitter, Github, ArrowLeft, Lock, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface ComingSoonProps {
    onBack: () => void;
}

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

const ComingSoon: React.FC<ComingSoonProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<SubmitStatus>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async () => {
        if (!email.trim()) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setStatus('error');
            setMessage('Please enter a valid email address');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch('/api/newsletter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStatus('success');
                setMessage(data.message || "You're on the list! We'll notify you when we launch.");
                setEmail('');
            } else {
                setStatus('error');
                setMessage(data.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            setStatus('error');
            setMessage('Network error. Please check your connection and try again.');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isLoading = status === 'loading';

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
            {/* Atmospheric Horizon Glow - matching Hero.tsx */}
            <div className="horizon-glow" />

            {/* Subtle grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

            {/* Header with back button */}
            <header className="relative z-20 flex items-center justify-between px-6 py-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Home</span>
                </button>

                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-bold">Agdi<span className="text-cyan-400">.dev</span></span>
                </div>

                {/* Placeholder for symmetry */}
                <div className="w-24" />
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex items-center justify-center px-6">
                <div className="text-center max-w-2xl mx-auto">

                    {/* Badge - matching LandingPage style */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Coming Soon
                    </div>

                    {/* Headline - matching Hero.tsx style */}
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight mb-6">
                        Ship Enterprise Apps
                        <span className="block mt-2 text-3xl sm:text-5xl lg:text-6xl font-normal text-gray-400">
                            <span className="text-cyan-400 font-semibold italic">No Login Required</span>
                        </span>
                    </h1>

                    {/* Subtitle - matching Hero.tsx */}
                    <p className="text-gray-400 text-lg sm:text-xl mb-12 max-w-xl mx-auto leading-relaxed">
                        Agdi turns natural language into production-ready software.
                        <br className="hidden sm:block" />
                        Be the first to know when we launch.
                    </p>

                    {/* Email Signup - matching Hero prompt box style */}
                    <div className="relative w-full max-w-md mx-auto mb-12">
                        <div className="bg-[#141420] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 transition-all focus-within:border-cyan-500/30 focus-within:shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                            <div className="flex items-center px-4 py-3 gap-3">
                                <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter your email address"
                                    className="flex-1 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none font-light"
                                    spellCheck={false}
                                />
                                {/* Notify Button - matching "Build now" style */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={!email.trim() || isLoading}
                                    className="btn-glow flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 px-5 py-2 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,211,238,0.4)] text-sm whitespace-nowrap"
                                >
                                    {isLoading ? 'Subscribing...' : 'Notify Me'}
                                </button>
                            </div>
                            {/* Status Message */}
                            {message && (
                                <div className={`flex items-center justify-center gap-2 mt-3 text-sm ${status === 'success' ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {status === 'success' ? (
                                        <CheckCircle className="w-4 h-4" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4" />
                                    )}
                                    <span>{message}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Social links - matching landing page style */}
                    <div className="flex items-center justify-center gap-4">
                        <a
                            href="https://twitter.com/anass_agdi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 hover:border-cyan-500/30 transition-all"
                        >
                            <Twitter className="w-5 h-5" />
                        </a>
                        <a
                            href="https://github.com/anassagd/Agdi.ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 hover:border-cyan-500/30 transition-all"
                        >
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </main>

            {/* Footer Status Bar - matching landing page style */}
            <footer className="relative z-20 border-t border-white/5 bg-slate-900/60 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-xs font-bold text-white tracking-wider">AGDI SYSTEMS</span>
                        <span className="text-xs text-slate-500">|</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Coming Soon</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            <span className="font-mono">BUILDING</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-cyan-400" />
                            <span className="uppercase tracking-wider text-cyan-400">Secure</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ComingSoon;
