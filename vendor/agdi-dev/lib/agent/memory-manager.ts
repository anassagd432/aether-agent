/**
 * Memory Manager
 * 
 * Manages short-term and long-term memory for the autonomous agent.
 * Tracks decisions, avoids repeating failures, and persists discoveries.
 */

import type {
    ShortTermMemory,
    LongTermMemory,
    Action,
    Observation,
    Discovery,
    FailedApproach,
    CodeKnowledge,
} from './types';

// ==================== CONSTANTS ====================

const STORAGE_KEY_SHORT = 'agdi_agent_short_memory';
const STORAGE_KEY_WORKING_SET = 'agdi_agent_working_set';
const STORAGE_KEY_LONG = 'agdi_agent_long_memory';
const MAX_RECENT_ACTIONS = 20;
const MAX_RECENT_OBSERVATIONS = 50;
const MAX_DISCOVERIES = 100;
const MAX_FAILED_APPROACHES = 50;
const CONTEXT_SUMMARY_THRESHOLD = 5000; // characters

// ==================== MEMORY MANAGER CLASS ====================

export class MemoryManager {
    private shortTerm: ShortTermMemory;
    private longTerm: LongTermMemory;
    private persistEnabled: boolean;

    constructor(persistEnabled: boolean = true) {
        this.persistEnabled = persistEnabled;
        this.shortTerm = this.createEmptyShortTerm();
        this.longTerm = this.createEmptyLongTerm();

        if (persistEnabled) {
            this.restore();
        }
    }

    // ==================== SHORT-TERM MEMORY ====================

    /**
     * Add an action to recent history
     */
    addAction(action: Action): void {
        this.shortTerm.recentActions.push(action);

        // Keep only the most recent actions
        if (this.shortTerm.recentActions.length > MAX_RECENT_ACTIONS) {
            this.shortTerm.recentActions = this.shortTerm.recentActions.slice(-MAX_RECENT_ACTIONS);
        }

        this.updateContext();
    }

    /**
     * Add an observation
     */
    addObservation(observation: Observation): void {
        this.shortTerm.recentObservations.push(observation);

        // Keep only the most recent observations
        if (this.shortTerm.recentObservations.length > MAX_RECENT_OBSERVATIONS) {
            this.shortTerm.recentObservations = this.shortTerm.recentObservations.slice(-MAX_RECENT_OBSERVATIONS);
        }

        // Check if this is a discovery worth persisting
        if (observation.importance === 'high' || observation.importance === 'critical') {
            this.recordDiscovery({
                id: `discovery-${Date.now()}`,
                description: observation.content,
                relevance: [observation.source, observation.type],
                timestamp: observation.timestamp,
                source: observation.source,
            });
        }
    }

    /**
     * Set a working variable
     */
    setWorkingVariable(key: string, value: unknown): void {
        this.shortTerm.workingSet.set(key, value);
    }

    /**
     * Get a working variable
     */
    getWorkingVariable<T>(key: string): T | undefined {
        return this.shortTerm.workingSet.get(key) as T | undefined;
    }

    /**
     * Get recent actions
     */
    getRecentActions(count?: number): Action[] {
        const actions = this.shortTerm.recentActions;
        return count ? actions.slice(-count) : actions;
    }

    /**
     * Get recent observations
     */
    getRecentObservations(count?: number): Observation[] {
        const observations = this.shortTerm.recentObservations;
        return count ? observations.slice(-count) : observations;
    }

    /**
     * Get observations by importance
     */
    getImportantObservations(): Observation[] {
        return this.shortTerm.recentObservations.filter(
            o => o.importance === 'high' || o.importance === 'critical'
        );
    }

    /**
     * Get current context summary
     */
    getCurrentContext(): string {
        return this.shortTerm.currentContext;
    }

    /**
     * Update context summary when it gets too large
     */
    private updateContext(): void {
        const actions = this.shortTerm.recentActions.slice(-5);
        const observations = this.getImportantObservations().slice(-5);

        const actionSummary = actions.map(a =>
            `[${new Date(a.timestamp).toISOString()}] ${a.type}: ${a.result.success ? 'SUCCESS' : 'FAILED'}`
        ).join('\n');

        const observationSummary = observations.map(o =>
            `[${o.importance}] ${o.content.substring(0, 100)}`
        ).join('\n');

        this.shortTerm.currentContext = `
## Recent Actions (last 5)
${actionSummary || 'No recent actions'}

## Important Observations
${observationSummary || 'No important observations'}

## Working Variables
${Array.from(this.shortTerm.workingSet.entries()).map(([k, v]) =>
            `- ${k}: ${JSON.stringify(v).substring(0, 50)}`
        ).join('\n') || 'None'}
`.trim();

        if (this.shortTerm.currentContext.length > CONTEXT_SUMMARY_THRESHOLD) {
            this.shortTerm.currentContext = this.shortTerm.currentContext.substring(0, CONTEXT_SUMMARY_THRESHOLD) + '\n...';
        }
    }

    /**
     * Clear short-term memory
     */
    clearShortTerm(): void {
        this.shortTerm = this.createEmptyShortTerm();
    }

    // ==================== LONG-TERM MEMORY ====================

    /**
     * Record a failed approach to avoid repeating
     */
    recordFailure(approach: string, reason: string, context: string = ''): void {
        this.longTerm.failedApproaches.push({
            approach,
            reason,
            timestamp: Date.now(),
            context,
        });

        // Keep only the most recent failures
        if (this.longTerm.failedApproaches.length > MAX_FAILED_APPROACHES) {
            this.longTerm.failedApproaches = this.longTerm.failedApproaches.slice(-MAX_FAILED_APPROACHES);
        }

        this.persist();
    }

    /**
     * Record a discovery
     */
    recordDiscovery(discovery: Discovery): void {
        // Avoid duplicates
        const exists = this.longTerm.discoveries.some(
            d => d.description === discovery.description
        );

        if (!exists) {
            this.longTerm.discoveries.push(discovery);

            if (this.longTerm.discoveries.length > MAX_DISCOVERIES) {
                this.longTerm.discoveries = this.longTerm.discoveries.slice(-MAX_DISCOVERIES);
            }

            this.persist();
        }
    }

    /**
     * Record completed goal
     */
    recordCompletedGoal(goal: string): void {
        if (!this.longTerm.completedGoals.includes(goal)) {
            this.longTerm.completedGoals.push(goal);
            this.persist();
        }
    }

    /**
     * Update code knowledge about a file
     */
    updateCodeKnowledge(knowledge: CodeKnowledge): void {
        const existingIndex = this.longTerm.codeKnowledge.findIndex(
            k => k.file === knowledge.file
        );

        if (existingIndex >= 0) {
            this.longTerm.codeKnowledge[existingIndex] = knowledge;
        } else {
            this.longTerm.codeKnowledge.push(knowledge);
        }

        this.persist();
    }

    /**
     * Check if an approach should be avoided
     */
    shouldAvoid(approach: string): boolean {
        const normalizedApproach = approach.toLowerCase();
        return this.longTerm.failedApproaches.some(
            f => normalizedApproach.includes(f.approach.toLowerCase())
        );
    }

    /**
     * Get relevant memories based on a query
     */
    getRelevantMemories(query: string): {
        discoveries: Discovery[];
        failedApproaches: FailedApproach[];
        codeKnowledge: CodeKnowledge[];
    } {
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/);

        // Simple relevance scoring based on term matching
        const scoreItem = (text: string): number => {
            const textLower = text.toLowerCase();
            return queryTerms.reduce((score, term) =>
                score + (textLower.includes(term) ? 1 : 0), 0
            );
        };

        const relevantDiscoveries = this.longTerm.discoveries
            .map(d => ({ item: d, score: scoreItem(d.description + ' ' + d.relevance.join(' ')) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(x => x.item);

        const relevantFailures = this.longTerm.failedApproaches
            .map(f => ({ item: f, score: scoreItem(f.approach + ' ' + f.reason) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(x => x.item);

        const relevantCode = this.longTerm.codeKnowledge
            .map(c => ({ item: c, score: scoreItem(c.file + ' ' + c.summary) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(x => x.item);

        return {
            discoveries: relevantDiscoveries,
            failedApproaches: relevantFailures,
            codeKnowledge: relevantCode,
        };
    }

    /**
     * Get all failed approaches
     */
    getFailedApproaches(): FailedApproach[] {
        return [...this.longTerm.failedApproaches];
    }

    /**
     * Get all discoveries
     */
    getDiscoveries(): Discovery[] {
        return [...this.longTerm.discoveries];
    }

    /**
     * Get code knowledge for a file
     */
    getCodeKnowledge(file: string): CodeKnowledge | undefined {
        return this.longTerm.codeKnowledge.find(k => k.file === file);
    }

    // ==================== SUMMARIZATION ====================

    /**
     * Generate a comprehensive context summary for LLM
     */
    summarizeForLLM(): string {
        const recentActions = this.getRecentActions(10);
        const discoveries = this.longTerm.discoveries.slice(-5);
        const failures = this.longTerm.failedApproaches.slice(-3);

        return `
## Agent Memory Summary

### Recent Actions (${recentActions.length})
${recentActions.map(a =>
            `- ${a.type}: ${a.result.success ? '✓' : '✗'} ${a.result.output.substring(0, 100)}`
        ).join('\n') || 'None'}

### Key Discoveries (${discoveries.length})
${discoveries.map(d => `- ${d.description}`).join('\n') || 'None'}

### Failed Approaches to Avoid (${failures.length})
${failures.map(f => `- ❌ ${f.approach}: ${f.reason}`).join('\n') || 'None'}

### Completed Goals
${this.longTerm.completedGoals.slice(-5).map(g => `- ✓ ${g}`).join('\n') || 'None'}
`.trim();
    }

    // ==================== PERSISTENCE ====================

    /**
     * Persist memory to storage
     */
    persist(): void {
        if (!this.persistEnabled) return;

        try {
            // Check if localStorage is available (browser environment)
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY_LONG, JSON.stringify(this.longTerm));
                localStorage.setItem(STORAGE_KEY_SHORT, JSON.stringify({
                    recentActions: this.shortTerm.recentActions,
                    recentObservations: this.shortTerm.recentObservations,
                    currentContext: this.shortTerm.currentContext,
                }));
                localStorage.setItem(STORAGE_KEY_WORKING_SET, JSON.stringify(
                    Object.fromEntries(this.shortTerm.workingSet)
                ));
            }
        } catch (error) {
            console.warn('Failed to persist memory:', error);
        }
    }

    /**
     * Restore memory from storage
     */
    restore(): void {
        if (!this.persistEnabled) return;

        try {
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem(STORAGE_KEY_LONG);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.longTerm = {
                        ...this.createEmptyLongTerm(),
                        ...parsed,
                    };
                }

                const storedShort = localStorage.getItem(STORAGE_KEY_SHORT);
                if (storedShort) {
                    const parsedShort = JSON.parse(storedShort);
                    this.shortTerm = {
                        ...this.createEmptyShortTerm(),
                        ...parsedShort,
                        workingSet: this.shortTerm.workingSet,
                    };
                }

                const storedWorking = localStorage.getItem(STORAGE_KEY_WORKING_SET);
                if (storedWorking) {
                    const parsedWorking = JSON.parse(storedWorking);
                    this.shortTerm.workingSet = new Map(Object.entries(parsedWorking));
                }
            }
        } catch (error) {
            console.warn('Failed to restore memory:', error);
        }
    }

    /**
     * Clear all memory
     */
    clearAll(): void {
        this.shortTerm = this.createEmptyShortTerm();
        this.longTerm = this.createEmptyLongTerm();

        if (this.persistEnabled && typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY_SHORT);
            localStorage.removeItem(STORAGE_KEY_LONG);
            localStorage.removeItem(STORAGE_KEY_WORKING_SET);
        }
    }

    // ==================== HELPERS ====================

    private createEmptyShortTerm(): ShortTermMemory {
        return {
            recentActions: [],
            recentObservations: [],
            currentContext: '',
            workingSet: new Map(),
        };
    }

    private createEmptyLongTerm(): LongTermMemory {
        return {
            completedGoals: [],
            failedApproaches: [],
            discoveries: [],
            codeKnowledge: [],
        };
    }

    /**
     * Export memory for debugging
     */
    export(): { shortTerm: ShortTermMemory; longTerm: LongTermMemory } {
        return {
            shortTerm: {
                ...this.shortTerm,
                workingSet: Object.fromEntries(this.shortTerm.workingSet) as unknown as Map<string, unknown>,
            },
            longTerm: { ...this.longTerm },
        };
    }
}

// Export singleton for convenience
export const memoryManager = new MemoryManager();
