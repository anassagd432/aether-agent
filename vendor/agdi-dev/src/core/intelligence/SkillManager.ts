/**
 * Agdi Skill Manager
 * 
 * Implements the "Skills Matching Engine" from MoltBot's intelligence.
 * Before sending a prompt to the LLM, scans available skills and selects
 * the single best match using a lightweight router model.
 * 
 * Flow:
 * 1. Scan skills/ directory for available skills
 * 2. Use fast model to match user request to skill
 * 3. Load only that skill's instructions
 * 4. Append to system prompt
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Skill {
    id: string;
    name: string;
    description: string;
    location: string;
    content?: string;
    triggers?: string[];
    priority?: number;
}

export interface SkillMatch {
    skill: Skill;
    confidence: number;
    reason?: string;
}

export interface SkillManagerConfig {
    skillsDir: string;
    workspaceSkillsDir?: string;
    enableRouterModel?: boolean;
    routerModel?: {
        provider: string;
        model: string;
    };
    maxSkillsToConsider?: number;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: SkillManagerConfig = {
    skillsDir: './skills',
    enableRouterModel: true,
    routerModel: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile', // Fast, cheap router
    },
    maxSkillsToConsider: 10,
};

// =============================================================================
// SKILL MANAGER
// =============================================================================

export class SkillManager {
    private config: SkillManagerConfig;
    private skillsCache: Map<string, Skill> = new Map();
    private lastScanTime: number = 0;
    private scanIntervalMs: number = 30000; // 30 seconds

    constructor(config: Partial<SkillManagerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Scan skills directory and build skills index
     */
    async scanSkills(): Promise<Skill[]> {
        const now = Date.now();

        // Use cache if recent
        if (this.skillsCache.size > 0 && now - this.lastScanTime < this.scanIntervalMs) {
            return Array.from(this.skillsCache.values());
        }

        const skills: Skill[] = [];
        const dirsToScan = [
            this.config.skillsDir,
            this.config.workspaceSkillsDir,
        ].filter(Boolean) as string[];

        for (const dir of dirsToScan) {
            try {
                const entries = await this.scanDirectory(dir);
                skills.push(...entries);
            } catch (error) {
                // Directory might not exist, that's OK
                console.debug(`[SkillManager] Could not scan ${dir}:`, error);
            }
        }

        // Update cache
        this.skillsCache.clear();
        for (const skill of skills) {
            this.skillsCache.set(skill.id, skill);
        }
        this.lastScanTime = now;

        return skills;
    }

    /**
     * Scan a single directory for skills
     */
    private async scanDirectory(dir: string): Promise<Skill[]> {
        const skills: Skill[] = [];

        if (!fs.existsSync(dir)) {
            return skills;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(dir, entry.name, 'SKILL.md');
                if (fs.existsSync(skillPath)) {
                    const skill = await this.parseSkillFile(skillPath, entry.name);
                    if (skill) {
                        skills.push(skill);
                    }
                }
            } else if (entry.name.endsWith('.skill.md') || entry.name === 'SKILL.md') {
                const skill = await this.parseSkillFile(path.join(dir, entry.name), entry.name);
                if (skill) {
                    skills.push(skill);
                }
            }
        }

        return skills;
    }

    /**
     * Parse a SKILL.md file to extract metadata and content
     */
    private async parseSkillFile(filePath: string, fallbackId: string): Promise<Skill | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const { frontmatter, body } = this.parseFrontmatter(content);

            return {
                id: frontmatter.id || fallbackId.replace(/\.skill\.md$/, ''),
                name: frontmatter.name || frontmatter.title || fallbackId,
                description: frontmatter.description || this.extractFirstParagraph(body),
                location: filePath,
                content: body,
                triggers: frontmatter.triggers || frontmatter.keywords || [],
                priority: frontmatter.priority || 0,
            };
        } catch (error) {
            console.error(`[SkillManager] Failed to parse ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Parse YAML frontmatter from markdown
     */
    private parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return { frontmatter: {}, body: content };
        }

        const frontmatterStr = match[1];
        const body = match[2];

        // Simple YAML parsing (key: value format)
        const frontmatter: Record<string, any> = {};
        for (const line of frontmatterStr.split('\n')) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();

                // Handle arrays
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1);
                    frontmatter[key] = value.split(',').map(v => v.trim().replace(/['"]/g, ''));
                } else {
                    frontmatter[key] = value.replace(/['"]/g, '');
                }
            }
        }

        return { frontmatter, body };
    }

    /**
     * Extract first paragraph from markdown body
     */
    private extractFirstParagraph(body: string): string {
        const lines = body.trim().split('\n');
        const paragraph: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '' && paragraph.length > 0) break;
            if (trimmed !== '' && !trimmed.startsWith('#')) {
                paragraph.push(trimmed);
            }
        }

        return paragraph.join(' ').substring(0, 200);
    }

    /**
     * Match user request to the best skill using lightweight routing
     */
    async matchSkill(userRequest: string): Promise<SkillMatch | null> {
        const skills = await this.scanSkills();

        if (skills.length === 0) {
            return null;
        }

        // First, try keyword/trigger matching (fast, no LLM needed)
        const keywordMatch = this.matchByKeywords(userRequest, skills);
        if (keywordMatch && keywordMatch.confidence > 0.9) {
            return keywordMatch;
        }

        // If router model is enabled, use it for fuzzy matching
        if (this.config.enableRouterModel) {
            return this.matchByRouterModel(userRequest, skills);
        }

        // Fall back to keyword match if available
        return keywordMatch;
    }

    /**
     * Match by keywords/triggers (fast, no LLM)
     */
    private matchByKeywords(userRequest: string, skills: Skill[]): SkillMatch | null {
        const requestLower = userRequest.toLowerCase();
        const words = requestLower.split(/\s+/);

        let bestMatch: SkillMatch | null = null;
        let bestScore = 0;

        for (const skill of skills) {
            let score = 0;

            // Check triggers
            for (const trigger of skill.triggers || []) {
                if (requestLower.includes(trigger.toLowerCase())) {
                    score += 0.5;
                }
            }

            // Check name match
            if (requestLower.includes(skill.name.toLowerCase())) {
                score += 0.3;
            }

            // Apply priority bonus
            score += (skill.priority || 0) * 0.1;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    skill,
                    confidence: Math.min(score, 1),
                    reason: 'Keyword match',
                };
            }
        }

        return bestMatch;
    }

    /**
     * Match using lightweight router model (Llama 3 via Groq)
     */
    private async matchByRouterModel(userRequest: string, skills: Skill[]): Promise<SkillMatch | null> {
        // Build the routing prompt
        const skillsList = skills
            .slice(0, this.config.maxSkillsToConsider)
            .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
            .join('\n');

        const routerPrompt = `You are a skill router. Given a user request and a list of available skills, select the SINGLE best matching skill, or respond with "NONE" if no skill clearly applies.

Available Skills:
${skillsList}

User Request: "${userRequest}"

Respond with ONLY the skill number (1, 2, 3...) or "NONE". No explanation.`;

        try {
            // Call the router model (this would integrate with your LLM provider)
            const response = await this.callRouterModel(routerPrompt);
            const trimmed = response.trim().toUpperCase();

            if (trimmed === 'NONE') {
                return null;
            }

            const skillIndex = parseInt(trimmed, 10) - 1;
            if (isNaN(skillIndex) || skillIndex < 0 || skillIndex >= skills.length) {
                return null;
            }

            return {
                skill: skills[skillIndex],
                confidence: 0.85, // Model-based match
                reason: 'Router model selection',
            };
        } catch (error) {
            console.error('[SkillManager] Router model call failed:', error);
            return null;
        }
    }

    /**
     * Call the lightweight router model
     * Override this to integrate with your LLM provider
     */
    protected async callRouterModel(prompt: string): Promise<string> {
        // This is a placeholder - integrate with your actual LLM provider
        // For now, we'll simulate with a simple keyword match
        console.debug('[SkillManager] Router model call (simulated)');
        return 'NONE';
    }

    /**
     * Load the full content of a skill
     */
    async loadSkillContent(skill: Skill): Promise<string> {
        if (skill.content) {
            return skill.content;
        }

        try {
            return fs.readFileSync(skill.location, 'utf-8');
        } catch (error) {
            console.error(`[SkillManager] Failed to load skill ${skill.id}:`, error);
            return '';
        }
    }

    /**
     * Build the skills prompt section for the system prompt
     */
    async buildSkillsPrompt(): Promise<string> {
        const skills = await this.scanSkills();

        if (skills.length === 0) {
            return '';
        }

        const lines = [
            '<available_skills>',
            ...skills.map(s => `  <skill id="${s.id}">
    <name>${s.name}</name>
    <description>${s.description}</description>
    <location>${s.location}</location>
  </skill>`),
            '</available_skills>',
        ];

        return lines.join('\n');
    }

    /**
     * Clear the skills cache
     */
    clearCache(): void {
        this.skillsCache.clear();
        this.lastScanTime = 0;
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let skillManagerInstance: SkillManager | null = null;

export function getSkillManager(config?: Partial<SkillManagerConfig>): SkillManager {
    if (!skillManagerInstance) {
        skillManagerInstance = new SkillManager(config);
    }
    return skillManagerInstance;
}

export function resetSkillManager(): void {
    skillManagerInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    SkillManager,
    getSkillManager,
    resetSkillManager,
};
