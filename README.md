# Aether Agent

Aether is an autonomous AI agent that **builds, deploys, and manages full‑stack applications without prompts**, featuring **visual verification**, **secure identities**, and **headless browser control**.

It’s a next‑generation hybrid of:
- **Agdi-dev**: promptless, multi‑agent dev flow (Q&A → plan → code → fix → deploy)
- **OpenClaw**: chat‑first, always‑on integrations (WhatsApp/Telegram/web), long‑running tasks, tools/skills

## Current state

We imported upstream snapshots for reference:
- `vendor/openclaw/`
- `vendor/agdi-dev/`

Next we’ll extract + rebrand into a clean Aether architecture (not just vendoring).

## Roadmap (near-term)

- [ ] Create `packages/aether-core` (orchestrator + agent roles)
- [ ] Create `packages/aether-gateway` (chat-first gateway + channels)
- [ ] Create `packages/aether-devflow` (Agdi Q&A + planner/coder/fixer/deployer)
- [ ] Add Playwright headless browser runner + state persistence
- [ ] Add Gemini-based visual verification and self-healing loop
- [ ] Security: vault, sandboxing, audit logs, critical-command OTP

## License

MIT
