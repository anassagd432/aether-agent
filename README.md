# Aether Agent (private bootstrap)

This repository is bootstrapping **Aether**: a next‑generation autonomous agent that combines:

- **Agdi-dev** promptless multi‑agent dev flow (Q&A → plan → code → fix → deploy)
- **OpenClaw** always‑on chat integrations (WhatsApp/Telegram/web), background tasks, tools/skills

## Current state

Source imports are staged under:
- `vendor/openclaw/` (OpenClaw upstream snapshot)
- `vendor/agdi-dev/` (Agdi-dev snapshot)

Next step is to **extract + merge** the minimal pieces into a clean Aether architecture (not just vendoring).

## Roadmap (immediate)

1. Create `packages/aether-core` orchestrator (LangGraph-style workflow + agent roles)
2. Create `packages/aether-gateway` (OpenClaw gateway rebrand + channel adapters)
3. Create `packages/aether-devflow` (Agdi Q&A + planner/coder/fixer/deployer)
4. Wire: chat message → auto Q&A → generate plan → execute in sandbox → deploy → verify (Playwright + Gemini)

## Notes

This repo is private while we stabilize the foundation.
