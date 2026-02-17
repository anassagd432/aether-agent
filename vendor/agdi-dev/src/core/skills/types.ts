/**
 * Agdi Skill Types
 * 
 * Type definitions for the Skills Engine.
 * Extracted and refactored from MoltBot's skills system.
 */

// =============================================================================
// CORE SKILL TYPES
// =============================================================================

/**
 * Raw skill as loaded from SKILL.md file
 */
export interface Skill {
    /** Unique skill name (from frontmatter) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Full markdown content (after frontmatter) */
    content: string;
    /** Source file path */
    path: string;
}

/**
 * Parsed YAML frontmatter from SKILL.md
 */
export type ParsedSkillFrontmatter = Record<string, string>;

/**
 * Agdi-specific skill metadata (parsed from frontmatter.metadata.agdi)
 */
export interface AgdiSkillMetadata {
    /** Always include in prompt */
    always?: boolean;
    /** Unique skill key override */
    skillKey?: string;
    /** Primary environment (node, python, etc.) */
    primaryEnv?: string;
    /** Emoji for display */
    emoji?: string;
    /** Homepage URL */
    homepage?: string;
    /** Supported operating systems */
    os?: string[];
    /** Requirements for skill to be available */
    requires?: SkillRequirements;
    /** Installation instructions */
    install?: SkillInstallSpec[];
}

/**
 * Skill requirements
 */
export interface SkillRequirements {
    /** Required binaries (all must exist) */
    bins?: string[];
    /** Alternative binaries (at least one must exist) */
    anyBins?: string[];
    /** Required environment variables */
    env?: string[];
    /** Required config keys */
    config?: string[];
}

/**
 * Installation specification for a skill dependency
 */
export interface SkillInstallSpec {
    /** Optional identifier */
    id?: string;
    /** Package manager type */
    kind: 'brew' | 'node' | 'go' | 'uv' | 'download';
    /** Human-readable label */
    label?: string;
    /** Binaries this provides */
    bins?: string[];
    /** Supported operating systems */
    os?: string[];
    /** Homebrew formula name */
    formula?: string;
    /** npm/node package name */
    package?: string;
    /** Go/Python module name */
    module?: string;
    /** Download URL */
    url?: string;
    /** Archive format */
    archive?: string;
    /** Whether to extract archive */
    extract?: boolean;
    /** Strip N path components from archive */
    stripComponents?: number;
    /** Target installation directory */
    targetDir?: string;
}

/**
 * Skill invocation policy
 */
export interface SkillInvocationPolicy {
    /** Can user invoke directly via command */
    userInvocable: boolean;
    /** Disable LLM from auto-invoking */
    disableModelInvocation: boolean;
}

/**
 * Complete skill entry with all metadata
 */
export interface SkillEntry {
    /** The skill itself */
    skill: Skill;
    /** Raw frontmatter data */
    frontmatter: ParsedSkillFrontmatter;
    /** Parsed Agdi metadata */
    metadata?: AgdiSkillMetadata;
    /** Invocation policy */
    invocation?: SkillInvocationPolicy;
    /** Source directory (workspace, managed, bundled) */
    source: SkillSource;
}

/**
 * Where a skill was loaded from
 */
export type SkillSource = 'workspace' | 'managed' | 'bundled' | 'custom';

/**
 * Context for determining skill eligibility
 */
export interface SkillEligibilityContext {
    /** Remote/sandbox environment info */
    remote?: {
        platforms: string[];
        hasBin: (bin: string) => boolean;
        hasAnyBin: (bins: string[]) => boolean;
        note?: string;
    };
    /** Current OS platform */
    platform?: NodeJS.Platform;
}

/**
 * Skill snapshot for caching
 */
export interface SkillSnapshot {
    /** Generated prompt text */
    prompt: string;
    /** List of included skills */
    skills: Array<{ name: string; primaryEnv?: string }>;
    /** Full skill objects */
    resolvedSkills?: Skill[];
    /** Snapshot version for cache invalidation */
    version?: number;
}

/**
 * Command spec for skill-based commands
 */
export interface SkillCommandSpec {
    /** Command name */
    name: string;
    /** Source skill name */
    skillName: string;
    /** Command description */
    description: string;
    /** Optional dispatch behavior */
    dispatch?: SkillCommandDispatchSpec;
}

/**
 * How to dispatch a skill command
 */
export interface SkillCommandDispatchSpec {
    kind: 'tool';
    /** Tool name to invoke */
    toolName: string;
    /** Argument passing mode */
    argMode?: 'raw';
}

// =============================================================================
// LOADER CONFIGURATION
// =============================================================================

/**
 * Configuration for SkillLoader
 */
export interface SkillLoaderConfig {
    /** Workspace root directory */
    workspaceDir: string;
    /** .agdi/skills directory (managed skills) */
    managedSkillsDir?: string;
    /** Bundled skills directory (shipped with Agdi) */
    bundledSkillsDir?: string;
    /** Custom skills directories */
    customDirs?: string[];
    /** Enable caching */
    enableCache?: boolean;
    /** Cache TTL in milliseconds */
    cacheTtlMs?: number;
}

/**
 * Skill filter options
 */
export interface SkillFilterOptions {
    /** Only include skills with these names */
    names?: string[];
    /** Only include skills with "always: true" */
    alwaysOnly?: boolean;
    /** Eligibility context for platform filtering */
    eligibility?: SkillEligibilityContext;
}

// =============================================================================
// SKILL MATCH RESULT
// =============================================================================

/**
 * Result from skill matching
 */
export interface SkillMatchResult {
    /** Matched skill entry */
    entry: SkillEntry;
    /** Match confidence (0-1) */
    confidence: number;
    /** Why this skill matched */
    reason: string;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    // Types are exported above, this is for namespace convenience
};
