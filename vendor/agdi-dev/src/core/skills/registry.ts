/**
 * Agdi Skill Registry
 * 
 * Central registry for managing skills.
 * Initializes the loader and registers default/custom skills.
 */

import { EventEmitter } from 'events';
import { SkillLoader, getSkillLoader } from './loader';
import type { SkillEntry, SkillSnapshot, SkillMatchResult, Skill, SkillLoaderConfig } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Registry configuration
 */
export interface SkillRegistryConfig extends Partial<SkillLoaderConfig> {
    /** Auto-load skills on initialization */
    autoLoad?: boolean;
    /** Default skills to always include */
    defaultSkills?: string[];
}

/**
 * Registered skill with additional metadata
 */
export interface RegisteredSkill {
    entry: SkillEntry;
    registeredAt: number;
    isDefault: boolean;
    priority: number;
}

// =============================================================================
// DEFAULT SKILLS
// =============================================================================

export const DEFAULT_SKILL_NAMES = [
    'coding',   // Code generation and debugging
    'github',   // GitHub integration
    'llm',      // Multi-provider LLM
];

// =============================================================================
// SKILL REGISTRY CLASS
// =============================================================================

export class SkillRegistry extends EventEmitter {
    private loader: SkillLoader;
    private config: SkillRegistryConfig;
    private registeredSkills: Map<string, RegisteredSkill> = new Map();
    private isInitialized: boolean = false;

    constructor(config: SkillRegistryConfig = {}) {
        super();
        this.config = {
            ...config,
            autoLoad: config.autoLoad ?? true,
            defaultSkills: config.defaultSkills ?? DEFAULT_SKILL_NAMES,
        };
        this.loader = getSkillLoader(config);
    }

    /**
     * Initialize the registry
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[SkillRegistry] Initializing...');

        // Load all skills from directories
        if (this.config.autoLoad) {
            const entries = await this.loader.loadAllSkills();

            for (const entry of entries) {
                const isDefault = this.config.defaultSkills?.includes(entry.skill.name) ?? false;
                this.registerSkillEntry(entry, isDefault);
            }
        }

        this.isInitialized = true;
        this.emit('initialized', this.getRegisteredSkillNames());
        console.log(`[SkillRegistry] Initialized with ${this.registeredSkills.size} skills`);
    }

    /**
     * Register a skill entry
     */
    private registerSkillEntry(entry: SkillEntry, isDefault: boolean = false): void {
        const existing = this.registeredSkills.get(entry.skill.name);

        // Calculate priority (higher = more important)
        let priority = 0;
        if (isDefault) priority += 100;
        if (entry.metadata?.always) priority += 50;
        if (entry.source === 'workspace') priority += 25;
        if (entry.source === 'managed') priority += 10;

        // Only override if higher priority or not existing
        if (!existing || priority > existing.priority) {
            this.registeredSkills.set(entry.skill.name, {
                entry,
                registeredAt: Date.now(),
                isDefault,
                priority,
            });
            this.emit('skill_registered', entry.skill.name);
        }
    }

    /**
     * Register a skill manually (for runtime additions)
     */
    registerSkill(skill: Skill, options?: { isDefault?: boolean }): void {
        const entry: SkillEntry = {
            skill,
            frontmatter: { name: skill.name, description: skill.description },
            source: 'custom',
        };
        this.registerSkillEntry(entry, options?.isDefault ?? false);
    }

    /**
     * Unregister a skill
     */
    unregisterSkill(name: string): boolean {
        const deleted = this.registeredSkills.delete(name);
        if (deleted) {
            this.emit('skill_unregistered', name);
        }
        return deleted;
    }

    /**
     * Get a skill by name
     */
    getSkill(name: string): SkillEntry | null {
        return this.registeredSkills.get(name)?.entry || null;
    }

    /**
     * Get all registered skills
     */
    getAllSkills(): SkillEntry[] {
        return Array.from(this.registeredSkills.values())
            .sort((a, b) => b.priority - a.priority)
            .map(r => r.entry);
    }

    /**
     * Get default skills only
     */
    getDefaultSkills(): SkillEntry[] {
        return Array.from(this.registeredSkills.values())
            .filter(r => r.isDefault)
            .sort((a, b) => b.priority - a.priority)
            .map(r => r.entry);
    }

    /**
     * Get skill names
     */
    getRegisteredSkillNames(): string[] {
        return Array.from(this.registeredSkills.keys());
    }

    /**
     * Match skills to a query (for dynamic skill selection)
     */
    matchSkills(query: string, maxResults: number = 3): SkillMatchResult[] {
        const results: SkillMatchResult[] = [];
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);

        for (const registered of this.registeredSkills.values()) {
            const entry = registered.entry;
            let score = 0;
            let reason = '';

            // Check name match
            if (entry.skill.name.toLowerCase().includes(queryLower)) {
                score += 0.5;
                reason = `Name matches "${query}"`;
            }

            // Check description match
            const descLower = entry.skill.description.toLowerCase();
            for (const word of queryWords) {
                if (descLower.includes(word)) {
                    score += 0.1;
                }
            }
            if (score > 0 && !reason) {
                reason = 'Description matches query keywords';
            }

            // Check content match
            const contentLower = entry.skill.content.toLowerCase();
            for (const word of queryWords) {
                if (contentLower.includes(word)) {
                    score += 0.05;
                }
            }

            // Boost for default skills
            if (registered.isDefault) {
                score += 0.2;
            }

            // Boost for always-on skills
            if (entry.metadata?.always) {
                score += 0.3;
                reason = reason || 'Always-on skill';
            }

            if (score > 0) {
                results.push({
                    entry,
                    confidence: Math.min(score, 1),
                    reason: reason || 'Content matches query',
                });
            }
        }

        return results
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, maxResults);
    }

    /**
     * Build skills prompt for system prompt injection
     */
    async buildPrompt(options?: { includeContent?: boolean }): Promise<string> {
        const skills = this.getAllSkills();

        if (skills.length === 0) {
            return '';
        }

        const lines: string[] = [
            '',
            '# Available Skills',
            '',
        ];

        for (const entry of skills) {
            const emoji = entry.metadata?.emoji || '📦';
            lines.push(`## ${emoji} ${entry.skill.name}`);
            lines.push(`${entry.skill.description}`);

            if (options?.includeContent) {
                lines.push('');
                lines.push(entry.skill.content);
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Create a snapshot
     */
    createSnapshot(): SkillSnapshot {
        const skills = this.getAllSkills();
        return {
            prompt: '', // Will be populated by buildPrompt
            skills: skills.map(e => ({
                name: e.skill.name,
                primaryEnv: e.metadata?.primaryEnv,
            })),
            resolvedSkills: skills.map(e => e.skill),
            version: Date.now(),
        };
    }

    /**
     * Reload skills from disk
     */
    async reload(): Promise<void> {
        this.registeredSkills.clear();
        this.loader.clearCache();
        this.isInitialized = false;
        await this.initialize();
        this.emit('reloaded');
    }

    /**
     * Get skill content by name
     */
    getSkillContent(name: string): string | null {
        const skill = this.getSkill(name);
        return skill?.skill.content || null;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let registryInstance: SkillRegistry | null = null;

export function getSkillRegistry(config?: SkillRegistryConfig): SkillRegistry {
    if (!registryInstance) {
        registryInstance = new SkillRegistry(config);
    }
    return registryInstance;
}

export function resetSkillRegistry(): void {
    registryInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    SkillRegistry,
    getSkillRegistry,
    resetSkillRegistry,
    DEFAULT_SKILL_NAMES,
};
