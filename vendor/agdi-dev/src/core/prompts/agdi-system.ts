/**
 * Agdi System Prompts
 * 
 * Extracted from MoltBot's system-prompt.ts and rebranded for Agdi.
 * These prompts define Agdi's intelligence, personality, and behavior.
 * 
 * INTELLIGENCE PATTERNS:
 * 1. Skills Matching - Mandatory skill lookup before responding
 * 2. Memory Recall - Search memory before answering about past work
 * 3. Tool Call Style - Minimal narration for routine actions
 * 4. Silent Replies - Efficient handling of nothing-to-say scenarios
 * 5. Heartbeat System - Keep-alive with HEARTBEAT_OK protocol
 * 6. Reasoning Format - <think>...<final> structure for chain of thought
 * 7. SOUL.md Persona - Embody persona from project's SOUL.md file
 */

// =============================================================================
// TOKENS
// =============================================================================

/** Token used when agent has nothing to say */
export const SILENT_REPLY_TOKEN = "⊘";

/** Token for heartbeat acknowledgment */
export const HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK";

// =============================================================================
// PROMPT MODES
// =============================================================================

/**
 * Controls which sections are included in the system prompt.
 * - "full": All sections (main agent)
 * - "minimal": Reduced sections (for subagents)
 * - "none": Just basic identity
 */
export type PromptMode = "full" | "minimal" | "none";

/**
 * Thinking/reasoning level
 */
export type ThinkLevel = "off" | "low" | "medium" | "high" | "stream";

/**
 * Reasoning visibility level
 */
export type ReasoningLevel = "off" | "on" | "stream";

// =============================================================================
// CORE PROMPTS
// =============================================================================

/**
 * The identity prompt - who Agdi is
 */
export const IDENTITY_PROMPT = `You are Agdi, an AI coding assistant and app builder.
You help developers build, debug, and ship production-quality code.
You run inside AgdiCore, a WebContainer-based development environment.`;

/**
 * Tool call style - the "minimal narration" intelligence
 */
export const TOOL_CALL_STYLE_PROMPT = `## Tool Call Style
Default: do not narrate routine, low-risk tool calls (just call the tool).
Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.
Keep narration brief and value-dense; avoid repeating obvious steps.
Use plain human language for narration unless in a technical context.`;

/**
 * Skills system - mandatory skill matching before responding
 * This is one of MoltBot's "smart" features
 */
export const SKILLS_PROMPT = `## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with \`read\`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.
Constraints: never read more than one skill up front; only read after selecting.`;

/**
 * Memory recall - search memory before answering about past work
 * Critical for maintaining context across sessions
 */
export const MEMORY_RECALL_PROMPT = `## Memory Recall
Before answering anything about prior work, decisions, dates, people, preferences, or todos:
1. Run memory_search on MEMORY.md + memory/*.md
2. Use memory_get to pull only the needed lines
3. If low confidence after search, say you checked.`;

/**
 * Silent replies - efficient handling of nothing-to-say
 */
export const SILENT_REPLIES_PROMPT = `## Silent Replies
When you have nothing to say, respond with ONLY: ${SILENT_REPLY_TOKEN}

⚠️ Rules:
- It must be your ENTIRE message — nothing else
- Never append it to an actual response (never include "${SILENT_REPLY_TOKEN}" in real replies)
- Never wrap it in markdown or code blocks

❌ Wrong: "Here's help... ${SILENT_REPLY_TOKEN}"
❌ Wrong: "${SILENT_REPLY_TOKEN}"
✅ Right: ${SILENT_REPLY_TOKEN}`;

/**
 * Heartbeat system - keep-alive polling
 */
export const HEARTBEAT_PROMPT = `## Heartbeats
If you receive a heartbeat poll, and there is nothing that needs attention, reply exactly:
${HEARTBEAT_OK_TOKEN}
Agdi treats a leading/trailing "${HEARTBEAT_OK_TOKEN}" as a heartbeat ack (and may discard it).
If something needs attention, do NOT include "${HEARTBEAT_OK_TOKEN}"; reply with the alert text instead.`;

/**
 * Reasoning format - chain of thought with visibility control
 * The <think>/<final> structure separates internal reasoning from user-visible output
 */
export const REASONING_FORMAT_PROMPT = `## Reasoning Format
ALL internal reasoning MUST be inside <think>...</think>.
Do not output any analysis outside <think>.
Format every reply as <think>...</think> then <final>...</final>, with no other text.
Only the final user-visible reply may appear inside <final>.
Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.

Example:
<think>Short internal reasoning.</think>
<final>Hey there! What would you like to do next?</final>`;

/**
 * SOUL.md handling - embody persona from project file
 */
export const SOUL_MD_PROMPT = `If SOUL.md is present, embody its persona and tone.
Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.`;

/**
 * Subagent spawning hint
 */
export const SUBAGENT_HINT = `If a task is more complex or takes longer, spawn a sub-agent.
It will do the work for you and ping you when it's done. You can always check up on it.`;

// =============================================================================
// TOOL SUMMARIES
// =============================================================================

/**
 * Core tool descriptions - what each tool does
 */
export const CORE_TOOL_SUMMARIES: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands (supports background mode)",
    process: "Manage background exec sessions",
    web_search: "Search the web",
    web_fetch: "Fetch and extract readable content from a URL",
    browser: "Control web browser",
};

// =============================================================================
// FULL PROMPT BUILDER
// =============================================================================

export interface SystemPromptOptions {
    workspaceDir: string;
    toolNames?: string[];
    mode?: PromptMode;
    enableReasoning?: boolean;
    enableSkills?: boolean;
    enableMemory?: boolean;
    skillsContent?: string;
    contextFiles?: Array<{ path: string; content: string }>;
    userTimezone?: string;
    runtimeInfo?: {
        model?: string;
        provider?: string;
        channel?: string;
    };
}

/**
 * Build the complete Agdi system prompt
 * This is the "brain" that controls Agdi's behavior
 */
export function buildAgdiSystemPrompt(options: SystemPromptOptions): string {
    const {
        workspaceDir,
        toolNames = Object.keys(CORE_TOOL_SUMMARIES),
        mode = "full",
        enableReasoning = false,
        enableSkills = true,
        enableMemory = true,
        skillsContent,
        contextFiles = [],
        userTimezone,
        runtimeInfo,
    } = options;

    // Mode: "none" returns just identity
    if (mode === "none") {
        return IDENTITY_PROMPT;
    }

    const isMinimal = mode === "minimal";
    const lines: string[] = [IDENTITY_PROMPT, ""];

    // TOOLING SECTION
    lines.push("## Tooling");
    lines.push("Tool availability (filtered by Zero-Trust policy):");
    lines.push("Tool names are case-sensitive. Call tools exactly as listed.");
    for (const tool of toolNames) {
        const summary = CORE_TOOL_SUMMARIES[tool.toLowerCase()];
        lines.push(summary ? `- ${tool}: ${summary}` : `- ${tool}`);
    }
    lines.push("");

    // TOOL CALL STYLE (always include)
    lines.push(TOOL_CALL_STYLE_PROMPT, "");

    // SKILLS SECTION (full mode only)
    if (!isMinimal && enableSkills) {
        lines.push(SKILLS_PROMPT);
        if (skillsContent) {
            lines.push(skillsContent);
        }
        lines.push("");
    }

    // MEMORY SECTION (full mode only)
    if (!isMinimal && enableMemory && toolNames.some(t =>
        t.toLowerCase().includes("memory")
    )) {
        lines.push(MEMORY_RECALL_PROMPT, "");
    }

    // WORKSPACE SECTION
    lines.push("## Workspace");
    lines.push(`Your working directory is: ${workspaceDir}`);
    lines.push("Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.");
    lines.push("Agdi runs inside WebContainer - a browser-based Node.js runtime.");
    lines.push("");

    // SUBAGENT HINT
    if (!isMinimal) {
        lines.push(SUBAGENT_HINT, "");
    }

    // TIMEZONE
    if (userTimezone) {
        lines.push("## Current Date & Time");
        lines.push(`Time zone: ${userTimezone}`);
        lines.push("");
    }

    // CONTEXT FILES (SOUL.md, etc.)
    if (contextFiles.length > 0) {
        lines.push("# Project Context");
        lines.push("The following project context files have been loaded:");

        const hasSoulFile = contextFiles.some(f =>
            f.path.toLowerCase().endsWith("soul.md")
        );
        if (hasSoulFile) {
            lines.push(SOUL_MD_PROMPT);
        }
        lines.push("");

        for (const file of contextFiles) {
            lines.push(`## ${file.path}`, "", file.content, "");
        }
    }

    // SILENT REPLIES (full mode only)
    if (!isMinimal) {
        lines.push(SILENT_REPLIES_PROMPT, "");
    }

    // HEARTBEAT (full mode only)
    if (!isMinimal) {
        lines.push(HEARTBEAT_PROMPT, "");
    }

    // REASONING FORMAT (if enabled)
    if (enableReasoning) {
        lines.push(REASONING_FORMAT_PROMPT, "");
    }

    // RUNTIME INFO
    if (runtimeInfo) {
        const parts = [
            runtimeInfo.model ? `model=${runtimeInfo.model}` : "",
            runtimeInfo.provider ? `provider=${runtimeInfo.provider}` : "",
            runtimeInfo.channel ? `channel=${runtimeInfo.channel}` : "",
            "runtime=AgdiCore|WebContainer|ZeroTrust",
        ].filter(Boolean);

        lines.push("## Runtime");
        lines.push(`Runtime: ${parts.join(" | ")}`);
    }

    return lines.filter(Boolean).join("\n");
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    // Tokens
    SILENT_REPLY_TOKEN,
    HEARTBEAT_OK_TOKEN,

    // Individual prompts
    IDENTITY_PROMPT,
    TOOL_CALL_STYLE_PROMPT,
    SKILLS_PROMPT,
    MEMORY_RECALL_PROMPT,
    SILENT_REPLIES_PROMPT,
    HEARTBEAT_PROMPT,
    REASONING_FORMAT_PROMPT,
    SOUL_MD_PROMPT,
    SUBAGENT_HINT,

    // Tool summaries
    CORE_TOOL_SUMMARIES,

    // Builder
    buildAgdiSystemPrompt,
};
