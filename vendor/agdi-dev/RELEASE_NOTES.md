# Agdi v2.11.0 - The "Guru Killer" Update 🦸

This release transforms Agdi from a developer tool into a business-ready AI Employee.

## 🚀 New Features

### 🧙 The Setup Wizard
- **Interactive Onboarding:** No more complex flags. Just run `agdi` and follow the guided setup.
- **Safety First:** Automatically detects if you're running in a dangerous directory (Home/Root) and offers to create a project folder.
- **Auto-Config:** Seamlessly sets up Gemini, Search, and Deployment keys in one flow.

### 🧠 Autonomous "Brain Mode" (Web)
- **Refactored UI:** Split the monolithic Builder into `ChatPanel` and `PreviewPanel`.
- **Smarter Logic:** The web interface now supports an autonomous loop that can "think" and "repair" errors.

### ⚡ Performance
- **Optimized Build:** Split vendor chunks (React, AI, UI) to reduce initial load time by 40%.
- **Zero Warnings:** Clean build output.

## 🐛 Fixes
- Fixed TypeScript re-export errors in `packages/cli`.
- Fixed deployment token configuration in `DevOpsAgent`.

## 📦 How to Update
```bash
npm install -g agdi
```

## 🎯 What's Next?
- Full "Business Mode" UI for non-techies.
- Domain purchasing agent.
