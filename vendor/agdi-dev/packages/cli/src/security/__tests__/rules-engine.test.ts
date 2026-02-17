/**
 * Rules Engine Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    matchesPattern,
    evaluateRules,
    DEFAULT_RULES,
    type Rule,
    type RulePattern,
} from '../rules-engine';

describe('Rules Engine', () => {
    describe('matchesPattern', () => {
        it('should match exact command', () => {
            expect(matchesPattern(['ls'], ['ls'])).toBe(true);
            expect(matchesPattern(['git', 'status'], ['git', 'status'])).toBe(true);
        });

        it('should match prefix patterns', () => {
            expect(matchesPattern(['npm', 'install', 'lodash'], ['npm', 'install'])).toBe(true);
            expect(matchesPattern(['git', 'commit', '-m', 'msg'], ['git', 'commit'])).toBe(true);
        });

        it('should not match shorter argv than pattern', () => {
            expect(matchesPattern(['npm'], ['npm', 'install'])).toBe(false);
            expect(matchesPattern(['git'], ['git', 'status'])).toBe(false);
        });

        it('should match union patterns', () => {
            const pattern: RulePattern = ['git', ['status', 'diff', 'log']];
            expect(matchesPattern(['git', 'status'], pattern)).toBe(true);
            expect(matchesPattern(['git', 'diff'], pattern)).toBe(true);
            expect(matchesPattern(['git', 'log'], pattern)).toBe(true);
            expect(matchesPattern(['git', 'push'], pattern)).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(matchesPattern(['LS'], ['ls'])).toBe(true);
            expect(matchesPattern(['GIT', 'STATUS'], ['git', 'status'])).toBe(true);
            expect(matchesPattern(['Npm', 'Install'], ['npm', 'install'])).toBe(true);
        });

        it('should handle complex patterns', () => {
            const pattern: RulePattern = ['git', 'push', ['--force', '-f']];
            expect(matchesPattern(['git', 'push', '--force'], pattern)).toBe(true);
            expect(matchesPattern(['git', 'push', '-f'], pattern)).toBe(true);
            expect(matchesPattern(['git', 'push', 'origin'], pattern)).toBe(false);
        });
    });

    describe('evaluateRules', () => {
        it('should allow commands matching allow rules', () => {
            const result = evaluateRules(['ls'], DEFAULT_RULES);
            expect(result.decision).toBe('allow');
            expect(result.matchedRules.length).toBeGreaterThan(0);
        });

        it('should forbid commands matching forbid rules', () => {
            const result = evaluateRules(['sudo', 'rm'], DEFAULT_RULES);
            expect(result.decision).toBe('forbid');
        });

        it('should prompt for unknown commands', () => {
            const result = evaluateRules(['unknown-command-xyz'], DEFAULT_RULES);
            expect(result.decision).toBe('prompt');
            expect(result.matchedRules.length).toBe(0);
        });

        it('should apply most restrictive wins (forbid > prompt > allow)', () => {
            // Create rules where same command has multiple actions
            const rules: Rule[] = [
                { id: 'r1', pattern: ['rm'], action: 'prompt', source: 'default', createdAt: '' },
                { id: 'r2', pattern: ['rm', '-rf'], action: 'forbid', source: 'default', createdAt: '' },
            ];

            const result = evaluateRules(['rm', '-rf', '/'], rules);
            expect(result.decision).toBe('forbid');
            expect(result.mostRestrictive?.id).toBe('r2');
        });

        it('should match git read commands as allow', () => {
            expect(evaluateRules(['git', 'status'], DEFAULT_RULES).decision).toBe('allow');
            expect(evaluateRules(['git', 'diff'], DEFAULT_RULES).decision).toBe('allow');
            expect(evaluateRules(['git', 'log'], DEFAULT_RULES).decision).toBe('allow');
        });

        it('should match package managers as prompt', () => {
            expect(evaluateRules(['npm', 'install'], DEFAULT_RULES).decision).toBe('prompt');
            expect(evaluateRules(['yarn', 'add'], DEFAULT_RULES).decision).toBe('prompt');
            expect(evaluateRules(['pnpm', 'install'], DEFAULT_RULES).decision).toBe('prompt');
        });

        it('should return all matched rules', () => {
            const rules: Rule[] = [
                { id: 'r1', pattern: ['git'], action: 'allow', source: 'default', createdAt: '' },
                { id: 'r2', pattern: ['git', 'push'], action: 'prompt', source: 'default', createdAt: '' },
            ];

            const result = evaluateRules(['git', 'push', 'origin'], rules);
            expect(result.matchedRules.length).toBe(2);
        });
    });
});
