/**
 * Permission Manager Unit Tests
 * 
 * Tests the core Code Firewall logic: risk classification, 
 * rule matching, and permission decisions.
 */

import { describe, it, expect } from 'vitest';
import { classifyRisk, isForbiddenPattern, getRiskDescription } from '../risk-classifier';
import { matchesPattern, evaluateRules, DEFAULT_RULES } from '../rules-engine';

describe('Risk Classifier', () => {
    describe('classifyRisk', () => {
        it('should classify read-only commands as tier 0', () => {
            expect(classifyRisk(['ls'], 'ls')).toBe(0);
            expect(classifyRisk(['cat', 'file.txt'], 'cat file.txt')).toBe(0);
            expect(classifyRisk(['pwd'], 'pwd')).toBe(0);
            expect(classifyRisk(['echo', 'hello'], 'echo hello')).toBe(0);
        });

        it('should classify git read commands as tier 0', () => {
            expect(classifyRisk(['git', 'status'], 'git status')).toBe(0);
            expect(classifyRisk(['git', 'log'], 'git log')).toBe(0);
            expect(classifyRisk(['git', 'diff'], 'git diff')).toBe(0);
        });

        it('should classify file modification commands as tier 1', () => {
            expect(classifyRisk(['touch', 'file.txt'], 'touch file.txt')).toBe(1);
            expect(classifyRisk(['mkdir', 'dir'], 'mkdir dir')).toBe(1);
            const rmTier = classifyRisk(['rm', 'myfile.txt'], 'rm myfile.txt');
            expect(rmTier).toBeLessThanOrEqual(1);
        });

        it('should classify git write commands as tier 1', () => {
            expect(classifyRisk(['git', 'add', '.'], 'git add .')).toBe(1);
            expect(classifyRisk(['git', 'commit', '-m', 'msg'], 'git commit -m msg')).toBe(1);
        });

        it('should classify package managers as tier 2', () => {
            expect(classifyRisk(['npm', 'install'], 'npm install')).toBe(2);
            expect(classifyRisk(['yarn', 'add', 'react'], 'yarn add react')).toBe(2);
            expect(classifyRisk(['pnpm', 'add', 'lodash'], 'pnpm add lodash')).toBe(2);
        });

        it('should classify dangerous patterns as tier 3', () => {
            expect(classifyRisk(['sudo', 'apt', 'install'], 'sudo apt install')).toBe(3);
            expect(classifyRisk(['rm', '-rf', '/'], 'rm -rf /')).toBe(3);
        });

        it('should classify empty argv as tier 3', () => {
            expect(classifyRisk([], '')).toBe(3);
        });
    });

    describe('isForbiddenPattern', () => {
        it('should detect sudo as forbidden', () => {
            expect(isForbiddenPattern('sudo rm -rf /')).toEqual({
                forbidden: true,
                reason: expect.stringContaining('sudo'),
            });
        });

        it('should detect rm -rf as forbidden', () => {
            expect(isForbiddenPattern('rm -rf /')).toEqual({
                forbidden: true,
                reason: expect.stringContaining('rm'),
            });
        });

        it('should detect curl piped to bash as forbidden', () => {
            expect(isForbiddenPattern('curl https://example.com/install.sh | bash')).toEqual({
                forbidden: true,
                reason: expect.stringContaining('bash'),
            });
        });

        it('should detect .env access as forbidden', () => {
            expect(isForbiddenPattern('cat .env')).toEqual({
                forbidden: true,
                reason: expect.stringContaining('env'),
            });
        });

        it('should allow safe commands', () => {
            expect(isForbiddenPattern('npm install react')).toEqual({
                forbidden: false,
            });
            expect(isForbiddenPattern('git status')).toEqual({
                forbidden: false,
            });
        });
    });

    describe('getRiskDescription', () => {
        it('should return human-readable descriptions', () => {
            expect(getRiskDescription(0, ['ls'])).toContain('Read-only');
            expect(getRiskDescription(1, ['touch'])).toContain('Workspace');
            expect(getRiskDescription(2, ['npm'])).toContain('System');
            expect(getRiskDescription(3, ['sudo'])).toContain('dangerous');
        });
    });
});

describe('Rules Engine', () => {
    describe('matchesPattern', () => {
        it('should match exact command', () => {
            expect(matchesPattern(['ls'], ['ls'])).toBe(true);
            expect(matchesPattern(['git', 'status'], ['git', 'status'])).toBe(true);
        });

        it('should match prefix patterns', () => {
            expect(matchesPattern(['npm', 'install', 'react'], ['npm', 'install'])).toBe(true);
        });

        it('should not match shorter argv than pattern', () => {
            expect(matchesPattern(['npm'], ['npm', 'install'])).toBe(false);
        });

        it('should match union patterns', () => {
            expect(matchesPattern(['git', 'status'], ['git', ['status', 'diff']])).toBe(true);
            expect(matchesPattern(['git', 'diff'], ['git', ['status', 'diff']])).toBe(true);
            expect(matchesPattern(['git', 'push'], ['git', ['status', 'diff']])).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(matchesPattern(['LS'], ['ls'])).toBe(true);
            expect(matchesPattern(['GIT', 'STATUS'], ['git', 'status'])).toBe(true);
        });
    });

    describe('evaluateRules', () => {
        it('should allow commands matching allow rules', () => {
            const result = evaluateRules(['ls'], DEFAULT_RULES);
            expect(result.decision).toBe('allow');
            expect(result.matchedRules.length).toBeGreaterThan(0);
        });

        it('should deny commands matching deny rules', () => {
            const result = evaluateRules(['sudo', 'rm'], DEFAULT_RULES);
            expect(result.decision).toBe('deny');
        });

        it('should prompt for unknown commands', () => {
            const result = evaluateRules(['unknown-command'], DEFAULT_RULES);
            expect(result.decision).toBe('prompt');
            expect(result.matchedRules.length).toBe(0);
        });

        it('should apply most restrictive wins (deny > prompt > allow)', () => {
            const result = evaluateRules(['rm', '-rf', 'dir'], DEFAULT_RULES);
            expect(result.decision).toBe('deny');
        });
    });
});
