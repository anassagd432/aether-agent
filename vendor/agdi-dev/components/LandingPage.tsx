
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Hero from './Hero';
import SquadVisualizer from './SquadVisualizer';
import {
   Box,
   Terminal,
   Database,
   Globe2,
   ShieldCheck,
   Zap,
   Code,
   Share2,
   CheckCircle2,
   Brain,
   Shield,
   Activity,
   Key,
   ChevronDown,
   Cpu,
   Lock,
   MessageSquare
} from 'lucide-react';
import { Page } from '../types';

interface LandingPageProps {
   initialSection?: string;
   onNavigate?: (page: Page) => void;
}

// ==================== FAQ DATA & COMPONENT ====================

const FAQ_DATA = [
   {
      q: "What exactly is Agdi?",
      a: "Agdi is an autonomous AI employee that builds full-stack web applications from natural language. Describe what you want in plain English, and a squad of 6 specialized AI agents plans, codes, tests, self-heals, and deploys your app \u2014 without human intervention."
   },
   {
      q: "Do I need my own API keys?",
      a: "It depends. With the CLI, you need your own keys (Gemini, OpenAI, OpenRouter, etc.). With the Web IDE, free-tier users get Cloud AI with no keys needed. Pro and Business plans include higher Cloud AI limits. You can always bring your own keys for full model access."
   },
   {
      q: "Are my API keys safe?",
      a: "Yes \u2014 100%. Your keys are stored locally in your browser (localStorage) and are sent directly from your browser to the LLM provider. They never touch Agdi servers. The CLI stores keys in your local filesystem only."
   },
   {
      q: "Which AI models are supported?",
      a: "13 models across 7 providers: GPT-5.2 Codex, GPT-4.1 (OpenAI), Gemini 2.5 Flash/Pro (Google), Claude Sonnet 4 (Anthropic), DeepSeek V3/R1, Llama 4 Scout/Maverick (Meta), Qwen3 (Alibaba), and more via OpenRouter."
   },
   {
      q: "Is Agdi free?",
      a: "The CLI is free forever with your own API keys. The Web IDE has a free tier (3 apps/month, 5 Cloud AI calls/day). Pro ($19/mo) and Business ($49/mo) plans offer more capacity, more models, and unlimited follow-ups."
   },
   {
      q: "How is this different from ChatGPT or Copilot?",
      a: "ChatGPT gives you code snippets. Copilot autocompletes lines. Agdi builds entire applications \u2014 it plans the architecture, creates all files, wires up routing, handles styling, runs tests, and can deploy. It's not an assistant, it's an autonomous engineer."
   },
];

// ==================== ANIMATION HELPERS ====================

const EASE_SNAP = [0.25, 0.4, 0.25, 1] as [number, number, number, number];
// Smooth "expo" ease for hero / section reveals
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as [number, number, number, number];

const sectionVariants = {
   hidden: { opacity: 0, y: 20 },
   visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.5, ease: EASE_SNAP },
   },
};

const staggerContainer = {
   hidden: { opacity: 0 },
   visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
   },
};

const cardVariants = {
   hidden: { opacity: 0, y: 15, scale: 0.98 },
   visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.4, ease: EASE_SNAP },
   },
};

const FAQSection: React.FC = () => {
   const [openIndex, setOpenIndex] = useState<number | null>(null);
   return (
      <section className="py-24 relative">
         <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
         <div className="container mx-auto px-6 lg:px-12 max-w-3xl">
            <motion.div
               className="text-center mb-16"
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true, amount: 0.5 }}
               variants={sectionVariants}
            >
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-sm font-tech">
                  <MessageSquare className="w-3 h-3" /> FAQ
               </div>
               <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 drop-shadow-xl font-tech">Questions?</h2>
            </motion.div>

            <motion.div
               className="space-y-3"
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true, amount: 0.2 }}
               variants={staggerContainer}
            >
               {FAQ_DATA.map((faq, i) => (
                  <motion.div key={i} variants={cardVariants} className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-white/20">
                     <button
                        onClick={() => setOpenIndex(openIndex === i ? null : i)}
                        className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                     >
                        <span className="font-medium text-white pr-4">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} />
                     </button>
                     <div className={`overflow-hidden transition-all duration-500 ease-in-out ${openIndex === i ? 'max-h-60 pb-5' : 'max-h-0'}`}>
                        <p className="px-5 text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                     </div>
                  </motion.div>
               ))}
            </motion.div>
         </div>
      </section>
   );
};

// ==================== ANIMATED ARCHITECT VIEW ====================

const LOG_MESSAGES: { tag: string; tagColor: string; text: string; textColor: string }[] = [
   { tag: '[SYSTEM]', tagColor: 'text-cyan-400', text: 'Initializing Architect Core...', textColor: 'text-slate-400' },
   { tag: '[PLANNER]', tagColor: 'text-cyan-400', text: 'Analyzing user intent: "CRM Dashboard"', textColor: 'text-slate-300' },
   { tag: '[CONTEXT]', tagColor: 'text-cyan-400', text: 'Indexing repository \u2014 847 files scanned', textColor: 'text-slate-300' },
   { tag: '[SECURITY]', tagColor: 'text-cyan-400', text: 'SOC2 Compliance Check: PASSED', textColor: 'text-cyan-400' },
   { tag: '[ARCHITECT]', tagColor: 'text-cyan-400', text: 'Generating project scaffold...', textColor: 'text-slate-300' },
   { tag: '[ENGINEER]', tagColor: 'text-cyan-400', text: 'Writing src/components/DashboardLayout.tsx', textColor: 'text-slate-300' },
   { tag: '[ENGINEER]', tagColor: 'text-cyan-400', text: 'Writing src/components/MetricsCard.tsx', textColor: 'text-slate-300' },
   { tag: '[QA]', tagColor: 'text-cyan-400', text: 'Running test suite \u2014 24/24 passed \u2713', textColor: 'text-cyan-400' },
   { tag: '[DEVOPS]', tagColor: 'text-cyan-400', text: 'Build optimized \u2014 142kB gzipped', textColor: 'text-slate-300' },
   { tag: '[SECURITY]', tagColor: 'text-cyan-400', text: 'Code Firewall scan: 0 vulnerabilities', textColor: 'text-cyan-400' },
   { tag: '[DEVOPS]', tagColor: 'text-cyan-400', text: 'Deploying to Vercel... Domain assigned', textColor: 'text-slate-300' },
   { tag: '[SYSTEM]', tagColor: 'text-cyan-400', text: '\u2705 Build complete \u2014 shipped to production', textColor: 'text-emerald-400' },
];

type AgentStatus = 'Active' | 'Pending' | 'Idle' | 'Done';
const STATUS_COLORS: Record<AgentStatus, { dot: string; text: string }> = {
   Active: { dot: 'bg-green-500', text: 'text-cyan-400' },
   Pending: { dot: 'bg-yellow-500', text: 'text-yellow-400' },
   Idle: { dot: 'bg-slate-600', text: 'text-slate-500' },
   Done: { dot: 'bg-cyan-500', text: 'text-cyan-400' },
};
const AGENT_CYCLES: AgentStatus[][] = [
   ['Active', 'Active', 'Done', 'Idle'],
   ['Idle', 'Pending', 'Active', 'Done'],
   ['Idle', 'Idle', 'Pending', 'Active'],
   ['Idle', 'Idle', 'Idle', 'Active'],
];

const ArchitectViewAnimated: React.FC = () => {
   const [visibleLogs, setVisibleLogs] = useState<number>(0);
   const [agentPhase, setAgentPhase] = useState(0);
   const [progress, setProgress] = useState(0);
   const [tokensPerSec, setTokensPerSec] = useState(0);
   const [latency, setLatency] = useState(0);
   const [filesCount, setFilesCount] = useState(0);
   const logContainerRef = React.useRef<HTMLDivElement>(null);

   // Log typewriter
   React.useEffect(() => {
      const timer = setInterval(() => {
         setVisibleLogs(prev => {
            if (prev >= LOG_MESSAGES.length) return 0;
            return prev + 1;
         });
      }, 1800);
      return () => clearInterval(timer);
   }, []);

   // Auto-scroll logs
   React.useEffect(() => {
      if (logContainerRef.current) {
         logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
   }, [visibleLogs]);

   // Agent status cycling
   React.useEffect(() => {
      const timer = setInterval(() => {
         setAgentPhase(prev => (prev + 1) % AGENT_CYCLES[0].length);
      }, 2500);
      return () => clearInterval(timer);
   }, []);

   // Progress bar
   React.useEffect(() => {
      const timer = setInterval(() => {
         setProgress(prev => (prev >= 100 ? 0 : prev + 1));
      }, 120);
      return () => clearInterval(timer);
   }, []);

   // Count-up metrics
   React.useEffect(() => {
      const TARGET_TOKENS = 4200;
      const TARGET_LATENCY = 12;
      const TARGET_FILES = 14;
      const duration = 2000;
      const startTime = Date.now();
      let raf: number;

      const animate = () => {
         const elapsed = Date.now() - startTime;
         const t = Math.min(elapsed / duration, 1);
         const ease = 1 - Math.pow(1 - t, 3);

         setTokensPerSec(Math.round(TARGET_TOKENS * ease));
         setLatency(Math.round(TARGET_LATENCY * ease));
         setFilesCount(Math.round(TARGET_FILES * ease));

         if (t < 1) raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(raf);
   }, []);

   const agents = [
      { name: 'Architect', Icon: Brain, color: 'text-cyan-400' },
      { name: 'Engineer', Icon: Code, color: 'text-cyan-400' },
      { name: 'QA Bot', Icon: Shield, color: 'text-cyan-400' },
      { name: 'DevOps', Icon: Globe2, color: 'text-cyan-400' },
   ];

   return (
      <div className="relative">
         <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-cyan-400/10 blur-3xl rounded-full"></div>
         <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl">
            {/* Window Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
               <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-sm font-medium text-white">Agdi Architect View</span>
                  <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-cyan-400 border border-green-500/30 animate-pulse">LIVE</span>
               </div>
               <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 hover:bg-red-500 transition-colors cursor-pointer"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 animate-pulse"></div>
               </div>
            </div>

            {/* Neural Stream (Animated Log) */}
            <div
               ref={logContainerRef}
               className="bg-slate-950/80 rounded-lg p-3 mb-3 border border-white/5 font-mono text-[10px] leading-relaxed h-28 overflow-hidden relative"
            >
               <div className="space-y-1">
                  {LOG_MESSAGES.slice(0, visibleLogs).map((msg, i) => (
                     <div key={i} className="transition-opacity duration-300" style={{ opacity: 1 }}>
                        <span className={msg.tagColor}>{msg.tag}</span>{' '}
                        <span className={msg.textColor}>{msg.text}</span>
                     </div>
                  ))}
               </div>
               <div className="absolute bottom-3 right-3 w-1.5 h-3 bg-cyan-400 animate-pulse"></div>
            </div>

            {/* Agent Swarm & Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-3">
               <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Agent Swarm</div>
                  <div className="space-y-2">
                     {agents.map((agent, idx) => {
                        const status = AGENT_CYCLES[idx][agentPhase];
                        const sc = STATUS_COLORS[status];
                        return (
                           <div key={agent.name} className="flex items-center gap-2">
                              <agent.Icon className={`w-3 h-3 ${agent.color}`} />
                              <span className="text-[10px] text-slate-300">{agent.name}</span>
                              <div className="ml-auto flex items-center gap-1">
                                 <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${sc.dot} ${status === 'Active' ? 'animate-pulse' : ''}`}></div>
                                 <span className={`text-[9px] transition-colors duration-500 ${sc.text}`}>{status}</span>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>

               <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Metrics</div>
                  <div className="space-y-2">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Tokens/Sec</span>
                        <span className="text-[11px] text-cyan-400 font-bold font-mono">{tokensPerSec.toLocaleString()}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Latency</span>
                        <span className="text-[11px] text-cyan-400 font-bold font-mono">{latency}ms</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Files</span>
                        <span className="text-[11px] text-white font-bold font-mono">{filesCount}/14</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Build Progress (Animated) */}
            <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
               <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Build Progress</span>
                  <span className={`text-[10px] font-mono ${progress >= 100 ? 'text-cyan-400' : 'text-cyan-400'}`}>
                     {progress >= 100 ? '\u2713 Done' : `${progress}%`}
                  </span>
               </div>
               <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                     className={`h-full rounded-full transition-all duration-150 ease-linear ${progress >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                        }`}
                     style={{ width: `${progress}%` }}
                  ></div>
               </div>
            </div>
         </div>
      </div>
   );
};

const LandingPage: React.FC<LandingPageProps> = ({ initialSection, onNavigate }) => {

   const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth' });
      }
   };

   useEffect(() => {
      if (initialSection) {
         // Small timeout to ensure DOM is ready
         setTimeout(() => scrollToSection(initialSection), 100);
      }
   }, [initialSection]);

   return (
      <div className="w-full">
         <Hero
            onScrollToSection={scrollToSection}
            onNavigate={onNavigate}
         />

         {/* PRODUCTS SECTION - Transparent/Glass */}
         <section id="products" className="py-24 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className="container mx-auto px-6 lg:px-12 relative z-10">
               <motion.div
                  className="text-center mb-16"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.5 }}
                  variants={sectionVariants}
               >
                  <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 drop-shadow-xl font-tech">Meet the Squad</h2>
                  <p className="text-slate-300 max-w-2xl mx-auto text-lg drop-shadow-md">
                     Six specialized AI agents working together to build your vision. No hallucinated code.
                  </p>
               </motion.div>

               <motion.div
                  className="mb-8 relative group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT_EXPO }}
               >
                  <SquadVisualizer />
               </motion.div>

            </div>
         </section>

         {/* DEEP CONTEXT & DEPLOYMENT SECTION */}
         <section className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-transparent"></div>
            <div className="container mx-auto px-6 lg:px-12 relative z-10">
               <motion.div
                  className="grid grid-cols-1 lg:grid-cols-2 gap-16"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  variants={staggerContainer}
               >
                  {/* Feature 1: Deep Context */}
                  <motion.div variants={cardVariants} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 lg:p-12 hover:border-cyan-500/20 transition-all duration-500 group">
                     <div className="w-14 h-14 rounded-2xl bg-cyan-950/30 flex items-center justify-center mb-8 group-hover:bg-cyan-900/40 transition-colors duration-200">
                        <Brain className="w-7 h-7 text-cyan-400" />
                     </div>
                     <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 font-tech">Deep Context Engine</h3>
                     <p className="text-slate-400 leading-relaxed mb-8">
                        Agdi doesn't just guess. It indexes your entire repository, understands dependencies, and performs semantic code search to make changes that actually compile.
                     </p>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Semantic Code Indexing
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Dependency Graph Analysis
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Babel/TypeScript AST Parsing
                        </li>
                     </ul>
                  </motion.div>

                  {/* Feature 2: Zero-Touch Deployment */}
                  <motion.div variants={cardVariants} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 lg:p-12 hover:border-cyan-500/20 transition-all duration-500 group">
                     <div className="w-14 h-14 rounded-2xl bg-cyan-950/30 flex items-center justify-center mb-8 group-hover:bg-cyan-900/40 transition-colors duration-200">
                        <Globe2 className="w-7 h-7 text-cyan-400" />
                     </div>
                     <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 font-tech">Zero-Touch Deployment</h3>
                     <p className="text-slate-400 leading-relaxed mb-8">
                        Forget CI/CD pipelines. The DevOps agent handles it all. Just add your tokens, and Agdi ships your app to Vercel or Netlify instantly.
                     </p>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-300">agdi squad --deploy</code>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Vercel & Netlify Support
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Automated Build Verification
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-300">
                           <CheckCircle2 className="w-5 h-5 text-cyan-500/80" /> Zero-Config Domains
                        </li>
                     </ul>
                  </motion.div>
               </motion.div>
            </div>
         </section>

         {/* SOLUTIONS SECTION - Transparent/Glass */}
         <section id="solutions" className="py-24 relative">
            <div className="absolute inset-0 bg-transparent"></div>
            <div className="container mx-auto px-6 lg:px-12 relative z-10">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <motion.div
                     initial="hidden"
                     whileInView="visible"
                     viewport={{ once: true, amount: 0.3 }}
                     variants={staggerContainer}
                  >
                     <motion.div variants={cardVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-sm font-tech">
                        Enterprise Ready
                     </motion.div>
                     <motion.h2 variants={cardVariants} className="text-3xl lg:text-5xl font-bold text-white mb-6 drop-shadow-xl font-tech">Solutions for every scale.</motion.h2>
                     <div className="space-y-8">
                        <motion.div variants={cardVariants} className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                           <div className="mt-1">
                              <Globe2 className="w-6 h-6 text-cyan-400" />
                           </div>
                           <div>
                              <h4 className="text-lg font-bold text-white">Startup Velocity</h4>
                              <p className="text-slate-400 text-sm mt-1">Go from napkin sketch to Series A product in days. Iterate on feedback instantly.</p>
                           </div>
                        </motion.div>
                        <motion.div variants={cardVariants} className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                           <div className="mt-1">
                              <ShieldCheck className="w-6 h-6 text-cyan-400" />
                           </div>
                           <div>
                              <h4 className="text-lg font-bold text-white">Agency Scale</h4>
                              <p className="text-slate-400 text-sm mt-1">Deliver 10x more client projects without hiring more junior devs. Agdi handles the grunt work.</p>
                           </div>
                        </motion.div>
                     </div>
                  </motion.div>
                  <motion.div
                     initial={{ opacity: 0, x: 30, scale: 0.95 }}
                     whileInView={{ opacity: 1, x: 0, scale: 1 }}
                     viewport={{ once: true, amount: 0.3 }}
                     transition={{ duration: 0.8, delay: 0.2, ease: EASE_OUT_EXPO }}
                  >
                     <ArchitectViewAnimated />
                  </motion.div>
               </div>
            </div>
         </section>

         {/* DEVELOPERS SECTION - Transparent/Glass */}
         <section id="developers" className="py-24 relative overflow-hidden">
            <div className="container mx-auto px-6 lg:px-12">
               <motion.div
                  className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 lg:p-16 relative overflow-hidden shadow-2xl"
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
               >
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                  <motion.div
                     className="relative z-10 text-center max-w-3xl mx-auto"
                     initial="hidden"
                     whileInView="visible"
                     viewport={{ once: true, amount: 0.5 }}
                     variants={staggerContainer}
                  >
                     <motion.div variants={cardVariants} className="mb-6 flex justify-center">
                        <Code className="w-10 h-10 text-white" />
                     </motion.div>
                     <motion.h2 variants={cardVariants} className="text-3xl lg:text-4xl font-bold text-white mb-6 font-tech">Built by developers, for developers.</motion.h2>
                     <motion.p variants={cardVariants} className="text-slate-300 text-lg mb-8">
                        We don't lock you in. Agdi exports clean, idiomatic React and Node.js code that you can commit to GitHub and maintain manually if you choose.
                     </motion.p>
                     <motion.div variants={cardVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                           onClick={() => onNavigate && onNavigate(Page.WIZARD)}
                           className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-white font-bold hover:from-cyan-300 hover:to-cyan-400 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                        >
                           <Zap className="w-4 h-4" />
                           ✨ Start Building
                        </button>
                        <button
                           onClick={() => onNavigate && onNavigate(Page.DOCS)}
                           className="px-6 py-3 rounded-xl bg-slate-800/50 text-white font-medium hover:bg-slate-700/50 transition-colors flex items-center gap-2 border border-slate-700 backdrop-blur-md cursor-pointer"
                        >
                           <Share2 className="w-4 h-4" />
                           View Documentation
                        </button>
                        <button
                           onClick={() => onNavigate && onNavigate(Page.PRICING)}
                           className="px-6 py-3 rounded-xl bg-slate-800/50 text-white font-medium hover:bg-slate-700/50 transition-colors flex items-center gap-2 border border-slate-700 backdrop-blur-md cursor-pointer"
                        >
                           💎 View Pricing
                        </button>
                     </motion.div>
                  </motion.div>
               </motion.div>
            </div>
         </section>

         {/* WHY AGDI SECTION */}
         <section className="py-24 relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <div className="container mx-auto px-6 lg:px-12">
               <motion.div
                  className="text-center mb-16"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.5 }}
                  variants={sectionVariants}
               >
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-sm font-tech">
                     Why Agdi
                  </div>
                  <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 drop-shadow-xl font-tech">Built different.</h2>
                  <p className="text-slate-300 max-w-2xl mx-auto">Your keys, your models, your data. Zero lock-in by design.</p>
               </motion.div>

               <motion.div
                  className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  variants={staggerContainer}
               >
                  {/* Card 1: BYOK */}
                  <motion.div variants={cardVariants} className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 flex flex-col hover:bg-slate-900/60 hover:border-cyan-500/30 transition-all duration-500 group">
                     <div className="w-14 h-14 rounded-2xl bg-cyan-950/30 flex items-center justify-center mb-6 group-hover:bg-cyan-900/40 transition-colors">
                        <Key className="w-7 h-7 text-cyan-400" />
                     </div>
                     <h3 className="text-xl font-bold text-white mb-3">Bring Your Own Keys</h3>
                     <p className="text-slate-400 text-sm mb-6 flex-1">
                        Use API keys from Google, OpenAI, Anthropic, DeepSeek, or OpenRouter. Your keys stay in your browser — never sent to our servers.
                     </p>
                     <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> 13 models across 7 providers
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Free models via OpenRouter
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Automatic failover between providers
                        </li>
                     </ul>
                  </motion.div>

                  {/* Card 2: Security — elevated center card */}
                  <motion.div variants={cardVariants} className="p-8 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-cyan-500/40 flex flex-col relative shadow-[0_0_50px_rgba(34,211,238,0.12)] transform md:-translate-y-4 group">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                        Zero Trust
                     </div>
                     <div className="w-14 h-14 rounded-2xl bg-cyan-950/30 flex items-center justify-center mb-6 group-hover:bg-cyan-900/40 transition-colors">
                        <Lock className="w-7 h-7 text-cyan-400" />
                     </div>
                     <h3 className="text-xl font-bold text-white mb-3">Enterprise Security</h3>
                     <p className="text-slate-400 text-sm mb-6 flex-1">
                        Code Firewall scans all AI output. Permission Gate controls operations. Every action is audited. CSP, HSTS, CORS — all enforced.
                     </p>
                     <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Code Firewall blocks injections
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Audit trail for all operations
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> SOC2-ready security headers
                        </li>
                     </ul>
                  </motion.div>

                  {/* Card 3: Multi-Model */}
                  <motion.div variants={cardVariants} className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/10 flex flex-col hover:bg-slate-900/60 hover:border-cyan-500/30 transition-all duration-500 group">
                     <div className="w-14 h-14 rounded-2xl bg-cyan-950/30 flex items-center justify-center mb-6 group-hover:bg-cyan-900/40 transition-colors">
                        <Cpu className="w-7 h-7 text-cyan-400" />
                     </div>
                     <h3 className="text-xl font-bold text-white mb-3">Multi-Model Intelligence</h3>
                     <p className="text-slate-400 text-sm mb-6 flex-1">
                        Each agent picks the best model for the job. GPT-5 for reasoning, Gemini for speed, DeepSeek for code — automatically routed.
                     </p>
                     <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Smart model routing per task
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Context-aware model selection
                        </li>
                        <li className="flex items-center gap-2 text-slate-300">
                           <CheckCircle2 className="w-4 h-4 text-cyan-500" /> Cost optimization built-in
                        </li>
                     </ul>
                  </motion.div>
               </motion.div>
            </div>
         </section>

         {/* FAQ SECTION */}
         <FAQSection />

         {/* FOOTER */}
         <motion.footer
            className="py-12 border-t border-white/5 bg-slate-950/30 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
         >
            <motion.div
               className="container mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12"
               initial="hidden"
               whileInView="visible"
               viewport={{ once: true, amount: 0.2 }}
               variants={staggerContainer}
            >
               <motion.div variants={cardVariants}>
                  <div className="text-lg font-bold text-white mb-4">Agdi</div>
                  <p className="text-slate-500 text-sm">The Autonomous AI Employee. Describe what you want, Agdi builds it.</p>
               </motion.div>
               <motion.div variants={cardVariants}>
                  <h4 className="text-white font-bold mb-4">Product</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                     <li><button onClick={() => onNavigate && onNavigate(Page.WIZARD)} className="hover:text-cyan-400 transition-colors cursor-pointer">Web IDE</button></li>
                     <li><a href="https://www.npmjs.com/package/agdi" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">CLI (npm)</a></li>
                     <li><button onClick={() => onNavigate && onNavigate(Page.PRICING)} className="hover:text-cyan-400 transition-colors cursor-pointer">Pricing</button></li>
                     <li><button onClick={() => onNavigate && onNavigate(Page.DOCS)} className="hover:text-cyan-400 transition-colors cursor-pointer">Documentation</button></li>
                  </ul>
               </motion.div>
               <motion.div variants={cardVariants}>
                  <h4 className="text-white font-bold mb-4">Company</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                     <li><button onClick={() => onNavigate && onNavigate(Page.ABOUT)} className="hover:text-cyan-400 transition-colors cursor-pointer">About</button></li>
                     <li><button onClick={() => onNavigate && onNavigate(Page.LEGAL)} className="hover:text-cyan-400 transition-colors cursor-pointer">Legal</button></li>
                     <li><button onClick={() => onNavigate && onNavigate(Page.DEDICATION)} className="hover:text-cyan-400 transition-colors cursor-pointer">Dedication</button></li>
                  </ul>
               </motion.div>
               <motion.div variants={cardVariants}>
                  <h4 className="text-white font-bold mb-4">Community</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                     <li><a href="https://discord.gg/pPkZ93Yb" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">Discord</a></li>
                     <li><a href="https://www.npmjs.com/package/agdi" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">npm</a></li>
                  </ul>
               </motion.div>
            </motion.div>
            <div className="container mx-auto px-6 lg:px-12 text-center text-xs text-slate-600">
               &copy; 2026 Anass Agdi. All rights reserved.
            </div>
         </motion.footer>
      </div>
   );
};

export default LandingPage;
