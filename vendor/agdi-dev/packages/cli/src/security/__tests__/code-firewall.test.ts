/**
 * Code Firewall Unit Tests (CLI)
 * 
 * Tests the malicious pattern detection for AI-generated code.
 */

import { describe, it, expect } from 'vitest';
import { scanCode, shouldBlockCode, type ScanResult } from '../code-firewall';

describe('Code Firewall', () => {
    describe('scanCode', () => {
        it('should detect OpenAI API keys', () => {
            const code = `const key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches.length).toBeGreaterThan(0);
            expect(result.matches[0].category).toBe('secret');
            expect(result.matches[0].severity).toBe('critical');
        });

        it('should detect AWS Access Keys', () => {
            const code = `aws_key = "AKIAIOSFODNN7EXAMPLE"`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('AWS');
        });

        it('should detect GitHub tokens', () => {
            const code = `token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('GitHub');
        });

        it('should detect Anthropic API keys', () => {
            const code = `const apiKey = "sk-ant-${'x'.repeat(95)}"`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Anthropic');
            expect(result.matches[0].severity).toBe('critical');
        });

        it('should detect SendGrid API keys', () => {
            const code = `const key = "SG.${'x'.repeat(22)}.${'y'.repeat(43)}"`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('SendGrid');
        });

        it('should detect Twilio credentials', () => {
            const code = `const sid = "AC${'a'.repeat(32)}"; const key = "SK${'b'.repeat(32)}";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Twilio');
        });

        it('should detect Discord tokens', () => {
            const code = `const token = "${'x'.repeat(24)}.${'y'.repeat(6)}.${'z'.repeat(27)}"`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Discord');
        });

        it('should detect Telegram Bot tokens', () => {
            const code = `const botToken = "123456789:AbCdEfGhIjKlMnOpQrStUvWxYz123456789";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Telegram');
        });

        it('should detect Resend API keys', () => {
            const code = `const resendKey = "re_123456789abcdefghijklmnopqrstuvwxyz";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Resend');
        });

        it('should detect Supabase API keys', () => {
            const code = `const key = "sbp_${'x'.repeat(40)}";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Supabase');
        });

        it('should detect Supabase service-role JWTs (scoped)', () => {
            const jwt = `eyJ${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`;
            const code = `const SUPABASE_SERVICE_ROLE_KEY = "${jwt}";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches.some(m => m.description.includes('service-role'))).toBe(true);
        });

        it('should detect Vercel API tokens', () => {
            const code = `const token = "vc_${'x'.repeat(24)}";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Vercel');
        });

        it('should detect Railway API tokens', () => {
            const code = `const token = "railway_${'x'.repeat(30)}";`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('Railway');
        });

        it('should detect eval() usage', () => {
            const code = `eval(userInput)`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].category).toBe('dangerous');
        });

        it('should detect document.write()', () => {
            const code = `document.write("<script>alert(1)</script>")`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].description).toContain('XSS');
        });

        it('should detect process.env serialization', () => {
            const code = `const env = JSON.stringify(process.env);`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].category).toBe('suspicious');
        });

        it('should detect SSH directory access', () => {
            const code = `fs.readFile("~/.ssh/id_rsa")`;
            const result = scanCode(code);

            expect(result.safe).toBe(false);
            expect(result.matches[0].category).toBe('path');
        });

        it('should allow safe code', () => {
            const code = `
                import React from 'react';
                
                function App() {
                    return <div>Hello World</div>;
                }
                
                export default App;
            `;
            const result = scanCode(code);

            expect(result.safe).toBe(true);
            expect(result.matches.length).toBe(0);
        });

        it('should track line numbers', () => {
            const code = `line1\nline2\neval(bad)\nline4`;
            const result = scanCode(code);

            expect(result.matches[0].line).toBe(3);
        });
    });

    describe('shouldBlockCode', () => {
        it('should block critical severity issues', () => {
            const result: ScanResult = {
                safe: false,
                matches: [{
                    pattern: 'test',
                    category: 'secret',
                    description: 'API key',
                    severity: 'critical',
                }]
            };

            expect(shouldBlockCode(result)).toBe(true);
        });

        it('should block high severity issues', () => {
            const result: ScanResult = {
                safe: false,
                matches: [{
                    pattern: 'test',
                    category: 'dangerous',
                    description: 'eval',
                    severity: 'high',
                }]
            };

            expect(shouldBlockCode(result)).toBe(true);
        });

        it('should not block medium/low severity issues', () => {
            const result: ScanResult = {
                safe: false,
                matches: [{
                    pattern: 'test',
                    category: 'suspicious',
                    description: 'warning',
                    severity: 'medium',
                }]
            };

            expect(shouldBlockCode(result)).toBe(false);
        });

        it('should not block safe code', () => {
            const result: ScanResult = {
                safe: true,
                matches: []
            };

            expect(shouldBlockCode(result)).toBe(false);
        });
    });
});
