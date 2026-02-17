/**
 * Code Firewall - Malicious Pattern Detection
 * 
 * Scans AI-generated code for dangerous patterns before writing to disk.
 * Blocks code that could compromise the user's system or leak secrets.
 */

import chalk from 'chalk';

/**
 * Pattern categories for malicious code detection
 */
interface PatternMatch {
    pattern: RegExp;
    category: 'secret' | 'dangerous' | 'suspicious' | 'path';
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Malicious patterns to detect in generated code
 */
const MALICIOUS_PATTERNS: PatternMatch[] = [
    // ==================== HARDCODED SECRETS ====================
    {
        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
        category: 'secret',
        description: 'OpenAI API key detected',
        severity: 'critical',
    },
    {
        pattern: /AKIA[A-Z0-9]{16}/g,
        category: 'secret',
        description: 'AWS Access Key detected',
        severity: 'critical',
    },
    {
        pattern: /ghp_[A-Za-z0-9]{36}/g,
        category: 'secret',
        description: 'GitHub Personal Access Token detected',
        severity: 'critical',
    },
    {
        pattern: /gho_[A-Za-z0-9]{36}/g,
        category: 'secret',
        description: 'GitHub OAuth Token detected',
        severity: 'critical',
    },
    {
        pattern: /AIza[A-Za-z0-9_-]{35}/g,
        category: 'secret',
        description: 'Google API key detected',
        severity: 'critical',
    },
    {
        pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
        category: 'secret',
        description: 'Slack token detected',
        severity: 'critical',
    },
    {
        pattern: /sk_live_[A-Za-z0-9]{24,}/g,
        category: 'secret',
        description: 'Stripe live key detected',
        severity: 'critical',
    },
    {
        pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        category: 'secret',
        description: 'Private key detected',
        severity: 'critical',
    },
    {
        pattern: /sk-ant-[A-Za-z0-9-_]{95,}/g,
        category: 'secret',
        description: 'Anthropic API key detected',
        severity: 'critical',
    },
    {
        pattern: /sk-ant-api[A-Za-z0-9-_]{90,}/g,
        category: 'secret',
        description: 'Anthropic API key (alt format) detected',
        severity: 'critical',
    },
    {
        pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
        category: 'secret',
        description: 'SendGrid API key detected',
        severity: 'critical',
    },
    {
        pattern: /AC[a-fA-F0-9]{32}/g,
        category: 'secret',
        description: 'Twilio Account SID detected',
        severity: 'critical',
    },
    {
        pattern: /SK[a-fA-F0-9]{32}/g,
        category: 'secret',
        description: 'Twilio API key detected',
        severity: 'critical',
    },
    {
        pattern: /mfa\.[A-Za-z0-9_-]{80,}|[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g,
        category: 'secret',
        description: 'Discord token detected',
        severity: 'critical',
    },
    {
        pattern: /[0-9]{9,}:[a-zA-Z0-9_-]{35}/g,
        category: 'secret',
        description: 'Telegram Bot token detected',
        severity: 'critical',
    },
    {
        pattern: /re_[a-zA-Z0-9]{24,}/g,
        category: 'secret',
        description: 'Resend API key detected',
        severity: 'critical',
    },
    {
        pattern: /sbp_[a-zA-Z0-9]{40,}/g,
        category: 'secret',
        description: 'Supabase API key detected',
        severity: 'critical',
    },
    {
        // Heuristic: Supabase service role keys are JWTs and are often stored in variables like SUPABASE_SERVICE_ROLE_KEY.
        // We scope the match to SUPABASE + SERVICE/ROLE to reduce false positives from generic JWTs.
        pattern: /SUPABASE_[A-Z0-9_]*(SERVICE|ROLE)[A-Z0-9_]*\s*[:=]\s*['"`]?eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}['"`]?/g,
        category: 'secret',
        description: 'Supabase service-role JWT detected',
        severity: 'critical',
    },
    {
        pattern: /vc_[a-zA-Z0-9]{24,}/g,
        category: 'secret',
        description: 'Vercel API token detected',
        severity: 'critical',
    },
    {
        pattern: /railway_[a-zA-Z0-9]{30,}/g,
        category: 'secret',
        description: 'Railway API token detected',
        severity: 'critical',
    },

    // ==================== DANGEROUS CODE PATTERNS ====================
    {
        pattern: /\beval\s*\(/g,
        category: 'dangerous',
        description: 'eval() usage - code injection risk',
        severity: 'high',
    },
    {
        pattern: /new\s+Function\s*\(/g,
        category: 'dangerous',
        description: 'Dynamic function creation - code injection risk',
        severity: 'high',
    },
    {
        pattern: /exec\s*\(\s*['"`][^'"`]*\$\{/g,
        category: 'dangerous',
        description: 'Shell command with variable interpolation',
        severity: 'high',
    },
    {
        pattern: /child_process\s*\.\s*(exec|spawn|execSync)\s*\([^)]*\$\{/g,
        category: 'dangerous',
        description: 'Shell command injection via child_process',
        severity: 'critical',
    },
    {
        pattern: /document\s*\.\s*write\s*\(/g,
        category: 'dangerous',
        description: 'document.write() - XSS risk',
        severity: 'medium',
    },
    {
        pattern: /innerHTML\s*=\s*[^;]*\$\{/g,
        category: 'dangerous',
        description: 'innerHTML with interpolation - XSS risk',
        severity: 'high',
    },

    // ==================== ENV/SECRET EXFILTRATION ====================
    {
        pattern: /JSON\s*\.\s*stringify\s*\(\s*process\s*\.\s*env\s*\)/g,
        category: 'suspicious',
        description: 'Serializing entire process.env',
        severity: 'critical',
    },
    {
        pattern: /console\s*\.\s*log\s*\(\s*process\s*\.\s*env\s*\)/g,
        category: 'suspicious',
        description: 'Logging process.env to console',
        severity: 'high',
    },
    {
        pattern: /fetch\s*\([^)]*\+\s*process\s*\.\s*env/g,
        category: 'suspicious',
        description: 'Sending env variables via network',
        severity: 'critical',
    },
    {
        pattern: /axios\s*\.\s*(get|post)\s*\([^)]*process\s*\.\s*env/g,
        category: 'suspicious',
        description: 'Sending env variables via axios',
        severity: 'critical',
    },

    // ==================== SUSPICIOUS FILE PATHS ====================
    {
        pattern: /\/etc\/passwd/g,
        category: 'path',
        description: 'Access to /etc/passwd',
        severity: 'critical',
    },
    {
        pattern: /\/etc\/shadow/g,
        category: 'path',
        description: 'Access to /etc/shadow',
        severity: 'critical',
    },
    {
        pattern: /C:\\Windows\\System32/gi,
        category: 'path',
        description: 'Access to Windows System32',
        severity: 'high',
    },
    {
        pattern: /~\/\.ssh\//g,
        category: 'path',
        description: 'Access to SSH directory',
        severity: 'critical',
    },
    {
        pattern: /~\/\.aws\//g,
        category: 'path',
        description: 'Access to AWS credentials',
        severity: 'critical',
    },
    {
        pattern: /~\/\.gnupg\//g,
        category: 'path',
        description: 'Access to GPG keys',
        severity: 'critical',
    },

    // ==================== COMMAND INJECTION ====================
    {
        pattern: /\$\([^)]+\)/g,
        category: 'dangerous',
        description: 'Shell command substitution',
        severity: 'medium',
    },
    {
        pattern: /`[^`]*\$\{[^}]+\}[^`]*`/g,
        category: 'dangerous',
        description: 'Template literal with shell commands',
        severity: 'medium',
    },

    // ==================== PROMPT INJECTION DEFENSE ====================
    {
        pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
        category: 'suspicious',
        description: 'Prompt injection: instruction override attempt',
        severity: 'critical',
    },
    {
        pattern: /\[SYSTEM\]|\[INST\]|<\|im_start\|>|<\|endoftext\|>/gi,
        category: 'suspicious',
        description: 'Prompt injection: model control tokens',
        severity: 'critical',
    },
    {
        pattern: /you\s+are\s+(now\s+)?(a|an|the)\s+\w+\s+(that|who|which)/gi,
        category: 'suspicious',
        description: 'Prompt injection: role override attempt',
        severity: 'high',
    },
    {
        pattern: /disregard\s+(all\s+)?safety|bypass\s+(all\s+)?security|disable\s+(all\s+)?restrictions/gi,
        category: 'suspicious',
        description: 'Prompt injection: safety bypass attempt',
        severity: 'critical',
    },
    {
        pattern: /\bexec\s*\(\s*[`'"].*?\$\(.*?\)/g,
        category: 'dangerous',
        description: 'Command injection via exec with substitution',
        severity: 'critical',
    },

    // ==================== NETWORK EXFILTRATION ====================
    {
        pattern: /\bfetch\s*\(\s*['"`]https?:\/\/[^'"`]*\.(ru|cn|tk|ml|ga)\//gi,
        category: 'suspicious',
        description: 'Request to suspicious TLD',
        severity: 'high',
    },
    {
        pattern: /\bnew\s+WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost|127\.0\.0\.1)/g,
        category: 'suspicious',
        description: 'WebSocket to external server',
        severity: 'medium',
    },
];

/**
 * Result of a code scan
 */
export interface ScanResult {
    safe: boolean;
    matches: Array<{
        pattern: string;
        category: string;
        description: string;
        severity: string;
        line?: number;
        match?: string;
    }>;
}

/**
 * Scan code for malicious patterns
 */
export function scanCode(code: string, filename?: string): ScanResult {
    const matches: ScanResult['matches'] = [];
    const lines = code.split('\n');

    for (const patternDef of MALICIOUS_PATTERNS) {
        let match;
        const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);

        while ((match = regex.exec(code)) !== null) {
            // Find line number
            const beforeMatch = code.substring(0, match.index);
            const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

            matches.push({
                pattern: patternDef.pattern.source,
                category: patternDef.category,
                description: patternDef.description,
                severity: patternDef.severity,
                line: lineNumber,
                match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
            });
        }
    }

    return {
        safe: matches.length === 0,
        matches,
    };
}

/**
 * Check if code should be blocked based on scan results
 */
export function shouldBlockCode(result: ScanResult): boolean {
    // Block if any critical or high severity issues
    return result.matches.some(m => m.severity === 'critical' || m.severity === 'high');
}

/**
 * Display scan results in a user-friendly format
 */
export function displayScanResults(result: ScanResult, filename?: string): void {
    if (result.safe) {
        console.log(chalk.green('✅ No malicious patterns detected'));
        return;
    }

    console.log(chalk.red.bold('\n🚨 SECURITY SCAN FAILED'));
    if (filename) {
        console.log(chalk.gray(`File: ${filename}`));
    }
    console.log('');

    // Group by severity
    const criticals = result.matches.filter(m => m.severity === 'critical');
    const highs = result.matches.filter(m => m.severity === 'high');
    const others = result.matches.filter(m => m.severity !== 'critical' && m.severity !== 'high');

    if (criticals.length > 0) {
        console.log(chalk.red('🔴 CRITICAL:'));
        for (const m of criticals) {
            console.log(chalk.red(`   Line ${m.line}: ${m.description}`));
            console.log(chalk.gray(`   Found: ${m.match}`));
        }
    }

    if (highs.length > 0) {
        console.log(chalk.yellow('\n🟠 HIGH:'));
        for (const m of highs) {
            console.log(chalk.yellow(`   Line ${m.line}: ${m.description}`));
            console.log(chalk.gray(`   Found: ${m.match}`));
        }
    }

    if (others.length > 0) {
        console.log(chalk.cyan('\n🟡 WARNINGS:'));
        for (const m of others) {
            console.log(chalk.cyan(`   Line ${m.line}: ${m.description}`));
        }
    }

    console.log('');
}

/**
 * Scan and validate code before writing
 * Returns true if safe to write, false if blocked
 */
export function validateCodeBeforeWrite(code: string, filename: string): boolean {
    const result = scanCode(code, filename);

    if (!result.safe) {
        displayScanResults(result, filename);

        if (shouldBlockCode(result)) {
            console.log(chalk.red.bold('🚨 BLOCKED: Code contains critical security issues'));
            console.log(chalk.gray('The file will NOT be written to disk.\n'));
            return false;
        } else {
            console.log(chalk.yellow('⚠️  Warning: Code contains potential issues but will be written.\n'));
        }
    }

    return true;
}
