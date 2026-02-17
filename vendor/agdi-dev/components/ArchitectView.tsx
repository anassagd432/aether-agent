import React, { useState, useEffect, useRef } from 'react';
import { Activity, Brain, Code, Shield, Terminal, Zap, CheckCircle2, Cpu, Lock } from 'lucide-react';

const LOGS_SOURCE = [
    { agent: 'SYSTEM', msg: 'Initializing secure neural environment...', color: 'text-cyan-400' },
    { agent: 'ARCHITECT', msg: 'Parsing intent: "Enterprise CRM Dashboard"', color: 'text-cyan-400' },
    { agent: 'MEMORY', msg: 'Retrieving context from vector store...', color: 'text-blue-400' },
    { agent: 'ARCHITECT', msg: 'Plan generated: 4 phases, 12 components', color: 'text-cyan-400' },
    { agent: 'ENGINEER', msg: 'Scaffolding Next.js 14 project structure...', color: 'text-yellow-400' },
    { agent: 'SECURITY', msg: 'Validating dependencies against CVE database...', color: 'text-green-400' },
    { agent: 'SECURITY', msg: 'SOC2 Compliance Check: passed', color: 'text-green-400' },
    { agent: 'ENGINEER', msg: 'Generating API routes for /api/auth...', color: 'text-yellow-400' },
    { agent: 'QA_BOT', msg: 'Running integration tests (34/34 passed)', color: 'text-pink-400' },
    { agent: 'SYSTEM', msg: 'Build optimization complete. Ready to deploy.', color: 'text-cyan-400' }
];

const ArchitectView: React.FC = () => {
    const [logs, setLogs] = useState<typeof LOGS_SOURCE>([]);
    const [logIndex, setLogIndex] = useState(0);
    const [tokensPerSec, setTokensPerSec] = useState(4200);
    const [activeAgent, setActiveAgent] = useState<'ARCHITECT' | 'ENGINEER' | 'QA'>('ARCHITECT');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Simulated log stream
    useEffect(() => {
        if (logIndex >= LOGS_SOURCE.length) return;

        const timeout = setTimeout(() => {
            setLogs(prev => [...prev, LOGS_SOURCE[logIndex]]);
            setLogIndex(prev => prev + 1);

            // Update active agent based on log
            const currentLog = LOGS_SOURCE[logIndex];
            if (currentLog.agent === 'ARCHITECT') setActiveAgent('ARCHITECT');
            if (currentLog.agent === 'ENGINEER') setActiveAgent('ENGINEER');
            if (currentLog.agent === 'QA_BOT') setActiveAgent('QA');

        }, 800 + Math.random() * 1000); // Random delay for realism

        return () => clearTimeout(timeout);
    }, [logIndex]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Fluctuating metrics
    useEffect(() => {
        const interval = setInterval(() => {
            setTokensPerSec(prev => {
                const change = Math.floor(Math.random() * 200) - 100;
                return Math.max(3000, Math.min(5000, prev + change));
            });
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full max-w-4xl mx-auto px-4 mt-8 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="relative bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl shadow-cyan-900/10 overflow-hidden ring-1 ring-white/5">

                {/* Connection Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between mb-6 relative z-10 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                        <span className="text-sm font-semibold text-white tracking-wide">AGDI NEURAL CORE v1.0</span>
                        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">LIVE</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3" />
                            <span>{(tokensPerSec / 1000).toFixed(1)}k t/s</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Lock className="w-3 h-3" />
                            <span className="text-green-400">ENCRYPTED</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

                    {/* LEFT: Agent Swarm Status */}
                    <div className="lg:col-span-1 space-y-3">
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Active Agents</div>

                        {/* Architect Agent */}
                        <div className={`p-3 rounded-xl border transition-all duration-300 ${activeAgent === 'ARCHITECT' ? 'bg-amber-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5 opacity-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${activeAgent === 'ARCHITECT' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <Brain className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">Architect</div>
                                    <div className="text-[10px] text-slate-400">Planning & Routing</div>
                                </div>
                                {activeAgent === 'ARCHITECT' && <Activity className="w-3 h-3 text-cyan-400 ml-auto animate-pulse" />}
                            </div>
                        </div>

                        {/* Engineer Agent */}
                        <div className={`p-3 rounded-xl border transition-all duration-300 ${activeAgent === 'ENGINEER' ? 'bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'bg-white/5 border-white/5 opacity-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${activeAgent === 'ENGINEER' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <Code className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">Engineer</div>
                                    <div className="text-[10px] text-slate-400">Code Generation</div>
                                </div>
                                {activeAgent === 'ENGINEER' && <Activity className="w-3 h-3 text-yellow-400 ml-auto animate-pulse" />}
                            </div>
                        </div>

                        {/* QA Agent */}
                        <div className={`p-3 rounded-xl border transition-all duration-300 ${activeAgent === 'QA' ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/5 opacity-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${activeAgent === 'QA' ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <Shield className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">QA Bot</div>
                                    <div className="text-[10px] text-slate-400">Security & Tests</div>
                                </div>
                                {activeAgent === 'QA' && <Activity className="w-3 h-3 text-green-400 ml-auto animate-pulse" />}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Terminal Feed */}
                    <div className="lg:col-span-2 flex flex-col h-full min-h-[240px]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Neural Feed</span>
                            </div>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-slate-700" />
                                <div className="w-2 h-2 rounded-full bg-slate-700" />
                                <div className="w-2 h-2 rounded-full bg-slate-700" />
                            </div>
                        </div>

                        <div className="flex-1 bg-black/60 rounded-xl border border-white/10 p-4 font-mono text-xs overflow-hidden relative shadow-inner shadow-black/80">
                            <div
                                ref={scrollRef}
                                className="absolute inset-0 p-4 overflow-y-auto scrollbar-hide space-y-2"
                            >
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <span className={`shrink-0 w-20 text-right font-bold ${log.color}`}>[{log.agent}]</span>
                                        <span className="text-slate-300">{log.msg}</span>
                                    </div>
                                ))}
                                {logIndex < LOGS_SOURCE.length && (
                                    <div className="flex gap-3 animate-pulse opacity-50">
                                        <span className="shrink-0 w-20 text-right text-slate-600">...</span>
                                        <span className="text-slate-600">_</span>
                                    </div>
                                )}
                            </div>

                            {/* Gradient fade at bottom */}
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        </div>

                        {/* Simulated Input */}
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-cyan-500 font-mono">{'>'}</span>
                            <span className="text-slate-500 text-xs font-mono">awaiting_user_command...</span>
                            <span className="w-1.5 h-4 bg-cyan-500/50 animate-pulse ml-auto" />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ArchitectView;
