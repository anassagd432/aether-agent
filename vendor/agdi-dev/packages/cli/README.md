# Agdi CLI — The Autonomous AI Employee

<div align="center">
  <img src="https://agdi-dev.vercel.app/logo.svg" alt="Agdi Logo" width="120" height="120">
  
  # 🦸 AGDI
  ### The Autonomous AI Software Squad in Your Terminal
  #### v3.3.0: New Mission Control TUI

  [![npm version](https://img.shields.io/npm/v/agdi.svg?style=for-the-badge&logo=npm&color=cyan)](https://www.npmjs.com/package/agdi)
  [![License](https://img.shields.io/npm/l/agdi.svg?style=for-the-badge&color=blue)](https://github.com/anassagd432/Agdi-dev)
  [![Downloads](https://img.shields.io/npm/dt/agdi.svg?style=for-the-badge&color=purple)](https://www.npmjs.com/package/agdi)

  <p align="center">
    <b>Build, Test, and Deploy Full-Stack SaaS Apps with a Single Prompt.</b><br>
    Powered by Gemini 3, GPT-5, and Claude 4.5.
  </p>
</div>

---

## ⚡ What is Agdi?

Agdi isn't just a code generator. It's an **autonomous software agency** that lives in your terminal. When you give it a prompt, it doesn't just spit out code—it spins up a **Squad** of specialized AI agents that work together:

- **🧠 The Manager:** Plans the architecture, breaks down tasks, and oversees the project.
- **🎨 The Designer:** Builds beautiful, responsive UI components (React + Tailwind + Shadcn).
- **⚙️ The Engineer:** Implements secure APIs, database schemas, and backend logic.
- **🕵️ The QA:** Runs builds, writes tests, detects errors, and **auto-fixes** them before you ever see the code.
- **🚀 The DevOps:** Handles deployment to Vercel/Netlify automatically.

---

## 🚀 Getting Started

### 1. Install via npm
```bash
npm install -g agdi
```

### 2. Run the Wizard
The easiest way to start is the interactive wizard. It will guide you through authentication and project setup.
```bash
agdi
```

### 3. Build a SaaS in Seconds
Want to go fast? Use the direct build command:
```bash
agdi build "A project management tool with Kanban boards and team chat"
```

---

## 🛠️ Features

### 🏢 The SaaS Blueprint (`--saas`)
Generate a production-ready SaaS foundation instantly:
- **Framework:** Next.js 15 (App Router)
- **Database:** Prisma + PostgreSQL
- **Auth:** Clerk / NextAuth
- **Payments:** Stripe Subscription integration
- **Styling:** Tailwind CSS + Shadcn UI

```bash
agdi build "AI-powered CRM for real estate agents" --saas
```

### 🔄 Auto-Healing Code
Agdi's QA agent runs in a loop. If the build fails:
1. It analyzes the error logs.
2. It reads the source code.
3. It generates a surgical fix.
4. It re-runs the build.
*You get working code, not error messages.*

### 📦 Import & Refactor
Have an existing repo? Import it and ask Agdi to add features.
```bash
agdi import https://github.com/user/repo
```

---

## 🤖 Supported Models

Agdi supports the absolute bleeding edge of AI models via a unified interface:

| Provider | Models Supported | Best For |
|----------|------------------|----------|
| **Google** | Gemini 3 Pro, 2.5 Flash | **Speed & Context** (Recommended) |
| **OpenAI** | GPT-5, GPT-4o, o1 | **Complex Logic** |
| **Anthropic** | Claude 3.5 Sonnet, Opus | **Coding & Architecture** |
| **DeepSeek** | DeepSeek V3, R1 | **Reasoning & Cost Efficiency** |
| **OpenRouter**| 100+ Models | **Flexibility** |

---

## ⚙️ Advanced Usage

### Squad Mode (Multi-Agent)
For complex projects, invoke the full squad explicitly:
```bash
agdi squad "Crypto portfolio tracker with real-time websocket updates"
```

### Config Management
View or edit your API keys and settings:
```bash
agdi config
```
Enable telemetry to help us debug crashes (fully anonymous):
```bash
agdi config telemetry --enable
```

### Semantic Search (Optional)
Agdi can optionally enable local semantic embeddings for smarter context retrieval.

Enable via environment variable:
```bash
AGDI_SEMANTIC_SEARCH=1 agdi
```

Or enable permanently in `~/.agdi/config.json`:
```json
{ "semanticSearchEnabled": true }
```

---

## 🛡️ Security

Agdi takes security seriously.
- **Zero-Trust:** It never executes dangerous shell commands without permission (unless `--yes` is used).
- **Local Keys:** API keys are stored in `~/.agdi/config.json` with `0600` permissions (readable only by you).
- **Sandboxed:** Code generation happens in your specified directory, never outside it.

---

## ❓ Troubleshooting

**"API Key Invalid"**
Run `agdi auth` to re-enter your keys. Ensure your plan covers the model you selected.

**"Build Failed"**
If the auto-healer gives up, check the logs in `runs/<id>/report.md`. You can often fix the small typo manually and run `npm run dev`.

**"Quota Exceeded"**
Switch to a cheaper model or provider:
```bash
agdi model
```

---

<div align="center">
  <p>Built with ❤️ by Agdi Systems Inc.</p>
  <p>2026 Edition</p>
</div>
