import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Terminal,
    Cpu,
    Rocket,
    Globe,
    Layers,
    BrainCircuit,
    LayoutTemplate,
    Database,
    Server,
    AppWindow,
    Container,
    ShieldCheck,
    ArrowRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────
interface AgentNode {
    id: string;
    icon: React.ElementType;
    title: string;
    subtitle: string;
    color: 'cyan' | 'amber' | 'rose' | 'emerald' | 'slate';
}

// ─── Data ────────────────────────────────────────────────────────
const INTERFACES: AgentNode[] = [
    { id: 'web', icon: Globe, title: 'Web IDE', subtitle: 'Browser-based builder', color: 'cyan' },
    { id: 'cli', icon: Terminal, title: 'CLI Agent', subtitle: 'Terminal engineer', color: 'cyan' },
    { id: 'desktop', icon: AppWindow, title: 'Desktop IDE', subtitle: 'Native editor', color: 'cyan' },
];

const SQUAD: AgentNode[] = [
    { id: 'frontend', icon: LayoutTemplate, title: 'Frontend', subtitle: 'React & UI/UX', color: 'amber' },
    { id: 'backend', icon: Server, title: 'Backend', subtitle: 'API & Database', color: 'amber' },
    { id: 'devops', icon: Container, title: 'DevOps', subtitle: 'CI/CD & Infra', color: 'amber' },
];

const MANAGER: AgentNode = { id: 'manager', icon: BrainCircuit, title: 'Manager', subtitle: 'Orchestrator', color: 'amber' };
const QA: AgentNode = { id: 'healing', icon: ShieldCheck, title: 'Self-Healing QA', subtitle: 'Auto-repair', color: 'rose' };
const DEPLOY: AgentNode = { id: 'deploy', icon: Rocket, title: 'Production', subtitle: 'Live deploy', color: 'emerald' };
const MEMORY: AgentNode = { id: 'memory', icon: Database, title: 'Shared Memory', subtitle: 'Context store', color: 'slate' };
const CORE: AgentNode = { id: 'core', icon: Cpu, title: 'Agdi Core', subtitle: 'Decision engine', color: 'slate' };

// ─── Color System ────────────────────────────────────────────────
const COLORS = {
    cyan: {
        border: 'border-cyan-500/30',
        bg: 'bg-cyan-950/50',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/10',
        hoverBorder: 'hover:border-cyan-400/60',
        gradient: 'from-cyan-500 to-cyan-400',
        dot: 'bg-cyan-400',
    },
    amber: {
        border: 'border-cyan-500/30',
        bg: 'bg-cyan-950/50',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/10',
        hoverBorder: 'hover:border-cyan-400/60',
        gradient: 'from-cyan-500 to-cyan-400',
        dot: 'bg-cyan-400',
    },
    rose: {
        border: 'border-rose-500/30',
        bg: 'bg-rose-950/50',
        text: 'text-rose-400',
        glow: 'shadow-rose-500/10',
        hoverBorder: 'hover:border-rose-400/60',
        gradient: 'from-rose-500 to-rose-400',
        dot: 'bg-rose-400',
    },
    emerald: {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-950/50',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/10',
        hoverBorder: 'hover:border-emerald-400/60',
        gradient: 'from-emerald-500 to-emerald-400',
        dot: 'bg-emerald-400',
    },
    slate: {
        border: 'border-slate-600/30',
        bg: 'bg-slate-900/60',
        text: 'text-slate-400',
        glow: 'shadow-slate-500/5',
        hoverBorder: 'hover:border-slate-400/40',
        gradient: 'from-slate-500 to-slate-400',
        dot: 'bg-slate-400',
    },
};

// ─── Card Component ──────────────────────────────────────────────
type NodeCardProps = {
    node: AgentNode;
    delay?: number;
    compact?: boolean;
};

const NodeCard: React.FC<NodeCardProps> = ({
    node,
    delay = 0,
    compact = false,
}) => {
    const theme = COLORS[node.color];
    const Icon = node.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ scale: 1.05, y: -4 }}
            className={`
                relative group cursor-default
                ${compact ? 'p-3' : 'p-4 md:p-5'}
                rounded-2xl backdrop-blur-md border
                ${theme.border} ${theme.bg} ${theme.hoverBorder}
                shadow-lg ${theme.glow}
                transition-all duration-300
            `}
        >
            {/* Glow on hover */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />

            <div className="relative flex flex-col items-center text-center gap-1.5">
                {/* Icon with animated ring */}
                <div className="relative">
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-500`} />
                    <div className={`relative w-10 h-10 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${theme.text}`} />
                    </div>
                </div>

                <h4 className="text-[11px] md:text-xs font-bold text-white tracking-wide uppercase">{node.title}</h4>
                {!compact && <p className="text-[9px] md:text-[10px] text-slate-500 leading-tight">{node.subtitle}</p>}
            </div>

            {/* Active pulse dot */}
            <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${theme.dot} opacity-60`}>
                <div className={`absolute inset-0 rounded-full ${theme.dot} animate-ping`} />
            </div>
        </motion.div>
    );
};

// ─── Animated Arrow ──────────────────────────────────────────────
const FlowArrow = ({ delay = 0, color = 'cyan', vertical = false }: { delay?: number; color?: string; vertical?: boolean }) => {
    const strokeColor = color === 'amber' ? '#22D3EE' : color === 'rose' ? '#fb7185' : color === 'emerald' ? '#34d399' : '#22d3ee';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className={`flex items-center justify-center ${vertical ? 'flex-col' : ''}`}
        >
            {vertical ? (
                <svg width="2" height="32" className="overflow-visible">
                    <line x1="1" y1="0" x2="1" y2="32" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4 4">
                        <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
                    </line>
                </svg>
            ) : (
                <svg width="40" height="12" className="overflow-visible" viewBox="0 0 40 12">
                    <line x1="0" y1="6" x2="32" y2="6" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="4 4">
                        <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
                    </line>
                    <polygon points="30,2 38,6 30,10" fill={strokeColor} opacity="0.8" />
                </svg>
            )}
        </motion.div>
    );
};

// ─── Animated Particle Flow ──────────────────────────────────────
const DataParticle = ({ delay = 0, color = 'cyan' }: { delay?: number; color?: string }) => {
    const bg = color === 'amber' ? 'bg-cyan-400' : color === 'rose' ? 'bg-rose-400' : color === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400';

    return (
        <motion.div
            className={`absolute w-1 h-1 rounded-full ${bg}`}
            initial={{ x: -4, opacity: 0 }}
            animate={{
                x: [0, 40],
                opacity: [0, 1, 1, 0],
            }}
            transition={{
                duration: 1.5,
                delay,
                repeat: Infinity,
                repeatDelay: 2 + Math.random() * 2,
                ease: 'easeInOut',
            }}
        />
    );
};

// ─── Main Component ──────────────────────────────────────────────
const SquadVisualizer = () => {
    const [activePhase, setActivePhase] = useState(0);

    // Cycle through phases for animated highlight
    useEffect(() => {
        const interval = setInterval(() => {
            setActivePhase(p => (p + 1) % 5);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const phases = ['Input', 'Plan', 'Build', 'Verify', 'Deploy'];

    return (
        <div className="w-full select-none">
            {/* Phase Timeline */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center justify-center gap-1 md:gap-2 mb-8"
            >
                {phases.map((phase, i) => (
                    <React.Fragment key={phase}>
                        <motion.div
                            className={`
                                px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider
                                transition-all duration-500 border
                                ${activePhase === i
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/20 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10'
                                    : 'border-white/5 text-slate-500 bg-white/[0.02]'}
                            `}
                            animate={activePhase === i ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.6 }}
                        >
                            {phase}
                        </motion.div>
                        {i < phases.length - 1 && (
                            <div className={`w-4 md:w-8 h-px transition-colors duration-500 ${activePhase > i ? 'bg-cyan-500/50' : 'bg-white/10'}`} />
                        )}
                    </React.Fragment>
                ))}
            </motion.div>

            {/* Architecture Grid - horizontal pipeline */}
            <div className="relative">
                {/* Background grid effect */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
                        backgroundSize: '32px 32px',
                    }} />
                </div>

                <div className="relative rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl p-4 md:p-8 overflow-hidden">
                    {/* Ambient glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/[0.03] blur-[100px] rounded-full pointer-events-none" />

                    {/* Main Flow: Left → Right */}
                    <div className="flex flex-col lg:flex-row items-center gap-3 md:gap-4 relative">

                        {/* Column 1: Interfaces */}
                        <div className="flex flex-row lg:flex-col gap-2 md:gap-3 shrink-0">
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="text-[8px] md:text-[9px] font-bold text-cyan-500/60 uppercase tracking-[0.2em] text-center mb-1 hidden lg:block"
                            >
                                Interfaces
                            </motion.div>
                            {INTERFACES.map((node, i) => (
                                <NodeCard key={node.id} node={node} delay={i * 0.1} compact />
                            ))}
                        </div>

                        {/* Arrow 1 */}
                        <div className="hidden lg:flex items-center relative">
                            <FlowArrow delay={0.3} color="cyan" />
                            <DataParticle delay={0.5} color="cyan" />
                            <DataParticle delay={1.8} color="cyan" />
                        </div>

                        {/* Column 2: Manager */}
                        <div className="shrink-0">
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="text-[8px] md:text-[9px] font-bold text-cyan-500/60 uppercase tracking-[0.2em] text-center mb-1 hidden lg:block"
                            >
                                Brain
                            </motion.div>
                            <NodeCard node={MANAGER} delay={0.3} />
                        </div>

                        {/* Arrow 2 */}
                        <div className="hidden lg:flex items-center relative">
                            <FlowArrow delay={0.5} color="amber" />
                            <DataParticle delay={1} color="amber" />
                            <DataParticle delay={2.3} color="amber" />
                        </div>

                        {/* Column 3: Squad (Parallel) */}
                        <div className="relative shrink-0">
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="text-[8px] md:text-[9px] font-bold text-cyan-500/60 uppercase tracking-[0.2em] text-center mb-1 hidden lg:block"
                            >
                                Parallel Execution
                            </motion.div>
                            {/* Parallel bracket */}
                            <div className="relative">
                                <div className="absolute -left-2 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent hidden lg:block" />
                                <div className="absolute -right-2 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent hidden lg:block" />
                                <div className="flex flex-row lg:flex-col gap-2 md:gap-3">
                                    {SQUAD.map((node, i) => (
                                        <NodeCard key={node.id} node={node} delay={0.5 + i * 0.1} compact />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Arrow 3 */}
                        <div className="hidden lg:flex items-center relative">
                            <FlowArrow delay={0.7} color="rose" />
                            <DataParticle delay={1.5} color="rose" />
                        </div>

                        {/* Column 4: QA */}
                        <div className="shrink-0">
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="text-[8px] md:text-[9px] font-bold text-rose-500/60 uppercase tracking-[0.2em] text-center mb-1 hidden lg:block"
                            >
                                Verify
                            </motion.div>
                            <NodeCard node={QA} delay={0.8} />
                            {/* Feedback loop arrow */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 0.3 }}
                                viewport={{ once: true }}
                                transition={{ delay: 1.2 }}
                                className="hidden lg:flex items-center justify-center mt-1"
                            >
                                <svg width="60" height="24" viewBox="0 0 60 24" className="overflow-visible">
                                    <path d="M 30 2 C 10 2 -5 22 30 22 C 65 22 50 2 30 2" stroke="#fb7185" strokeWidth="0.8" fill="none" strokeDasharray="3 3" opacity="0.5">
                                        <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="2s" repeatCount="indefinite" />
                                    </path>
                                    <text x="30" y="15" textAnchor="middle" fill="#fb7185" fontSize="5" opacity="0.5">retry</text>
                                </svg>
                            </motion.div>
                        </div>

                        {/* Arrow 4 */}
                        <div className="hidden lg:flex items-center relative">
                            <FlowArrow delay={0.9} color="emerald" />
                            <DataParticle delay={2} color="emerald" />
                        </div>

                        {/* Column 5: Deploy */}
                        <div className="shrink-0">
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="text-[8px] md:text-[9px] font-bold text-emerald-500/60 uppercase tracking-[0.2em] text-center mb-1 hidden lg:block"
                            >
                                Ship
                            </motion.div>
                            <NodeCard node={DEPLOY} delay={1.0} />
                        </div>
                    </div>

                    {/* Bottom: Support Layers */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1.1, duration: 0.5 }}
                        className="mt-6 pt-4 border-t border-white/5"
                    >
                        <div className="flex items-center justify-center gap-6 md:gap-10">
                            {/* Memory */}
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/20">
                                <Database className="w-4 h-4 text-slate-500" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-300 block">Shared Memory</span>
                                    <span className="text-[8px] text-slate-600">Context retention</span>
                                </div>
                            </div>

                            {/* Connector dots */}
                            <div className="hidden md:flex items-center gap-1">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-1 h-1 rounded-full bg-slate-700"
                                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                                        transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                                    />
                                ))}
                            </div>

                            {/* Core */}
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/20">
                                <Cpu className="w-4 h-4 text-slate-500" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-300 block">Agdi Core</span>
                                    <span className="text-[8px] text-slate-600">Permission & LLM router</span>
                                </div>
                            </div>

                            {/* Connector dots */}
                            <div className="hidden md:flex items-center gap-1">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-1 h-1 rounded-full bg-slate-700"
                                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                                        transition={{ duration: 1.5, delay: i * 0.3 + 0.5, repeat: Infinity }}
                                    />
                                ))}
                            </div>

                            {/* Security */}
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/20">
                                <ShieldCheck className="w-4 h-4 text-slate-500" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-300 block">Code Firewall</span>
                                    <span className="text-[8px] text-slate-600">Security scanning</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default SquadVisualizer;
