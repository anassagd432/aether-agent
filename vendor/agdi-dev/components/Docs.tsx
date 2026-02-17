import React, { useState } from 'react';
import {
    Book,
    Rocket,
    Key,
    Layers,
    ArrowLeft,
    Copy,
    Check,
    ExternalLink,
    Zap,
    Database,
    Terminal,
    Code2,
    ShieldCheck,
    BrainCircuit,
    Bot,
    Cpu,
    Globe,
    MessageSquare,
} from 'lucide-react';

// ==================== TYPES ====================

type DocSection = 'intro' | 'quickstart' | 'byok' | 'cli' | 'agents' | 'security' | 'architecture';

interface DocNavItem {
    id: DocSection;
    label: string;
    icon: React.ReactNode;
}

interface DocsProps {
    onBack?: () => void;
}

// ==================== NAV ITEMS ====================

const NAV_ITEMS: DocNavItem[] = [
    { id: 'intro', label: 'Introduction', icon: <Book className="w-4 h-4" /> },
    { id: 'quickstart', label: 'Quick Start', icon: <Rocket className="w-4 h-4" /> },
    { id: 'cli', label: 'CLI Reference', icon: <Terminal className="w-4 h-4" /> },
    { id: 'agents', label: 'Agent Squad', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'byok', label: 'API Keys & Models', icon: <Key className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'architecture', label: 'Architecture', icon: <Layers className="w-4 h-4" /> },
];

// ==================== CODE BLOCK COMPONENT ====================

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-4">
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={handleCopy}
                    className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors text-slate-400 hover:text-white"
                    title="Copy to clipboard"
                >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500 font-mono">{language}</span>
                </div>
                <pre className="p-4 overflow-x-auto">
                    <code className="text-sm font-mono text-slate-300 leading-relaxed">{code}</code>
                </pre>
            </div>
        </div>
    );
};

// ==================== INFO BOX COMPONENT ====================

const InfoBox: React.FC<{ title: string; children: React.ReactNode; color?: 'cyan' | 'amber' | 'green' | 'rose' }> = ({
    title,
    children,
    color = 'cyan',
}) => {
    const colors = {
        cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        amber: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        green: 'bg-green-500/10 border-green-500/30 text-green-400',
        rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    };
    return (
        <div className={`p-4 ${colors[color]} border rounded-xl mt-4`}>
            <h4 className="font-bold mb-2">{title}</h4>
            <div className="text-slate-300 text-sm">{children}</div>
        </div>
    );
};

// ==================== TABLE COMPONENT ====================

const DocTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
    <div className="overflow-x-auto my-4">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-white/10">
                    {headers.map((h, i) => (
                        <th key={i} className="text-left py-3 px-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        {row.map((cell, j) => (
                            <td key={j} className={`py-3 px-4 ${j === 0 ? 'font-mono text-cyan-400' : 'text-slate-300'}`}>
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// ==================== SECTION: INTRODUCTION ====================

const IntroSection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                What is Agdi?
            </h1>
            <p className="text-slate-400 text-lg">
                The Autonomous AI Employee — v3.3.5
            </p>
        </div>

        <div className="prose prose-invert max-w-none">
            <p className="text-slate-300 leading-relaxed text-lg">
                Agdi is an autonomous AI agent that <span className="text-cyan-400 font-medium">builds full-stack web applications from natural language</span>.
                Describe your app in plain English, and a squad of specialized AI agents plans the architecture, writes the code, tests it, self-heals errors, and deploys — all without human intervention.
            </p>

            <div className="mt-8 p-6 bg-gradient-to-br from-cyan-500/10 to-cyan-400/05 border border-cyan-500/20 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-cyan-400" />
                    Three Ways to Build
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                        <div className="text-cyan-400 font-bold mb-1 flex items-center gap-2">
                            <Globe className="w-4 h-4" /> Web App
                        </div>
                        <p className="text-slate-400 text-sm">Visual wizard → live builder in browser. No keys needed (Cloud AI).</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                        <div className="text-cyan-400 font-bold mb-1 flex items-center gap-2">
                            <Terminal className="w-4 h-4" /> CLI
                        </div>
                        <p className="text-slate-400 text-sm"><code className="text-cyan-300 bg-slate-800 px-1 rounded">agdi build "..."</code> — bring your own API keys.</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                        <div className="text-green-400 font-bold mb-1 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> WhatsApp
                        </div>
                        <p className="text-slate-400 text-sm">Message the Agdi bot to build apps from chat.</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mt-10 mb-4">Key Features</h2>
            <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Multi-Agent Squad:</strong> 6 specialized AI agents (Manager, Frontend, Backend, DevOps, QA, Orchestrator) working in parallel</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">13+ AI Models:</strong> GPT-5.2, Claude 4.5, Gemini 3, Llama 4, DeepSeek R1, Qwen3, StarCoder2 across 7 providers</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Self-Healing:</strong> QA agent reads stderr, fixes build errors automatically (up to 3 retries)</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Deep Context Engine:</strong> Semantic code indexing, AST parsing, dependency graph, vector embeddings</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">In-Browser IDE:</strong> Full Node.js via WebContainer — chat, edit, preview, terminal</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Zero-Trust Security:</strong> Code Firewall + Permission Gate + Audit Logger on every operation</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">One-Click Deploy:</strong> Ship to Vercel or Netlify instantly</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Voice Input:</strong> Web Speech API — describe your app by talking</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">✓</span>
                    <span><strong className="text-white">Time Travel:</strong> Snapshot-based undo/redo through project history</span>
                </li>
            </ul>
        </div>
    </div>
);

// ==================== SECTION: QUICK START ====================

const QuickStartSection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                Quick Start
            </h1>
            <p className="text-slate-400 text-lg">
                Two ways to start building with Agdi
            </p>
        </div>

        {/* Web IDE */}
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" /> Web IDE
            </h2>

            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">1</span>
                    <h3 className="text-xl font-bold text-white">Visit agdi-dev.vercel.app</h3>
                </div>
                <p className="text-slate-300">
                    Go to <a href="https://agdi-dev.vercel.app" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">agdi-dev.vercel.app <ExternalLink className="w-3 h-3" /></a> — no installation required.
                </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                    <h3 className="text-xl font-bold text-white">Sign Up & Build</h3>
                </div>
                <p className="text-slate-300">
                    Create an account (GitHub or Google) → follow the wizard → describe your app → watch Agdi build it live.
                </p>
                <p className="text-slate-400 text-sm mt-3">
                    Business owners can use <span className="text-green-400 font-medium">Cloud AI</span> (no API keys needed).
                    Developers can bring their own keys for full model access.
                </p>
            </div>

            <InfoBox title="🚧 Coming Soon" color="amber">
                <p>The hosted Web IDE is currently in development. Join our <a href="https://discord.gg/pPkZ93Yb" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">Discord</a> to get notified when it launches!</p>
            </InfoBox>
        </div>

        {/* CLI */}
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" /> CLI (Available Now)
            </h2>

            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">1</span>
                    <h3 className="text-xl font-bold text-white">Install from npm</h3>
                </div>
                <CodeBlock code="npm install -g agdi" language="bash" />
            </div>

            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                    <h3 className="text-xl font-bold text-white">Configure Your API Keys</h3>
                </div>
                <CodeBlock code="agdi auth" language="bash" />
                <p className="text-slate-400 text-sm mt-2">
                    Interactive setup — paste your Gemini, OpenRouter, or OpenAI key.
                </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">3</span>
                    <h3 className="text-xl font-bold text-white">Start Building</h3>
                </div>
                <CodeBlock code={`agdi build "A kanban board app"     # Single-agent build
agdi squad "SaaS dashboard"          # Multi-agent autonomous build
agdi chat                            # Interactive chat session`} language="bash" />
            </div>
        </div>

        <InfoBox title="Requirements" color="amber">
            <ul className="space-y-1">
                <li>• Node.js 20+ (LTS)</li>
                <li>• npm (included with Node.js)</li>
                <li>• API key for at least one LLM provider (see API Keys section)</li>
            </ul>
        </InfoBox>
    </div>
);

// ==================== SECTION: CLI REFERENCE ====================

const CLISection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                CLI Reference
            </h1>
            <p className="text-slate-400 text-lg">
                Agdi CLI v3.3.5 — The Autonomous AI Employee in your terminal
            </p>
        </div>

        <CodeBlock code="npm install -g agdi" language="bash" />

        <DocTable
            headers={['Command', 'Description']}
            rows={[
                ['agdi', 'Launch interactive TUI dashboard'],
                ['agdi build <prompt>', 'Generate an app from a prompt'],
                ['agdi build <prompt> --saas', 'Full SaaS blueprint (Next.js + Prisma + Stripe)'],
                ['agdi build <prompt> --minimal', 'Generate only the requested file(s)'],
                ['agdi build <prompt> --dry-run', 'Show what would be created without writing'],
                ['agdi squad [prompt]', 'Multi-agent autonomous builder (parallel)'],
                ['agdi squad --deploy', 'Build and auto-deploy to Vercel'],
                ['agdi chat', 'Interactive chat session with AI'],
                ['agdi auth', 'Configure API keys (Gemini, OpenRouter, etc.)'],
                ['agdi auth --status', 'Show authentication status'],
                ['agdi config', 'Show current configuration'],
                ['agdi config:telemetry', 'Manage telemetry (enable/disable/dry-run)'],
                ['agdi doctor', 'Run self-diagnosis checks'],
                ['agdi import <url>', 'Import a GitHub repository'],
                ['agdi replay <runId>', 'Replay a previous squad run'],
                ['agdi wizard', 'Interactive setup wizard'],
            ]}
        />

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Squad Command</h2>
        <p className="text-slate-300 mb-4">
            The <code className="text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded">squad</code> command runs the full multi-agent pipeline:
        </p>

        <div className="flex flex-col md:flex-row gap-3 text-sm">
            {['Manager analyses', 'Frontend + Backend + DevOps build (parallel)', 'QA verifies & self-heals', 'Deploy ships'].map((step, i) => (
                <React.Fragment key={i}>
                    <div className="p-3 bg-slate-900/50 border border-white/10 rounded-xl text-center flex-1">
                        <div className="text-cyan-400 font-bold text-xs uppercase mb-1">Step {i + 1}</div>
                        <div className="text-slate-300 text-xs">{step}</div>
                    </div>
                    {i < 3 && <div className="hidden md:flex items-center text-cyan-400">→</div>}
                </React.Fragment>
            ))}
        </div>

        <CodeBlock code={`# Build a full SaaS app with deployment
agdi squad "Build a project management SaaS with auth, billing, and team features" --deploy

# Replay a previous build
agdi replay abc123 --verbose`} language="bash" />

        <InfoBox title="Telemetry Transparency" color="green">
            <p>
                Run <code className="text-cyan-300 bg-slate-800 px-1 rounded">agdi config:telemetry --dry-run</code> to see exactly what data would be sent.
                Your code and secrets are never transmitted.
            </p>
        </InfoBox>
    </div>
);

// ==================== SECTION: AGENTS ====================

const AgentsSection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                Agent Squad
            </h1>
            <p className="text-slate-400 text-lg">
                6 specialized agents working in concert — not a single prompt
            </p>
        </div>

        <DocTable
            headers={['Agent', 'Role', 'Capabilities']}
            rows={[
                ['Manager', 'Orchestrator', 'Analyzes requests, creates specs, coordinates other agents'],
                ['Frontend', 'UI/UX', 'React, Tailwind, component architecture and styling'],
                ['Backend', 'API & Database', 'Server logic, database schemas, REST/GraphQL API design'],
                ['DevOps', 'Infrastructure', 'CI/CD pipelines, Vercel/Netlify deployment, build config'],
                ['QA / Self-Healer', 'Verification', 'Reads stderr, fixes build errors automatically (3 retries)'],
                ['Orchestrator', 'Pipeline', 'Manages parallel execution, agent handoffs, final assembly'],
            ]}
        />

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Core Intelligence</h2>
        <DocTable
            headers={['Module', 'What It Does']}
            rows={[
                ['ThinkingEngine', 'Chain-of-thought reasoning with step-by-step planning'],
                ['SkillManager', 'Loads and executes specialized coding skills (agdi-coder)'],
                ['ModelRouter', 'Auto-selects optimal model per task (reasoning vs. autocomplete vs. long-context)'],
                ['SwarmIntegration', 'Coordinates multi-agent parallel execution'],
                ['SimpleVectorStore', 'In-memory embedding store for semantic code search'],
            ]}
        />

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Deep Context (CLI)</h2>
        <p className="text-slate-300 mb-4">
            The CLI indexes your entire repository before making changes:
        </p>
        <DocTable
            headers={['Component', 'Purpose']}
            rows={[
                ['Repository Indexer', 'Scans and indexes all files in your project'],
                ['TypeScript Parser', 'Babel/TypeScript AST parsing for symbol extraction'],
                ['Dependency Graph', 'Maps module relationships and import chains'],
                ['Embeddings', 'Semantic vector embeddings (MiniLM-L6-v2)'],
                ['Vector Store', 'Nearest-neighbor search for relevant code'],
                ['Context Retriever', 'Pulls most relevant code into AI prompt'],
                ['Brave Search', 'Web search for docs, APIs, best practices'],
            ]}
        />

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Web App Hooks</h2>
        <DocTable
            headers={['Hook', 'Purpose']}
            rows={[
                ['useAutonomousAgent', 'AI agent loop — plan, execute, self-heal'],
                ['useTDDAgent', 'Test-driven development — generate tests, run, fix'],
                ['useTimeTravel', 'Snapshot-based undo/redo for project state'],
                ['useVoiceInput', 'Web Speech API voice recognition'],
                ['useBuilderLogic', 'Builder state machine — files, preview, chat'],
                ['useAuth', 'Supabase authentication state'],
                ['usePermissions', 'Runtime permission management'],
                ['useProjectPersistence', 'IndexedDB project storage'],
                ['useWizard', 'Wizard step state machine'],
                ['useWorkspacePicker', 'Workspace/project selection'],
            ]}
        />
    </div>
);

// ==================== SECTION: BYOK / MODELS ====================

const BYOKSection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                API Keys & Models
            </h1>
            <p className="text-slate-400 text-lg">
                13 models across 7 providers — BYOK or use Cloud AI
            </p>
        </div>

        <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-cyan-400/05 border border-cyan-500/20 rounded-2xl">
            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                Why BYOK?
            </h3>
            <p className="text-slate-300">
                Your API keys never leave your browser. Agdi makes direct calls to LLM providers from your machine,
                ensuring <span className="text-cyan-400 font-medium">complete privacy and control</span> over your data and costs.
            </p>
        </div>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Supported Models</h2>
        <DocTable
            headers={['Provider', 'Models', 'Context', 'Roles']}
            rows={[
                ['OpenAI', 'GPT-5.2 Codex, GPT-4.1', '128K', 'Reasoning, Autocomplete'],
                ['Anthropic', 'Claude 4.5 Sonnet, Claude 4.5 Opus, Claude 3.5 Sonnet', '200K', 'Reasoning, Long Context'],
                ['Google', 'Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Flash', '2M / 1M', 'Reasoning, Autocomplete'],
                ['Meta', 'Llama 4 Maverick', '256K', 'Reasoning, Autocomplete'],
                ['Alibaba', 'Qwen3 Coder', '128K', 'Autocomplete, Reasoning'],
                ['DeepSeek', 'DeepSeek R1, DeepSeek V3', '128K', 'Reasoning, Long Context'],
                ['HuggingFace', 'StarCoder2', '16K', 'Autocomplete'],
            ]}
        />

        <InfoBox title="Model Roles" color="cyan">
            <ul className="space-y-1">
                <li>• <strong>Reasoning</strong> — Complex architectural decisions, planning</li>
                <li>• <strong>Autocomplete</strong> — Fast code generation and completion</li>
                <li>• <strong>Long Context</strong> — Large codebase analysis (up to 2M tokens)</li>
            </ul>
            <p className="mt-2">The <code className="text-cyan-300 bg-slate-800 px-1 rounded">LLMService</code> automatically selects the best model per task with failover support.</p>
        </InfoBox>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Setup</h2>

        <div className="space-y-6">
            {/* Gemini */}
            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-lg">G</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Google Gemini</h3>
                        <span className="text-xs text-green-400 font-medium">FREE TIER AVAILABLE</span>
                    </div>
                </div>
                <p className="text-slate-400 text-sm mb-3">Get key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">Google AI Studio <ExternalLink className="w-3 h-3" /></a></p>
                <CodeBlock code="VITE_GEMINI_API_KEY=your_key_here" language="env" />
            </div>

            {/* OpenRouter */}
            <div className="p-6 bg-slate-900/50 border border-green-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">OpenRouter</h3>
                        <span className="text-xs text-green-400 font-medium">100+ MODELS • FREE MODELS AVAILABLE</span>
                    </div>
                </div>
                <p className="text-slate-400 text-sm mb-3">Get key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">OpenRouter Keys <ExternalLink className="w-3 h-3" /></a></p>
                <CodeBlock code="VITE_OPENROUTER_API_KEY=your_key_here" language="env" />
            </div>

            {/* Others */}
            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Other Providers</h3>
                <CodeBlock code={`# OpenAI — platform.openai.com/api-keys
VITE_OPENAI_API_KEY=your_key

# Anthropic — console.anthropic.com
VITE_ANTHROPIC_API_KEY=your_key

# DeepSeek — platform.deepseek.com
VITE_DEEPSEEK_API_KEY=your_key`} language="env" />
            </div>
        </div>

        <InfoBox title="💡 In-App Settings" color="cyan">
            <p>You can also enter API keys in the Builder via the ⚙️ Settings button. Keys are stored securely in your browser's local storage.</p>
        </InfoBox>
    </div>
);

// ==================== SECTION: SECURITY ====================

const SecuritySection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                Security
            </h1>
            <p className="text-slate-400 text-lg">
                Zero-trust architecture — every operation is verified
            </p>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">CLI Security Stack</h2>
        <DocTable
            headers={['Layer', 'What It Does']}
            rows={[
                ['Code Firewall', 'Scans AI output for eval(), injection, secrets, regex DoS, prototype pollution'],
                ['Permission Gate', 'Zero-trust — every shell command requires explicit user approval'],
                ['Command Guard', 'Classifies commands by risk: safe / moderate / high / critical'],
                ['Rules Engine', 'Configurable security rules with auto-remediation'],
                ['Workspace Trust', 'Blocks execution in dangerous directories (home, system, root)'],
                ['Audit Logger', 'All operations logged to ~/.agdi/audit.log'],
                ['Shell Wrapper Detector', 'Detects injection wrappers and multi-stage chains'],
                ['Execution Env', 'Sandboxed execution context with env isolation'],
                ['Argv Parser', 'Safe argument parsing to prevent injection'],
            ]}
        />

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Web Security</h2>
        <DocTable
            headers={['Layer', 'Implementation']}
            rows={[
                ['CSP Headers', 'Strict Content-Security-Policy — no eval(), explicit allowlists'],
                ['HSTS', 'HTTP Strict Transport Security (2yr + preload)'],
                ['CORS', 'API locked to production origin (no wildcard)'],
                ['COOP / COEP', 'Cross-Origin isolation headers'],
                ['Input Sanitization', 'HTML/scripts/null bytes stripped from all user input'],
                ['JWT Auth', 'Server-side Supabase token verification'],
                ['Rate Limiting', 'Per-user daily/monthly request caps by plan tier'],
                ['Permission Manager', 'Client-side permission prompts for file/network access'],
                ['Password Validation', 'Min 8 chars, uppercase, lowercase, digit required'],
            ]}
        />

        <InfoBox title="Code Firewall Detections" color="rose">
            <ul className="space-y-1">
                <li>• <strong>Dangerous APIs:</strong> eval(), Function(), document.write()</li>
                <li>• <strong>Injection:</strong> Shell injection, SQL injection patterns</li>
                <li>• <strong>Secrets:</strong> Hardcoded keys for GitHub, AWS, Stripe, Supabase, Vercel, Railway, Anthropic</li>
                <li>• <strong>Prototype Pollution:</strong> __proto__, constructor.prototype</li>
                <li>• <strong>File System:</strong> Path traversal (../), system directory writes</li>
                <li>• <strong>Regex DoS:</strong> Catastrophic backtracking patterns</li>
            </ul>
        </InfoBox>
    </div>
);

// ==================== SECTION: ARCHITECTURE ====================

const ArchitectureSection: React.FC = () => (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.3)' }}>
                Architecture
            </h1>
            <p className="text-slate-400 text-lg">
                How Agdi's autonomous engine works
            </p>
        </div>

        {/* System Diagram */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl">
            <h3 className="text-xl font-bold text-white mb-6 text-center">System Overview</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-sm">
                {[
                    { label: 'User Prompt', sub: 'Natural Language', color: 'amber' },
                    { label: 'Manager Agent', sub: 'Plans & delegates', color: 'cyan' },
                    { label: 'Agent Squad', sub: 'Parallel execution', color: 'amber' },
                    { label: 'QA / Self-Heal', sub: 'Verify & fix', color: 'rose' },
                    { label: 'Deploy', sub: 'Vercel / Netlify', color: 'green' },
                ].map((block, i) => (
                    <React.Fragment key={i}>
                        <div className={`p-4 bg-${block.color}-500/20 border border-${block.color}-500/30 rounded-xl text-center flex-1 min-w-[120px]`}>
                            <div className={`text-${block.color}-400 font-bold mb-1`}>{block.label}</div>
                            <div className="text-slate-400 text-xs">{block.sub}</div>
                        </div>
                        {i < 4 && <div className="hidden md:flex items-center text-cyan-400 text-xl">→</div>}
                    </React.Fragment>
                ))}
            </div>
        </div>

        {/* WebContainer */}
        <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white">WebContainer Engine</h3>
            </div>
            <p className="text-slate-300 mb-4">
                The web app uses <a href="https://webcontainers.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">WebContainers</a> by StackBlitz
                to run a <span className="text-cyan-400 font-medium">full Node.js environment directly in your browser</span>.
            </p>
            <ul className="text-slate-300 space-y-2">
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">→</span>
                    <span>No backend servers required — everything runs client-side</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">→</span>
                    <span>Supports npm, Vite, and real file systems</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-cyan-400 mt-1">→</span>
                    <span>Hot reload and live preview built-in</span>
                </li>
            </ul>
        </div>

        {/* Supabase */}
        <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Supabase Integration</h3>
            </div>
            <ul className="text-slate-300 space-y-2">
                <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">→</span>
                    <span><strong className="text-white">Auth:</strong> GitHub OAuth (developers), Google OAuth + Email (business owners)</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">→</span>
                    <span><strong className="text-white">Storage:</strong> Projects persist via IndexedDB locally + cloud sync</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-1">→</span>
                    <span><strong className="text-white">Cloud API:</strong> JWT-authenticated proxy for plan-based rate limiting</span>
                </li>
            </ul>
            <CodeBlock code={`# Optional: Self-host with your own Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key`} language="env" />
        </div>

        {/* Tech Stack */}
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Tech Stack</h2>
        <DocTable
            headers={['Layer', 'Technology']}
            rows={[
                ['Frontend', 'React 19, TypeScript, Tailwind CSS, Framer Motion'],
                ['Build', 'Vite, pnpm monorepo'],
                ['Runtime', 'WebContainers (in-browser Node.js)'],
                ['AI', 'Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter, Llama, Qwen'],
                ['Auth', 'Supabase (GitHub, Google, Email OAuth)'],
                ['Backend', 'Vercel Serverless Functions'],
                ['CLI', 'Node.js, Commander.js, Ink (React for terminals)'],
                ['Context', 'Babel AST, vector embeddings (MiniLM), Brave Search'],
                ['Testing', 'Vitest, TDD agent'],
                ['Security', 'CSP, HSTS, CORS, Code Firewall, Permission Gate, Audit Logger'],
                ['Storage', 'IndexedDB (browser), file system (CLI)'],
            ]}
        />
    </div>
);

// ==================== MAIN DOCS COMPONENT ====================

const Docs: React.FC<DocsProps> = ({ onBack }) => {
    const [activeSection, setActiveSection] = useState<DocSection>('intro');

    const renderContent = () => {
        switch (activeSection) {
            case 'intro':
                return <IntroSection />;
            case 'quickstart':
                return <QuickStartSection />;
            case 'cli':
                return <CLISection />;
            case 'agents':
                return <AgentsSection />;
            case 'byok':
                return <BYOKSection />;
            case 'security':
                return <SecuritySection />;
            case 'architecture':
                return <ArchitectureSection />;
            default:
                return <IntroSection />;
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white pt-20 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-8">
                    {/* Sidebar */}
                    <aside className="hidden lg:block w-64 shrink-0">
                        <div className="sticky top-24">
                            {/* Back Button */}
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm">Back to Home</span>
                                </button>
                            )}

                            {/* Logo */}
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Book className="w-5 h-5 text-cyan-400" />
                                    Agdi Docs
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">v3.3.5</p>
                            </div>

                            {/* Navigation */}
                            <nav className="space-y-1">
                                {NAV_ITEMS.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeSection === item.id
                                            ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <span className={activeSection === item.id ? 'text-cyan-400' : 'text-slate-500'}>
                                            {item.icon}
                                        </span>
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                ))}
                            </nav>

                            {/* Quick Links */}
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Quick Links</p>
                                <div className="space-y-2">
                                    <a
                                        href="https://agdi-dev.vercel.app"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Agdi Web IDE
                                    </a>
                                    <a
                                        href="https://www.npmjs.com/package/agdi"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        npm Package
                                    </a>
                                    <a
                                        href="https://discord.gg/pPkZ93Yb"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Discord
                                    </a>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Mobile Nav */}
                    <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-1 shadow-2xl overflow-x-auto">
                            {NAV_ITEMS.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`flex-shrink-0 flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition-all ${activeSection === item.id
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {item.icon}
                                    <span className="text-[9px] font-medium truncate">{item.label.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <main className="flex-1 min-w-0">
                        <div className="bg-slate-950/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Docs;
