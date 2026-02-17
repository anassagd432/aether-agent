# Aether Agent

Aether is an autonomous AI agent that **builds, deploys, and manages full‑stack applications without prompts**, featuring **visual verification**, **secure identities**, and **headless browser control**.

It’s a next‑generation hybrid of:
- **Agdi-dev**: promptless, multi‑agent dev flow (Q&A → plan → code → fix → deploy)
- **OpenClaw**: chat‑first, always‑on integrations (WhatsApp/Telegram/web), long‑running tasks, and operational tooling

## Vision

Aether aims to be a practical “always-on” autonomous engineer:
- Guided first-run Q&A (project goals, stack, target users)
- Multi-agent workflows (planner/coder/fixer/deployer)
- Automated deploys (Vercel/Netlify) + post-deploy checks
- Headless browser automation (Playwright)
- Visual verification loops (Gemini Vision)
- Secure identity vault + audit logs

## Status

Bootstrapping the foundation (repo + architecture + initial integration).

## Roadmap (high-level)

- [ ] Import OpenClaw as base (monorepo + gateway + channels)
- [ ] Integrate Agdi-dev promptless workflow + deploy logic
- [ ] Add Playwright browser runner + state persistence
- [ ] Add Gemini-based visual verification and self-healing loop
- [ ] Security: vault, sandboxing, audit logs, critical-command OTP

## Contributing

PRs welcome. Keep changes small and documented.

## License

MIT
