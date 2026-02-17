/**
 * SimpleBuilder — Non-developer build experience
 *
 * A single, clean page that shows the agent working in plain language.
 * No code, no terminal — just friendly progress messages and then
 * the live preview of the finished app.
 *
 * Flow:
 *   1. "Designing your app..." with progress steps
 *   2. Files being "created" shown as simple cards
 *   3. "Installing and starting..." spinner
 *   4. Full live preview iframe when ready
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, Download, Loader2 } from 'lucide-react';
import { generateAppPlan, type AppPlan } from '../lib/agdi-architect';
import { callCloudAPI } from '../lib/cloud-api';
import { WebContainerService } from '../lib/webcontainer';

interface SimpleBuilderProps {
    wizardSpec: string;
    onBack?: () => void;
}

type BuildPhase =
    | 'designing'
    | 'coding'
    | 'installing'
    | 'starting'
    | 'ready'
    | 'error';

interface AgentMessage {
    text: string;
    type: 'info' | 'success' | 'error' | 'file';
    timestamp: number;
}

const PHASE_LABELS: Record<BuildPhase, { title: string; subtitle: string; icon: string }> = {
    designing: { title: 'Designing your app', subtitle: 'Our AI architect is planning the best structure...', icon: '🧠' },
    coding: { title: 'Writing code', subtitle: 'Our engineers are building every page and feature...', icon: '⚙️' },
    installing: { title: 'Setting everything up', subtitle: 'Installing libraries and preparing your app...', icon: '📦' },
    starting: { title: 'Starting your app', subtitle: 'Almost there! Booting up the live preview...', icon: '🚀' },
    ready: { title: 'Your app is ready!', subtitle: 'Here\'s what we built for you.', icon: '🎉' },
    error: { title: 'Something went wrong', subtitle: 'Don\'t worry — we can try again.', icon: '⚠️' },
};

const SimpleBuilder: React.FC<SimpleBuilderProps> = ({ wizardSpec, onBack }) => {
    const [phase, setPhase] = useState<BuildPhase>('designing');
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [filesCount, setFilesCount] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const startRef = useRef(Date.now());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasStarted = useRef(false);

    const addMessage = useCallback((text: string, type: AgentMessage['type'] = 'info') => {
        setMessages(prev => [...prev, { text, type, timestamp: Date.now() }]);
    }, []);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Timer
    useEffect(() => {
        if (phase === 'ready' || phase === 'error') return;
        const t = setInterval(() => setElapsedTime(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
        return () => clearInterval(t);
    }, [phase]);

    // Main build pipeline
    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        runBuild();
    }, []);

    const runBuild = async () => {
        try {
            // Phase 1: Architect — try cloud API first, fallback to local
            setPhase('designing');
            addMessage('Starting to design your application...', 'info');
            addMessage('Connecting to Agdi Cloud...', 'info');

            let plan: AppPlan;
            try {
                plan = await callCloudAPI(wizardSpec, undefined, 'business_owner');
                addMessage('Cloud AI selected the best model for your project!', 'success');
            } catch (cloudErr) {
                // Fallback to local generation (AI or offline template)
                const cloudMsg = cloudErr instanceof Error ? cloudErr.message : 'Cloud unavailable';
                addMessage(`Cloud API: ${cloudMsg}. Using local engine...`, 'info');
                addMessage('Generating your app locally...', 'info');
                plan = await generateAppPlan(wizardSpec, 'gemini-2.5-flash');
            }

            addMessage(`Blueprint ready! Planning ${plan.files.length} files.`, 'success');
            setFilesCount(plan.files.length);

            // Phase 2: Show files
            setPhase('coding');
            addMessage('Writing code for your app...', 'info');

            // Animate file creation messages (staggered)
            for (const file of plan.files) {
                addMessage(`Created ${file.path}`, 'file');
                await new Promise(r => setTimeout(r, 150)); // Brief visual stagger
            }

            addMessage(`All ${plan.files.length} files written!`, 'success');

            // Phase 3: Install
            setPhase('installing');
            addMessage('Installing dependencies...', 'info');

            await WebContainerService.mountFiles(plan.files, plan.dependencies, () => { });
            const exitCode = await WebContainerService.installDependencies(() => { });

            if (exitCode !== 0) throw new Error('Failed to install dependencies');
            addMessage('Dependencies installed successfully!', 'success');

            // Phase 4: Start
            setPhase('starting');
            addMessage('Booting up your live app...', 'info');

            const url = await WebContainerService.startDevServer(() => { });
            setIframeUrl(url);

            setPhase('ready');
            addMessage('Your app is live! 🎉', 'success');

        } catch (error) {
            console.error(error);
            setPhase('error');
            setErrorMsg(error instanceof Error ? error.message : 'Unknown error');
            addMessage(`Error: ${error instanceof Error ? error.message : 'Something went wrong'}`, 'error');
        }
    };

    const phaseInfo = PHASE_LABELS[phase];
    const progressPercent =
        phase === 'designing' ? 15 :
            phase === 'coding' ? 45 :
                phase === 'installing' ? 70 :
                    phase === 'starting' ? 90 :
                        phase === 'ready' ? 100 :
                            0;

    return (
        <div className="h-screen w-full flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl flex-shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">{elapsedTime}s</span>
                    {phase !== 'ready' && phase !== 'error' && (
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                {/* Left Panel — Agent Activity */}
                <div className={`${iframeUrl ? 'lg:w-[360px]' : 'w-full max-w-2xl mx-auto'} flex flex-col p-6 gap-6 transition-all duration-500`}>
                    {/* Phase Header */}
                    <motion.div
                        key={phase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center lg:text-left"
                    >
                        <div className="text-4xl mb-3">{phaseInfo.icon}</div>
                        <h1 className="text-2xl font-bold text-white">{phaseInfo.title}</h1>
                        <p className="text-slate-400 text-sm mt-1">{phaseInfo.subtitle}</p>
                    </motion.div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Progress</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{
                                    background: phase === 'ready'
                                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                                        : phase === 'error'
                                            ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                            : 'linear-gradient(90deg, #06b6d4, #a855f7)',
                                }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                    </div>

                    {/* Stats */}
                    {filesCount > 0 && (
                        <div className="flex gap-4">
                            <div className="flex-1 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                                <div className="text-xl font-bold text-white">{filesCount}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Files</div>
                            </div>
                            <div className="flex-1 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                                <div className="text-xl font-bold text-white">{elapsedTime}s</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Time</div>
                            </div>
                        </div>
                    )}

                    {/* Activity Feed */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex items-start gap-2.5 text-sm p-2.5 rounded-lg ${msg.type === 'success' ? 'bg-emerald-500/5' :
                                        msg.type === 'error' ? 'bg-red-500/5' :
                                            msg.type === 'file' ? 'bg-cyan-500/5' :
                                                'bg-white/[0.02]'
                                        }`}
                                >
                                    <span className="flex-shrink-0 mt-0.5">
                                        {msg.type === 'success' ? '✅' :
                                            msg.type === 'error' ? '❌' :
                                                msg.type === 'file' ? '📄' : '💡'}
                                    </span>
                                    <span className={
                                        msg.type === 'success' ? 'text-emerald-300' :
                                            msg.type === 'error' ? 'text-red-300' :
                                                msg.type === 'file' ? 'text-cyan-300 font-mono text-xs' :
                                                    'text-slate-300'
                                    }>
                                        {msg.text}
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Error retry */}
                    {phase === 'error' && (
                        <button
                            onClick={() => {
                                setPhase('designing');
                                setMessages([]);
                                setErrorMsg('');
                                hasStarted.current = false;
                                startRef.current = Date.now();
                                runBuild();
                            }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-500 hover:from-cyan-400 hover:to-cyan-400 text-white font-bold text-sm transition-all"
                        >
                            🔄 Try Again
                        </button>
                    )}

                    {/* Ready actions */}
                    {phase === 'ready' && (
                        <div className="space-y-2">
                            {iframeUrl && (
                                <a
                                    href={iframeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open in New Tab
                                </a>
                            )}
                            <button
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/10 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Download as ZIP
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel — Live Preview (appears when ready) */}
                <AnimatePresence>
                    {iframeUrl && (
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                            className="flex-1 flex flex-col border-l border-white/5 min-h-0"
                        >
                            {/* Preview Header */}
                            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 border-b border-white/5">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                                </div>
                                <div className="flex-1 h-8 rounded-lg bg-slate-800/50 border border-white/5 flex items-center px-3">
                                    <span className="text-xs text-slate-400 font-mono truncate">{iframeUrl}</span>
                                </div>
                            </div>
                            {/* Iframe */}
                            <div className="flex-1 bg-white">
                                <iframe
                                    src={iframeUrl}
                                    title="App Preview"
                                    className="w-full h-full border-0"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* No API Key Modal needed — business owners use cloud API */}
        </div>
    );
};

export default SimpleBuilder;
