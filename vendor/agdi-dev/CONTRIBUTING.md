# Contributing to Agdi

Thank you for your interest in contributing to Agdi! This guide covers the project structure, development workflow, and coding conventions you need to follow.

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | ≥ 20.0.0 | Language runtime |
| **pnpm** | ≥ 9.x | Package manager (monorepo workspaces) |
| **Git** | Latest | Version control |

---

## Project Structure

Agdi is a **pnpm monorepo** with two packages:

```
agdi-dev/
├── packages/cli/            # CLI package (published to npm as "agdi")
│   └── src/
│       ├── index.ts         # CLI entry (Commander.js, 11 commands)
│       ├── commands/        # Command implementations
│       │   ├── agdi-dev.ts  # Interactive TUI dashboard
│       │   ├── squad.ts     # Multi-agent builder
│       │   ├── chat.ts      # Chat session
│       │   ├── auth.ts      # API key configuration
│       │   ├── wizard.ts    # Setup wizard
│       │   ├── doctor.ts    # Environment diagnosis
│       │   ├── import.ts    # GitHub repo import
│       │   ├── replay.ts    # Squad run replay
│       │   ├── run.ts       # Command runner
│       │   └── onboarding.ts # First-run onboarding
│       ├── agents/          # AI agent implementations
│       │   ├── core/        # 6 specialized agents (manager, frontend, backend, devops, qa, squad-orchestrator)
│       │   └── orchestrator.ts
│       ├── context/         # Deep context engine
│       │   ├── repository-indexer.ts   # Full repo scanning
│       │   ├── typescript-parser.ts    # AST parsing
│       │   ├── dependency-graph.ts     # Module graph
│       │   ├── embeddings.ts           # Semantic embeddings (MiniLM)
│       │   ├── vector-store.ts         # Nearest-neighbor search
│       │   └── context-retriever.ts    # Relevant code retrieval
│       ├── search/          # Web search (Brave Search API)
│       ├── security/        # CLI security (code-firewall, permissions, audit)
│       ├── core/            # Config, telemetry, LLM providers
│       └── ui/              # Terminal UI (Ink/React-based TUI)
│
├── components/              # React UI (24+ components)
│   ├── wizard/              # 8-step setup wizard
│   ├── ide/                 # Builder IDE (chat, editor, preview, terminal)
│   ├── Builder.tsx          # Developer IDE
│   ├── SimpleBuilder.tsx    # No-code builder (business owners)
│   └── ...
│
├── hooks/                   # 10 React hooks
│   ├── useAutonomousAgent.ts # AI agent loop
│   ├── useTDDAgent.ts        # Test-driven development
│   ├── useTimeTravel.ts      # Undo/redo snapshots
│   └── ...
│
├── lib/                     # Core business logic
│   ├── llm/                 # Multi-provider LLM (4 clients, 13 models, failover)
│   ├── agent/               # Web agent pipeline (decision-loop, planner, self-healer)
│   ├── security/            # Client-side security (sanitize, permissions, rules)
│   ├── workspace/           # Virtual filesystem (hardened FS, file-watcher)
│   ├── persistence/         # IndexedDB storage
│   ├── tdd/                 # Test runner
│   └── ...
│
├── src/core/                # Core AI engine
│   ├── intelligence/        # ThinkingEngine, SkillManager, ModelRouter, SwarmIntegration
│   ├── memory/              # Vector store + embeddings
│   ├── skills/              # Pluggable skill system (agdi-coder)
│   ├── prompts/             # System prompts and model routing rules
│   └── interfaces/          # Multi-platform (WhatsApp bot)
│
├── api/                     # Vercel serverless functions
│   ├── generate.ts          # Cloud AI proxy
│   └── newsletter.ts        # Mailchimp
│
└── vercel.json              # Deployment + security headers
```

---

## Development Workflow

### Setup

```bash
git clone https://github.com/AnassAgd432/Agdi-dev.git
cd Agdi-dev
pnpm install
cp .env.example .env          # Add your API keys
pnpm dev                      # Start dev server
```

### Branching

```
main               ← stable releases
├── feat/name       ← new features
├── fix/name        ← bug fixes
├── refactor/name   ← code improvements
└── docs/name       ← documentation
```

### Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short summary

feat(cli):      Add squad --deploy flag
fix(agent):     Fix self-healer retry loop
refactor(llm):  Extract model routing to separate module
docs(readme):   Update architecture diagram
test(security): Add code-firewall unit tests
```

### Pre-Push Checklist

```bash
pnpm check     # TypeScript type check (strict)
pnpm test      # Vitest unit tests
pnpm lint      # ESLint
pnpm build     # Verify production build passes
```

---

## Code Style

| Rule | Convention |
|------|-----------|
| **Language** | TypeScript (strict mode, noUnusedLocals) |
| **React** | Functional components, hooks only |
| **Styling** | Tailwind CSS utility classes |
| **Formatting** | Prettier (single quotes, trailing commas, 4-space indent) |
| **Linting** | ESLint with TypeScript plugin |
| **Imports** | Relative paths within packages, barrel exports from `index.ts` |
| **Naming** | `camelCase` for functions/variables, `PascalCase` for components/classes, `UPPER_SNAKE` for constants |

---

## Where to Contribute

| Area | Files | Impact |
|------|-------|--------|
| **New LLM providers** | `lib/llm/clients/`, `lib/llm/registry.ts` | Add new AI models |
| **New CLI commands** | `packages/cli/src/commands/`, `packages/cli/src/index.ts` | Extend CLI |
| **New agents** | `packages/cli/src/agents/core/` | Add specialized agents |
| **New skills** | `src/core/skills/` | Add coding skills |
| **Security rules** | `packages/cli/src/security/rules-engine.ts` | Improve code scanning |
| **UI components** | `components/` | Add/improve web UI |
| **New hooks** | `hooks/` | Add React functionality |
| **New interfaces** | `src/core/interfaces/` | Add platforms (Slack, Telegram, etc.) |

---

## Security Guidelines

- **Never commit API keys.** Use environment variables.
- **All AI-generated code** passes through the Code Firewall before execution.
- **All shell commands** require permission via the Permission Gate.
- **Input sanitization** is mandatory for any user-facing input.
- **Test security changes** with the existing test suites in `__tests__/` directories.

---

## Getting Help

- [Discord](https://discord.gg/pPkZ93Yb) — Ask questions, share ideas
- [GitHub Issues](https://github.com/AnassAgd432/Agdi-dev/issues) — Bug reports, feature requests
