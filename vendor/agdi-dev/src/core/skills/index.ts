/**
 * Agdi Skills Module
 * 
 * Unified exports for the Skills Engine.
 */

// Types
export type {
    Skill,
    SkillEntry,
    SkillSource,
    SkillSnapshot,
    SkillMatchResult,
    SkillFilterOptions,
    SkillLoaderConfig,
    AgdiSkillMetadata,
    SkillRequirements,
    SkillInstallSpec,
    SkillInvocationPolicy,
    SkillCommandSpec,
    SkillCommandDispatchSpec,
    SkillEligibilityContext,
    ParsedSkillFrontmatter,
} from './types';

// Loader
export {
    SkillLoader,
    getSkillLoader,
    resetSkillLoader,
    parseFrontmatter,
    parseMetadata,
    safeFs,
} from './loader';

// Registry
export {
    SkillRegistry,
    getSkillRegistry,
    resetSkillRegistry,
    DEFAULT_SKILL_NAMES,
    type SkillRegistryConfig,
    type RegisteredSkill,
} from './registry';
