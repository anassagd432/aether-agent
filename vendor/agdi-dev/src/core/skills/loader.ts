/**
 * Agdi Skill Loader
 * 
 * Loads and parses SKILL.md files from workspace directories.
 * Extracted and refactored from MoltBot's skills/workspace.ts.
 * 
 * Features:
 * - YAML frontmatter parsing
 * - Multi-directory skill discovery
 * - Skill filtering and eligibility
 * - Zero-Trust file access (safeFs wrapper)
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';

import type {
    Skill,
    SkillEntry,
    SkillLoaderConfig,
    SkillFilterOptions,
    ParsedSkillFrontmatter,
    AgdiSkillMetadata,
    SkillInvocationPolicy,
    SkillSnapshot,
    SkillSource,
    SkillRequirements,
    SkillInstallSpec,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const SKILL_MD = 'SKILL.md';
const DEFAULT_CACHE_TTL_MS = 30_000; // 30 seconds
const BUNDLED_SKILLS_DIR = path.join(__dirname, '../../skills');

// =============================================================================
// SAFE FS WRAPPER (Zero-Trust)
// =============================================================================

/**
 * Zero-Trust file system wrapper
 * All file operations go through this for security logging
 */
export const safeFs = {
    async read(filePath: string): Promise<string | null> {
        try {
            // Normalize and validate path
            const normalized = path.normalize(filePath);

            // Security: prevent path traversal
            if (normalized.includes('..')) {
                console.warn(`[safeFs] Blocked path traversal attempt: ${filePath}`);
                return null;
            }

            // Check file exists
            if (!fs.existsSync(normalized)) {
                return null;
            }

            // Read file
            const content = await fs.promises.readFile(normalized, 'utf-8');
            return content;
        } catch (error) {
            console.error(`[safeFs] Read error: ${filePath}`, error);
            return null;
        }
    },

    existsSync(filePath: string): boolean {
        try {
            return fs.existsSync(path.normalize(filePath));
        } catch {
            return false;
        }
    },

    readdirSync(dirPath: string): string[] {
        try {
            return fs.readdirSync(path.normalize(dirPath));
        } catch {
            return [];
        }
    },

    statSync(filePath: string): fs.Stats | null {
        try {
            return fs.statSync(path.normalize(filePath));
        } catch {
            return null;
        }
    },
};

// =============================================================================
// FRONTMATTER PARSER
// =============================================================================

/**
 * Parse YAML frontmatter from SKILL.md content
 */
export function parseFrontmatter(content: string): ParsedSkillFrontmatter {
    const frontmatter: ParsedSkillFrontmatter = {};

    // Match frontmatter block: ---\n...\n---
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
        return frontmatter;
    }

    const yaml = match[1];
    const lines = yaml.split('\n');

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        frontmatter[key] = value;
    }

    return frontmatter;
}

/**
 * Extract content after frontmatter
 */
export function extractContent(raw: string): string {
    const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return match ? match[1].trim() : raw;
}

/**
 * Parse metadata JSON from frontmatter
 */
export function parseMetadata(frontmatter: ParsedSkillFrontmatter): AgdiSkillMetadata | undefined {
    const metadataStr = frontmatter.metadata;
    if (!metadataStr) return undefined;

    try {
        const parsed = JSON.parse(metadataStr);
        const agdiMeta = parsed.agdi || parsed.moltbot || parsed.clawdbot;

        if (!agdiMeta || typeof agdiMeta !== 'object') {
            return undefined;
        }

        const requires: SkillRequirements | undefined = agdiMeta.requires ? {
            bins: normalizeStringList(agdiMeta.requires.bins),
            anyBins: normalizeStringList(agdiMeta.requires.anyBins),
            env: normalizeStringList(agdiMeta.requires.env),
            config: normalizeStringList(agdiMeta.requires.config),
        } : undefined;

        return {
            always: typeof agdiMeta.always === 'boolean' ? agdiMeta.always : undefined,
            emoji: typeof agdiMeta.emoji === 'string' ? agdiMeta.emoji : undefined,
            homepage: typeof agdiMeta.homepage === 'string' ? agdiMeta.homepage : undefined,
            skillKey: typeof agdiMeta.skillKey === 'string' ? agdiMeta.skillKey : undefined,
            primaryEnv: typeof agdiMeta.primaryEnv === 'string' ? agdiMeta.primaryEnv : undefined,
            os: normalizeStringList(agdiMeta.os),
            requires,
            install: parseInstallSpecs(agdiMeta.install),
        };
    } catch {
        return undefined;
    }
}

/**
 * Parse invocation policy from frontmatter
 */
export function parseInvocationPolicy(frontmatter: ParsedSkillFrontmatter): SkillInvocationPolicy {
    return {
        userInvocable: parseBool(frontmatter['user-invocable'], true),
        disableModelInvocation: parseBool(frontmatter['disable-model-invocation'], false),
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeStringList(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof input === 'string') {
        return input.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'no' || lower === '0') return false;
    return fallback;
}

function parseInstallSpecs(input: unknown): SkillInstallSpec[] | undefined {
    if (!Array.isArray(input)) return undefined;

    const specs: SkillInstallSpec[] = [];
    for (const item of input) {
        if (typeof item !== 'object' || !item) continue;
        const raw = item as Record<string, unknown>;
        const kind = String(raw.kind || raw.type || '').toLowerCase();

        if (!['brew', 'node', 'go', 'uv', 'download'].includes(kind)) continue;

        specs.push({
            kind: kind as SkillInstallSpec['kind'],
            id: typeof raw.id === 'string' ? raw.id : undefined,
            label: typeof raw.label === 'string' ? raw.label : undefined,
            bins: normalizeStringList(raw.bins),
            os: normalizeStringList(raw.os),
            formula: typeof raw.formula === 'string' ? raw.formula : undefined,
            package: typeof raw.package === 'string' ? raw.package : undefined,
            module: typeof raw.module === 'string' ? raw.module : undefined,
            url: typeof raw.url === 'string' ? raw.url : undefined,
        });
    }

    return specs.length > 0 ? specs : undefined;
}

// =============================================================================
// SKILL LOADER CLASS
// =============================================================================

export class SkillLoader extends EventEmitter {
    private config: SkillLoaderConfig;
    private cache: Map<string, { entries: SkillEntry[]; timestamp: number }> = new Map();

    constructor(config: Partial<SkillLoaderConfig> = {}) {
        super();
        this.config = {
            workspaceDir: config.workspaceDir || process.cwd(),
            managedSkillsDir: config.managedSkillsDir || path.join(homedir(), '.agdi', 'skills'),
            bundledSkillsDir: config.bundledSkillsDir || BUNDLED_SKILLS_DIR,
            customDirs: config.customDirs || [],
            enableCache: config.enableCache ?? true,
            cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
        };
    }

    /**
     * Load skills from a directory
     * The main method described in the audit
     */
    async loadSkillsFromDir(dir: string, source: SkillSource): Promise<SkillEntry[]> {
        if (!safeFs.existsSync(dir)) {
            return [];
        }

        const entries: SkillEntry[] = [];
        const items = safeFs.readdirSync(dir);

        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = safeFs.statSync(itemPath);

            if (!stat?.isDirectory()) continue;

            const skillMdPath = path.join(itemPath, SKILL_MD);
            const content = await safeFs.read(skillMdPath);

            if (!content) continue;

            try {
                const frontmatter = parseFrontmatter(content);
                const skillContent = extractContent(content);

                const skill: Skill = {
                    name: frontmatter.name || item,
                    description: frontmatter.description || '',
                    content: skillContent,
                    path: skillMdPath,
                };

                const entry: SkillEntry = {
                    skill,
                    frontmatter,
                    metadata: parseMetadata(frontmatter),
                    invocation: parseInvocationPolicy(frontmatter),
                    source,
                };

                entries.push(entry);
                this.emit('skill_loaded', entry);
            } catch (error) {
                console.error(`[SkillLoader] Failed to parse skill: ${itemPath}`, error);
                this.emit('skill_error', { path: itemPath, error });
            }
        }

        return entries;
    }

    /**
     * Load all skills from all configured directories
     */
    async loadAllSkills(): Promise<SkillEntry[]> {
        const cacheKey = 'all';

        // Check cache
        if (this.config.enableCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < (this.config.cacheTtlMs || DEFAULT_CACHE_TTL_MS)) {
                return cached.entries;
            }
        }

        const allEntries: SkillEntry[] = [];

        // 1. Load bundled skills (lowest priority)
        if (this.config.bundledSkillsDir) {
            const bundled = await this.loadSkillsFromDir(this.config.bundledSkillsDir, 'bundled');
            allEntries.push(...bundled);
        }

        // 2. Load managed skills (~/.agdi/skills/)
        if (this.config.managedSkillsDir) {
            const managed = await this.loadSkillsFromDir(this.config.managedSkillsDir, 'managed');
            allEntries.push(...managed);
        }

        // 3. Load custom directories
        for (const customDir of this.config.customDirs || []) {
            const custom = await this.loadSkillsFromDir(customDir, 'custom');
            allEntries.push(...custom);
        }

        // 4. Load workspace skills (highest priority - overrides others)
        const workspaceSkillsDir = path.join(this.config.workspaceDir, 'src', 'skills');
        const workspace = await this.loadSkillsFromDir(workspaceSkillsDir, 'workspace');
        allEntries.push(...workspace);

        // Also check .agdi/skills in workspace
        const dotAgdiSkills = path.join(this.config.workspaceDir, '.agdi', 'skills');
        const workspaceManaged = await this.loadSkillsFromDir(dotAgdiSkills, 'workspace');
        allEntries.push(...workspaceManaged);

        // Dedupe by name (later entries override earlier)
        const byName = new Map<string, SkillEntry>();
        for (const entry of allEntries) {
            byName.set(entry.skill.name, entry);
        }
        const dedupedEntries = Array.from(byName.values());

        // Cache result
        if (this.config.enableCache) {
            this.cache.set(cacheKey, { entries: dedupedEntries, timestamp: Date.now() });
        }

        this.emit('skills_loaded', dedupedEntries);
        return dedupedEntries;
    }

    /**
     * Filter skills by options
     */
    filterSkills(entries: SkillEntry[], options: SkillFilterOptions): SkillEntry[] {
        let filtered = entries;

        // Filter by names
        if (options.names && options.names.length > 0) {
            const nameSet = new Set(options.names.map(n => n.toLowerCase()));
            filtered = filtered.filter(e => nameSet.has(e.skill.name.toLowerCase()));
        }

        // Filter by always flag
        if (options.alwaysOnly) {
            filtered = filtered.filter(e => e.metadata?.always === true);
        }

        // Filter by eligibility
        if (options.eligibility) {
            filtered = filtered.filter(e => this.isEligible(e, options.eligibility!));
        }

        return filtered;
    }

    /**
     * Check if a skill is eligible in the current context
     */
    private isEligible(entry: SkillEntry, context: NonNullable<SkillFilterOptions['eligibility']>): boolean {
        const meta = entry.metadata;
        if (!meta) return true;

        // Check OS restriction
        if (meta.os && meta.os.length > 0) {
            const platform = context.platform || process.platform;
            if (!meta.os.includes(platform)) {
                return false;
            }
        }

        // Check binary requirements
        if (meta.requires?.bins && meta.requires.bins.length > 0 && context.remote) {
            const allPresent = meta.requires.bins.every(bin => context.remote!.hasBin(bin));
            if (!allPresent) return false;
        }

        // Check any-bin requirements
        if (meta.requires?.anyBins && meta.requires.anyBins.length > 0 && context.remote) {
            if (!context.remote.hasAnyBin(meta.requires.anyBins)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Build skills prompt for system prompt injection
     */
    async buildSkillsPrompt(options?: SkillFilterOptions): Promise<string> {
        const entries = await this.loadAllSkills();
        const filtered = options ? this.filterSkills(entries, options) : entries;

        if (filtered.length === 0) {
            return '';
        }

        const lines: string[] = [
            '<available_skills>',
        ];

        for (const entry of filtered) {
            const emoji = entry.metadata?.emoji || '📦';
            lines.push(`  <skill name="${entry.skill.name}" emoji="${emoji}">`);
            lines.push(`    <description>${entry.skill.description}</description>`);
            lines.push(`    <path>${entry.skill.path}</path>`);
            lines.push(`  </skill>`);
        }

        lines.push('</available_skills>');
        return lines.join('\n');
    }

    /**
     * Create a snapshot of loaded skills
     */
    async createSnapshot(options?: SkillFilterOptions): Promise<SkillSnapshot> {
        const entries = await this.loadAllSkills();
        const filtered = options ? this.filterSkills(entries, options) : entries;

        return {
            prompt: await this.buildSkillsPrompt(options),
            skills: filtered.map(e => ({
                name: e.skill.name,
                primaryEnv: e.metadata?.primaryEnv,
            })),
            resolvedSkills: filtered.map(e => e.skill),
            version: Date.now(),
        };
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
        this.emit('cache_cleared');
    }

    /**
     * Get a skill by name
     */
    async getSkill(name: string): Promise<SkillEntry | null> {
        const entries = await this.loadAllSkills();
        return entries.find(e => e.skill.name.toLowerCase() === name.toLowerCase()) || null;
    }

    /**
     * Get skill content (for injection into prompt)
     */
    async getSkillContent(name: string): Promise<string | null> {
        const entry = await this.getSkill(name);
        return entry?.skill.content || null;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let skillLoaderInstance: SkillLoader | null = null;

export function getSkillLoader(config?: Partial<SkillLoaderConfig>): SkillLoader {
    if (!skillLoaderInstance) {
        skillLoaderInstance = new SkillLoader(config);
    }
    return skillLoaderInstance;
}

export function resetSkillLoader(): void {
    if (skillLoaderInstance) {
        skillLoaderInstance.clearCache();
    }
    skillLoaderInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    SkillLoader,
    getSkillLoader,
    resetSkillLoader,
    parseFrontmatter,
    parseMetadata,
    safeFs,
};
