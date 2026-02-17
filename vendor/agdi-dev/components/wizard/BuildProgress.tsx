/**
 * BuildProgress — Cinematic build visualization
 *
 * Shows real-time agent activity, file creation, and a progress indicator
 * during the architect → engineer → deploy pipeline.
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GenerationStep } from '../ide/ChatPanel';

interface BuildProgressProps {
    steps: GenerationStep[];
    terminalLogs: string[];
    isThinking: boolean;
    serverStatus: string;
    iframeUrl: string | null;
}

const AGENT_PHASES = [
    { id: 'architect', label: 'Architect', icon: '🧠', description: 'Designing your application blueprint...' },
    { id: 'engineer', label: 'Engineer', icon: '⚙️', description: 'Writing production-quality code...' },
    { id: 'install', label: 'Installer', icon: '📦', description: 'Installing dependencies...' },
    { id: 'deploy', label: 'Server', icon: '🚀', description: 'Booting live preview...' },
];

function getCurrentPhase(logs: string[], serverStatus: string, isThinking: boolean): number {
    if (serverStatus === 'running') return 3;
    if (logs.some(l => l.includes('Installing') || l.includes('npm'))) return 2;
    if (logs.some(l => l.includes('Blueprint generated') || l.includes('create'))) return 1;
    if (isThinking) return 0;
    return 0;
}

const BuildProgress: React.FC<BuildProgressProps> = ({
    steps,
    terminalLogs,
    isThinking,
    serverStatus,
    iframeUrl,
}) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const startTimeRef = useRef(Date.now());
    const logEndRef = useRef<HTMLDivElement>(null);
    const currentPhase = getCurrentPhase(terminalLogs, serverStatus, isThinking);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLogs]);

    const isComplete = serverStatus === 'running' && iframeUrl;
    const progress = isComplete ? 100 : Math.min(95, ((currentPhase + 1) / AGENT_PHASES.length) * 100);

    return (
        <div className="w-full h-full flex flex-col gap-4 p-4">
            {/* Header with Timer */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={isComplete ? {} : { rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-sm"
                    >
                        {isComplete ? '✓' : '⚡'}
                    </motion.div>
                    <div>
                        <h3 className="text-white font-bold text-sm">
                            {isComplete ? 'Your app is live!' : 'Building your app...'}
                        </h3>
                        <p className="text-slate-400 text-xs font-mono">
                            {elapsedTime}s elapsed
                        </p>
                    </div>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    {steps.filter(s => s.status === 'done').length}/{steps.length} files
                </div>
            </div>

            {/* Main Progress Bar */}
            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                        background: isComplete
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : 'linear-gradient(90deg, #06b6d4, #a855f7)',
                    }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                {!isComplete && (
                    <motion.div
                        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ['-80px', '500px'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}
            </div>

            {/* Agent Pipeline */}
            <div className="flex gap-2">
                {AGENT_PHASES.map((phase, i) => {
                    const isActive = i === currentPhase;
                    const isDone = i < currentPhase || isComplete;
                    return (
                        <motion.div
                            key={phase.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`flex-1 p-3 rounded-xl border text-center transition-all duration-300 ${isDone
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : isActive
                                    ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                                    : 'bg-slate-800/30 border-white/5'
                                }`}
                        >
                            <div className="text-lg mb-1">
                                {isDone ? '✅' : phase.icon}
                            </div>
                            <div className={`text-xs font-bold ${isDone ? 'text-emerald-400' : isActive ? 'text-cyan-400' : 'text-slate-500'
                                }`}>
                                {phase.label}
                            </div>
                            {isActive && !isDone && (
                                <motion.div
                                    className="w-4 h-0.5 bg-cyan-400 rounded-full mx-auto mt-1"
                                    animate={{ scaleX: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Live File List */}
            {steps.length > 0 && (
                <div className="flex-shrink-0 max-h-32 overflow-y-auto bg-slate-900/50 rounded-xl border border-white/5 p-3">
                    <div className="text-xs text-slate-500 mb-2 font-medium">Generated Files</div>
                    <div className="space-y-1">
                        <AnimatePresence>
                            {steps
                                .filter(s => s.type === 'create')
                                .map((step, i) => (
                                    <motion.div
                                        key={step.target}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center gap-2 text-xs"
                                    >
                                        <span className="text-emerald-400">✓</span>
                                        <span className="text-slate-300 font-mono truncate">{step.target}</span>
                                    </motion.div>
                                ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Terminal Feed */}
            <div className="flex-1 min-h-0 bg-[#0d1117] rounded-xl border border-white/5 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-slate-800/30">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">agdi build output</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
                    {terminalLogs.map((log, i) => (
                        <div key={i} className={`
                            ${log.includes('✅') || log.includes('✓') ? 'text-emerald-400' : ''}
                            ${log.includes('❌') ? 'text-red-400' : ''}
                            ${log.includes('📦') || log.includes('🚀') ? 'text-cyan-400' : ''}
                            ${!log.includes('✅') && !log.includes('❌') && !log.includes('📦') && !log.includes('🚀') && !log.includes('✓') ? 'text-slate-400' : ''}
                        `}>
                            {log}
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>

            {/* Success Celebration */}
            <AnimatePresence>
                {isComplete && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 text-center"
                    >
                        <div className="text-2xl mb-1">🎉</div>
                        <div className="text-emerald-400 font-bold text-sm">Your app is live!</div>
                        <div className="text-slate-400 text-xs mt-1">
                            Built in {elapsedTime}s · {steps.filter(s => s.type === 'create').length} files
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BuildProgress;
