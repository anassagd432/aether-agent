<div align="center">

# ⚡ Agdi — The Autonomous AI Employee

**Describe what you want. Agdi builds it.**

[![NPM Version](https://img.shields.io/npm/v/agdi?style=flat-square&color=cyan)](https://www.npmjs.com/package/agdi)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/discord-join-7289da?style=flat-square)](https://discord.gg/pPkZ93Yb)

</div>

---

Agdi is an autonomous AI agent that builds full-stack web applications from natural language. Describe your app in plain English, and a squad of specialized AI agents plans the architecture, writes the code, tests it, self-heals errors, and deploys — all without human intervention.

**Three ways to build:**

| | Web App | CLI | WhatsApp |
|---|---|---|---|
| **How** | Visual wizard → live builder | `agdi build "..."` | Send a message to Agdi bot |
| **For** | Business owners & designers | Developers | Everyone |
| **AI** | Cloud AI (no keys needed) | BYOK (bring your own keys) | Cloud AI |

---

## 🚀 Quick Start

### Web IDE (Coming Soon)

Visit **[agdi-dev.vercel.app](https://agdi-dev.vercel.app)** — no installation required. Sign up, describe your app, and watch it get built live.

### CLI (Available Now)

```bash
npm install -g agdi

agdi auth                       # Configure your API keys
agdi build "A kanban board"     # Generate an app from a prompt
agdi squad "SaaS dashboard"     # Full multi-agent autonomous build
```

> **Requirements:** Node.js 20+ and an API key for at least one LLM provider (Gemini, OpenRouter, OpenAI, etc.)

---

## ✨ Features

### 🤖 AI Agent Squad

Agdi uses a multi-agent architecture — not a single prompt. Each agent specializes in one domain:

| Agent | Role | Key Capabilities |
|-------|------|-------------------|
| **Manager** | Orchestrator | Analyzes requests, creates specs, coordinates agents |
| **Frontend** | UI/UX | React, Tailwind, component architecture |
| **Backend** | API & DB | Server logic, database schemas, API design |
| **DevOps** | Infrastructure | CI/CD, Vercel/Netlify deployment, build config |
| **QA / Self-Healer** | Verification | Reads stderr, fixes build errors automatically (up to 3 retries) |
| **Squad Orchestrator** | Pipeline | Manages parallel execution, agent handoffs, and final assembly |

### 🧠 Core Intelligence Engine

| Module | What It Does |
|--------|-------------|
| **ThinkingEngine** | Chain-of-thought reasoning with step-by-step planning |
| **SkillManager** | Loads and executes specialized coding skills (agdi-coder) |
| **ModelRouter** | Auto-selects optimal model per task (reasoning vs. autocomplete vs. long-context) |
| **SwarmIntegration** | Coordinates multi-agent parallel execution |
| **SimpleVectorStore** | In-memory embedding store for semantic code search |

### 🔍 Deep Context System (CLI)

The CLI indexes your entire repository before making changes:

| Component | Purpose |
|-----------|---------|
| **Repository Indexer** | Scans and indexes all files in your project |
| **TypeScript Parser** | Babel/TypeScript AST parsing for symbol/import/export extraction |
| **Dependency Graph** | Maps module relationships and import chains |
| **Embeddings** | Semantic vector embeddings via `@xenova/transformers` (MiniLM-L6-v2) |
| **Vector Store** | Nearest-neighbor search for finding relevant code |
| **Context Retriever** | Pulls the most relevant code into the AI prompt |

### 🌐 Web Search & Grounding

| Component | Purpose |
|-----------|---------|
| **Brave Search** | Web search for documentation, APIs, and best practices |
| **Search Optimizer** | Ranks and filters search results for relevance |
| **Context Injector** | Injects search results into agent prompts |

### 🖥️ Web App Features

| Feature | Description |
|---------|-------------|
| **Setup Wizard** | 8-step guided app creation (user type → category → features → style → audience → deploy → analysis → build) |
| **Builder IDE** | Full IDE with ChatPanel, EditorPanel (CodeEditor + FileExplorer), PreviewPanel (live WebContainer), TerminalPanel |
| **SimpleBuilder** | No-code builder for business owners — cloud AI, no API keys needed |
| **AuthPage** | Supabase auth — GitHub OAuth (developers), Google OAuth + Email (business owners) |
| **ModelSelector** | Choose between 13+ AI models across 7 providers |
| **VoiceButton** | Voice-to-text input using Web Speech API |
| **TimelineSlider** | Time-travel through project history (undo/redo snapshots) |
| **ArchitectView** | Visual display of AI agent planning and reasoning |
| **PricingPage** | Tiered plans (Free, Pro, Business) with cloud AI limits |
| **Docs** | In-app documentation viewer |
| **DeployToVercel** | One-click Vercel deployment |
| **ImportModal** | Import existing projects or GitHub repos |
| **PermissionModal** | Runtime permission prompts for file/network access |

### ⌨️ CLI Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `agdi` | — | Launch interactive TUI dashboard |
| `agdi build <prompt>` | `b` | Generate an app from a prompt |
| `agdi build <prompt> --saas` | — | Generate a full SaaS blueprint (Next.js + Prisma + Stripe) |
| `agdi squad [prompt]` | `s` | Multi-agent autonomous builder with parallel execution |
| `agdi squad --deploy` | — | Build and auto-deploy to Vercel |
| `agdi chat` | — | Interactive chat session with AI |
| `agdi auth` | — | Configure API keys (Gemini, OpenRouter, OpenAI, etc.) |
| `agdi config` | — | Show current configuration |
| `agdi config:telemetry` | `telemetry` | Manage telemetry (enable/disable/dry-run/status) |
| `agdi doctor` | `doc` | Run self-diagnosis checks on your environment |
| `agdi import <url>` | `i` | Import a GitHub repository |
| `agdi replay <runId>` | — | Replay a previous squad run (exact or re-execute) |
| `agdi wizard` | — | Interactive setup wizard |

### 🧩 React Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Supabase authentication state, sign-in/up, user type |
| `useAutonomousAgent` | Autonomous AI loop — plan, execute, self-heal |
| `useBuilderLogic` | Builder state machine — files, preview, chat, agent coordination |
| `useTDDAgent` | Test-driven development — generate tests, run, fix failures |
| `useTimeTravel` | Snapshot-based undo/redo for project state |
| `useVoiceInput` | Web Speech API voice recognition |
| `usePermissions` | Runtime permission management |
| `useProjectPersistence` | IndexedDB project storage |
| `useWizard` | Wizard step state machine |
| `useWorkspacePicker` | Workspace/project selection |

### 🔒 Security (CLI)

| Module | Purpose |
|--------|---------|
| **Code Firewall** | Scans AI-generated code for `eval()`, prototype pollution, shell injection, hardcoded secrets (GitHub, AWS, Supabase, Vercel, Railway, Anthropic tokens) |
| **Permission Gate** | Zero-trust — all shell commands require explicit approval |
| **Command Guard** | Classifies commands by risk level (safe/moderate/high) |
| **Rules Engine** | Configurable security rules with severity levels |
| **Workspace Trust** | Workspaces must be trusted before execution; blocks dangerous dirs |
| **Audit Logger** | Logs all operations to `~/.agdi/audit.log` |
| **Shell Wrapper Detector** | Detects and blocks shell injection wrappers |
| **Execution Environment** | Sandboxed execution context |
| **Argv Parser** | Safe argument parsing to prevent injection |

### 🔒 Security (Web)

| Feature | Description |
|---------|-------------|
| **CSP Headers** | Strict Content-Security-Policy — no `eval`, explicit allowlists |
| **HSTS** | HTTP Strict Transport Security (2yr + preload) |
| **CORS Lockdown** | API locked to production origin |
| **Input Sanitization** | Prompts stripped of HTML/scripts/null bytes (`lib/security/sanitize.ts`) |
| **Permission Manager** | Client-side permission management with risk classification |
| **JWT Verification** | Server-side Supabase token validation |
| **Plan-Based Rate Limiting** | Per-user daily/monthly request caps |

### 🧠 LLM Providers & Models

Agdi supports **13 models** across **7 providers** with automatic model routing:

| Provider | Models | Roles |
|----------|--------|-------|
| **OpenAI** | GPT-5.2 Codex, GPT-4.1 | Reasoning, Autocomplete |
| **Anthropic** | Claude 4.5 Sonnet, Claude 4.5 Opus, Claude 3.5 Sonnet | Reasoning, Long Context |
| **Google** | Gemini 3 Pro (2M ctx), Gemini 3 Flash (1M), Gemini 2.5 Flash | Reasoning, Autocomplete, Long Context |
| **Meta** | Llama 4 Maverick (256K ctx) | Reasoning, Autocomplete |
| **Alibaba** | Qwen3 Coder | Autocomplete, Reasoning |
| **DeepSeek** | DeepSeek R1, DeepSeek V3 | Reasoning, Long Context |
| **HuggingFace** | StarCoder2 | Autocomplete |

**Model Roles:**
- **Reasoning** — Complex architectural decisions, planning
- **Autocomplete** — Fast code generation and completion
- **Long Context** — Large codebase analysis (up to 2M tokens)

The `LLMService` automatically selects the best model per task with failover support.

---

## 🏗️ Architecture

```
agdi-dev/
├── App.tsx                    # Main app router (Wizard → Auth → Builder)
├── index.html                 # Entry point + CSP headers
│
├── api/                       # Vercel serverless functions
│   ├── generate.ts            # Cloud AI proxy (auth + plans + sanitization)
│   ├── newsletter.ts          # Mailchimp newsletter signup
│   └── deploy/                # Vercel deployment API
│
├── components/                # React UI (24 components)
│   ├── wizard/                # 8-step onboarding wizard
│   │   ├── WizardPage.tsx     # Wizard container + step router
│   │   ├── StepUserType.tsx   # Developer vs Business Owner
│   │   ├── StepCategory.tsx   # App category selection
│   │   ├── StepFeatures.tsx   # Feature picker
│   │   ├── StepStyle.tsx      # Design style selection
│   │   ├── StepAudience.tsx   # Target audience
│   │   ├── StepDeploy.tsx     # Deployment target
│   │   ├── StepVision.tsx     # Free-form app description
│   │   ├── StepAnalysis.tsx   # AI spec generation
│   │   └── BuildProgress.tsx  # Build progress indicator
│   ├── ide/                   # Builder IDE components
│   │   ├── ChatPanel.tsx      # AI chat interface
│   │   ├── EditorPanel.tsx    # Code editor + file explorer
│   │   ├── PreviewPanel.tsx   # Live preview (WebContainer)
│   │   ├── TerminalPanel.tsx  # Terminal emulator
│   │   ├── BuilderHeader.tsx  # IDE header bar
│   │   ├── FileExplorer.tsx   # Project file tree
│   │   ├── CodeEditor.tsx     # Code editor component
│   │   └── AgentChat.tsx      # Agent chat messages
│   ├── Builder.tsx            # Full IDE for developers
│   ├── SimpleBuilder.tsx      # No-code builder for business owners
│   ├── AuthPage.tsx           # Login/Signup (GitHub, Google, Email)
│   ├── LandingPage.tsx        # Marketing landing page
│   ├── Hero.tsx               # Hero section
│   ├── SquadVisualizer.tsx    # Animated agent architecture diagram
│   ├── ModelSelector.tsx      # AI model picker
│   ├── PricingPage.tsx        # Pricing tiers
│   ├── Docs.tsx               # In-app documentation
│   └── ...                    # VoiceButton, TimelineSlider, etc.
│
├── hooks/                     # 10 React hooks
│   ├── useAuth.ts             # Supabase authentication
│   ├── useAutonomousAgent.ts  # AI agent loop
│   ├── useBuilderLogic.ts     # Builder state machine
│   ├── useTDDAgent.ts         # Test-driven development
│   ├── useTimeTravel.ts       # Undo/redo snapshots
│   ├── useVoiceInput.ts       # Voice recognition
│   └── ...
│
├── lib/                       # Core business logic
│   ├── llm/                   # Multi-provider LLM system
│   │   ├── clients/           # Provider clients (Google, OpenAI, Anthropic, OpenRouter)
│   │   ├── registry.ts        # 13-model registry
│   │   ├── index.ts           # LLMService with failover
│   │   └── types.ts           # Provider/Model/Role types
│   ├── agent/                 # Web AI agent pipeline
│   │   ├── decision-loop.ts   # Autonomous decision cycle
│   │   ├── planning-engine.ts # Multi-step planning
│   │   ├── self-healer.ts     # Error detection + auto-fix
│   │   ├── memory-manager.ts  # Conversation memory
│   │   ├── browser-tool-executor.ts  # WebContainer tool execution
│   │   └── termination-logic.ts      # Agent stopping conditions
│   ├── security/              # Client-side security
│   │   ├── sanitize.ts        # Input sanitization utilities
│   │   ├── permission-manager.ts  # Permission UI management
│   │   ├── risk-classifier.ts # Command risk classification
│   │   ├── rules-engine.ts    # Security rules
│   │   └── audit-logger.ts    # Client audit log
│   ├── workspace/             # Virtual filesystem
│   │   ├── fs-hardened.ts     # Hardened file system adapter
│   │   ├── file-watcher.ts    # File change detection
│   │   ├── session.ts         # Workspace session management
│   │   └── handle-store.ts    # File handle management
│   ├── persistence/           # Data storage
│   │   ├── indexeddb-store.ts # Browser IndexedDB
│   │   └── project-store.ts   # Project metadata
│   ├── tdd/                   # Test-driven development
│   │   └── test-runner.ts     # Test execution engine
│   ├── pricing/config.ts      # Plan tiers + cloud limits
│   ├── agdi-architect.ts      # AI prompt engineering
│   ├── cloud-api.ts           # Cloud API client
│   ├── supabase.ts            # Supabase client
│   ├── webcontainer.ts        # WebContainer runtime
│   ├── token-router.ts        # API key routing
│   ├── snapshot-manager.ts    # Time-travel snapshots
│   └── github-loader.ts       # GitHub repo import
│
├── src/core/                  # Core AI engine
│   ├── intelligence/          # AI reasoning
│   │   ├── ThinkingEngine.ts  # Chain-of-thought reasoning
│   │   ├── SkillManager.ts    # Skill loading and execution
│   │   ├── ModelRouter.ts     # Automatic model selection
│   │   └── SwarmIntegration.ts # Multi-agent coordination
│   ├── memory/                # Knowledge store
│   │   ├── SimpleVectorStore.ts # Vector embedding store
│   │   └── embeddings.ts      # Text-to-vector conversion
│   ├── skills/                # Pluggable skill system
│   │   └── agdi-coder/        # Code generation skill
│   ├── prompts/               # System prompts
│   │   ├── agdi-system.ts     # Main system prompt
│   │   └── model-routing.json # Model selection rules
│   ├── interfaces/            # Multi-platform interfaces
│   │   └── agdi-whatsapp.ts   # WhatsApp bot interface
│   └── security/              # Core security layer
│
├── packages/cli/              # CLI package (npm: agdi)
│   └── src/
│       ├── index.ts           # CLI entry point (Commander.js)
│       ├── commands/          # 11 CLI commands
│       ├── agents/            # Agent implementations
│       │   ├── core/          # 6 specialized agents
│       │   │   ├── manager-agent.ts
│       │   │   ├── frontend-agent.ts
│       │   │   ├── backend-agent.ts
│       │   │   ├── devops-agent.ts
│       │   │   ├── qa-agent.ts
│       │   │   └── squad-orchestrator.ts
│       │   └── orchestrator.ts
│       ├── context/           # Deep code understanding
│       │   ├── repository-indexer.ts
│       │   ├── typescript-parser.ts
│       │   ├── dependency-graph.ts
│       │   ├── embeddings.ts
│       │   ├── vector-store.ts
│       │   └── context-retriever.ts
│       ├── search/            # Web search integration
│       │   ├── brave-search.ts
│       │   ├── search-optimizer.ts
│       │   └── context-injector.ts
│       ├── security/          # CLI security
│       │   ├── code-firewall.ts
│       │   ├── permission-gate.ts
│       │   ├── command-guard.ts
│       │   ├── rules-engine.ts
│       │   ├── workspace-trust.ts
│       │   ├── audit-logger.ts
│       │   └── shell-wrapper-detector.ts
│       └── ui/tui.tsx         # Terminal UI (Ink/React)
│
└── vercel.json                # Deployment config + security headers
```

### User Flow

```
┌─────────┐     ┌──────┐     ┌─────────┐
│ Wizard   │────▶│ Auth │────▶│ Builder │
│ (8 steps)│     │      │     │         │
└─────────┘     └──────┘     └─────────┘
                   │              │
                   │   ┌──────────┴──────────┐
                   │   │                     │
                   │   ▼                     ▼
                   │  Developer:          Business:
                   │  Full IDE             SimpleBuilder
                   │  (BYOK keys)         (Cloud AI)
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
          GitHub    Google/Email
          OAuth       OAuth
```

---

## 💰 Pricing Tiers

| | Free | Pro ($19/mo) | Business ($49/mo) |
|---|---|---|---|
| Apps/month | 3 | 20 | Unlimited |
| Cloud AI calls/day | 5 | 50 | Unlimited |
| AI models | Gemini Flash | Flash + Pro | All (+ GPT-4o) |
| Max prompt | 2,000 chars | 5,000 chars | 10,000 chars |
| Deploy targets | ZIP | Vercel, Netlify | All + Railway |
| AI follow-ups | 1 | 3 | Unlimited |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion |
| Build | Vite, pnpm monorepo |
| Runtime | WebContainers (in-browser Node.js) |
| AI | Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter, Meta Llama, Qwen |
| Auth | Supabase (GitHub, Google, Email OAuth) |
| Backend | Vercel Serverless Functions |
| CLI | Node.js, Commander.js, Ink (React for terminals) |
| Context | Babel AST, vector embeddings (MiniLM-L6-v2), Brave Search |
| Testing | Vitest, TDD agent |
| Security | CSP, HSTS, CORS, Code Firewall, Permission Gate, Audit Logger |
| Storage | IndexedDB (browser), file system (CLI) |

---

## 📄 License

MIT © Anass Agdi

---

<div align="center">

**[🌐 agdi-dev.vercel.app](https://agdi-dev.vercel.app)** · **[💬 Discord](https://discord.gg/pPkZ93Yb)** · **[📦 npm](https://www.npmjs.com/package/agdi)**

</div>
