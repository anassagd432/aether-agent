/**
 * Multi-Agent Orchestrator
 * 
 * Coordinates multiple specialized agents for better code generation:
 * Planner → Coder → Reviewer → Output
 */

import { scanCode, displayScanResults, shouldBlockCode } from '../security/code-firewall.js';
import type { ILLMProvider, LLMResponse } from '../core/types/index.js';
import chalk from 'chalk';

// ==================== TYPES ====================

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'executor' | 'security';

export interface AgentMessage {
    role: AgentRole;
    content: string;
    timestamp: string;
}

export interface AgentContext {
    userRequest: string;
    projectContext?: string;
    codebaseContext?: string;
    previousMessages: AgentMessage[];
}

export interface AgentResult {
    success: boolean;
    output: string;
    messages: AgentMessage[];
    iterations: number;
}

// ==================== AGENT PROMPTS ====================

const PLANNER_PROMPT = `You are the PLANNER agent. Your job is to analyze the user's request and create a detailed implementation plan.

Given the user request and project context:
1. Break down the task into clear steps
2. Identify files that need to be created or modified
3. List any dependencies or prerequisites
4. Estimate complexity and potential issues

Output format:
<plan>
## Overview
[Brief description of what will be built]

## Steps
1. [Step 1]
2. [Step 2]
...

## Files
- [file1.ts]: [purpose]
- [file2.ts]: [purpose]

## Dependencies
- [any npm packages needed]

## Complexity
[Low/Medium/High] - [reason]
</plan>`;

const CODER_PROMPT = `You are the CODER agent. Your job is to implement code based on the plan.

Given the plan from the Planner agent:
1. Write clean, production-ready code
2. Include proper TypeScript types
3. Add helpful comments for complex logic
4. Follow best practices for the language/framework

Output your code in proper code blocks with file paths:
\`\`\`typescript
// filepath: src/example.ts
// Your code here
\`\`\`

Generate complete, working code - no placeholders or TODOs.`;

const REVIEWER_PROMPT = `You are the REVIEWER agent. Your job is to review code for quality and issues.

Review the code from the Coder agent for:
1. Correctness - Does it implement the requirements?
2. Security - Any vulnerabilities or unsafe patterns?
3. Performance - Any obvious inefficiencies?
4. Style - Does it follow conventions?
5. Completeness - Missing error handling, edge cases?

Output format:
<review>
## Status: [APPROVED / NEEDS_CHANGES]

## Issues Found
- [issue1]: [severity] - [description]
- [issue2]: [severity] - [description]

## Suggestions
- [suggestion1]
- [suggestion2]

## Verdict
[Your final assessment - if APPROVED, code can proceed]
</review>

If the code needs critical fixes, clearly state what needs to change.`;

// ==================== AGENT EXECUTION ====================

/**
 * Run a single agent with its prompt
 */
async function runAgent(
    role: AgentRole,
    systemPrompt: string,
    userPrompt: string,
    llm: ILLMProvider
): Promise<AgentMessage> {
    const response = await llm.generate(userPrompt, systemPrompt);

    return {
        role,
        content: response.text,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Full multi-agent pipeline
 */
export async function runMultiAgentPipeline(
    userRequest: string,
    llm: ILLMProvider,
    context?: {
        projectContext?: string;
        codebaseContext?: string;
    }
): Promise<AgentResult> {
    const messages: AgentMessage[] = [];
    const maxIterations = 3;
    let iterations = 0;

    console.log(chalk.cyan('\n🤖 Multi-Agent Pipeline Started\n'));

    // Build initial context
    let contextStr = '';
    if (context?.projectContext) {
        contextStr += `\n[Project Context]\n${context.projectContext}\n`;
    }
    if (context?.codebaseContext) {
        contextStr += `\n[Codebase Context]\n${context.codebaseContext}\n`;
    }

    // Phase 1: Planning
    console.log(chalk.yellow('📋 Phase 1: Planning...'));
    const plannerPrompt = `User Request: ${userRequest}\n${contextStr}\n\nCreate a detailed implementation plan.`;
    const planMessage = await runAgent('planner', PLANNER_PROMPT, plannerPrompt, llm);
    messages.push(planMessage);
    console.log(chalk.green('  ✓ Plan created'));

    // Phase 2: Coding
    console.log(chalk.yellow('💻 Phase 2: Coding...'));
    const coderPrompt = `User Request: ${userRequest}\n\nPlan from Planner:\n${planMessage.content}\n\nImplement the code according to this plan.`;
    let codeMessage = await runAgent('coder', CODER_PROMPT, coderPrompt, llm);
    messages.push(codeMessage);
    console.log(chalk.green('  ✓ Code generated'));

    // Phase 2.5: Automated Security Scan
    console.log(chalk.yellow('🛡️  Phase 2.5: Security Scan...'));

    const maxSecurityFixPasses = 2;
    let scanResult = scanCode(codeMessage.content);

    if (!scanResult.safe) {
        console.log(chalk.red('  🚨 Security issues detected!'));
        displayScanResults(scanResult);

        // Only attempt auto-fix if the firewall would block (critical/high)
        if (shouldBlockCode(scanResult)) {
            for (let pass = 1; pass <= maxSecurityFixPasses; pass++) {
                console.log(chalk.yellow(`  🔄 Auto-fixing security issues (pass ${pass}/${maxSecurityFixPasses})...`));

                const securityFixPrompt = `User Request: ${userRequest}\n\nOriginal Code:\n${codeMessage.content}\n\nSECURITY ISSUES DETECTED:\n${JSON.stringify(scanResult.matches, null, 2)}\n\nFix these security issues. Remove any hardcoded secrets, unsafe exfiltration, and dangerous patterns. Return ONLY the corrected code with file paths in code blocks.`;

                codeMessage = await runAgent('coder', CODER_PROMPT, securityFixPrompt, llm);
                messages.push({
                    role: 'security',
                    content: `Security auto-fix pass ${pass}: ${JSON.stringify(scanResult.matches.map(m => m.description))}`,
                    timestamp: new Date().toISOString(),
                });
                messages.push(codeMessage);

                scanResult = scanCode(codeMessage.content);
                if (scanResult.safe) {
                    console.log(chalk.green('  ✅ Security issues resolved.'));
                    break;
                }

                console.log(chalk.red('  ⚠ Security issues still present after auto-fix pass.'));
                displayScanResults(scanResult);
            }

            if (!scanResult.safe) {
                console.log(chalk.red.bold('  ❌ BLOCKED: Security issues persist after auto-fix attempts.'));
                return {
                    success: false,
                    output: codeMessage.content,
                    messages,
                    iterations,
                };
            }
        } else {
            console.log(chalk.yellow('  ⚠ Non-blocking warnings detected. Continuing.'));
        }
    } else {
        console.log(chalk.green('  ✅ No security issues found.'));
    }

    // Phase 3: Review Loop
    while (iterations < maxIterations) {
        iterations++;
        console.log(chalk.yellow(`🔍 Phase 3: Review (iteration ${iterations})...`));

        const reviewerPrompt = `User Request: ${userRequest}\n\nCode to Review:\n${codeMessage.content}\n\nReview this code for quality, security, and completeness.`;
        const reviewMessage = await runAgent('reviewer', REVIEWER_PROMPT, reviewerPrompt, llm);
        messages.push(reviewMessage);

        // Check if approved
        if (reviewMessage.content.includes('Status: APPROVED') ||
            reviewMessage.content.includes('APPROVED')) {
            console.log(chalk.green('  ✓ Code approved!'));
            break;
        }

        console.log(chalk.yellow('  ⚠ Changes requested'));

        // If not approved and we have iterations left, revise
        if (iterations < maxIterations) {
            console.log(chalk.yellow('  🔄 Revising code...'));
            const revisionPrompt = `User Request: ${userRequest}\n\nOriginal Code:\n${codeMessage.content}\n\nReview Feedback:\n${reviewMessage.content}\n\nRevise the code to address the feedback.`;
            codeMessage = await runAgent('coder', CODER_PROMPT, revisionPrompt, llm);
            messages.push(codeMessage);
        }
    }

    console.log(chalk.cyan('\n✅ Multi-Agent Pipeline Complete\n'));

    // Return the final code
    const finalCode = messages.filter(m => m.role === 'coder').pop();

    return {
        success: true,
        output: finalCode?.content || '',
        messages,
        iterations,
    };
}

// ==================== SINGLE AGENT MODE ====================

/**
 * Get agent by role
 */
export function getAgentPrompt(role: AgentRole): string {
    switch (role) {
        case 'planner': return PLANNER_PROMPT;
        case 'coder': return CODER_PROMPT;
        case 'reviewer': return REVIEWER_PROMPT;
        default: return '';
    }
}

/**
 * Run a single specialized agent
 */
export async function runSingleAgent(
    role: AgentRole,
    input: string,
    llm: ILLMProvider
): Promise<string> {
    const prompt = getAgentPrompt(role);
    const response = await llm.generate(input, prompt);
    return response.text;
}
