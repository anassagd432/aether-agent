/**
 * Argv Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    parseArgv,
    isWindowsFlag,
    isLikelyPath,
    extractPaths,
    extractDomains,
    extractPorts,
} from '../argv-parser';

describe('Argv Parser', () => {
    describe('parseArgv', () => {
        it('should tokenize simple command', () => {
            const result = parseArgv('ls -la');
            expect(result.argv).toEqual(['ls', '-la']);
            expect(result.command).toBe('ls');
            expect(result.args).toEqual(['-la']);
        });

        it('should handle quoted strings', () => {
            const result = parseArgv('echo "hello world"');
            expect(result.argv).toEqual(['echo', 'hello world']);
        });

        it('should handle single quotes', () => {
            const result = parseArgv("grep 'pattern with spaces' file.txt");
            expect(result.argv).toEqual(['grep', 'pattern with spaces', 'file.txt']);
        });

        it('should handle escaped characters', () => {
            const result = parseArgv('echo hello\\ world');
            expect(result.argv).toEqual(['echo', 'hello world']);
        });

        it('should handle empty input', () => {
            const result = parseArgv('');
            expect(result.argv).toEqual([]);
            expect(result.command).toBe('');
        });

        it('should handle multiple spaces', () => {
            const result = parseArgv('ls    -la    /tmp');
            expect(result.argv).toEqual(['ls', '-la', '/tmp']);
        });
    });

    describe('isWindowsFlag', () => {
        it('should detect single letter Windows flags', () => {
            expect(isWindowsFlag('/i')).toBe(true);
            expect(isWindowsFlag('/s')).toBe(true);
            expect(isWindowsFlag('/r')).toBe(true);
            expect(isWindowsFlag('/I')).toBe(true);
        });

        it('should detect numbered flags', () => {
            expect(isWindowsFlag('/1')).toBe(true);
            expect(isWindowsFlag('/42')).toBe(true);
        });

        it('should detect common multi-char flags', () => {
            expect(isWindowsFlag('/help')).toBe(true);
            expect(isWindowsFlag('/version')).toBe(true);
            expect(isWindowsFlag('/quiet')).toBe(true);
        });

        it('should NOT detect file paths as flags', () => {
            expect(isWindowsFlag('/etc/passwd')).toBe(false);
            expect(isWindowsFlag('/home/user')).toBe(false);
            expect(isWindowsFlag('/tmp/file.txt')).toBe(false);
        });

        it('should detect findstr flags', () => {
            expect(isWindowsFlag('/c', 'findstr')).toBe(true);
            expect(isWindowsFlag('/g', 'findstr')).toBe(true);
        });
    });

    describe('isLikelyPath', () => {
        it('should detect Unix absolute paths', () => {
            expect(isLikelyPath('/etc/passwd')).toBe(true);
            expect(isLikelyPath('/home/user/file.txt')).toBe(true);
        });

        it('should detect Windows absolute paths', () => {
            expect(isLikelyPath('C:\\Users\\test')).toBe(true);
            expect(isLikelyPath('D:/Documents/file.txt')).toBe(true);
        });

        it('should detect relative paths', () => {
            expect(isLikelyPath('./file.txt')).toBe(true);
            expect(isLikelyPath('../parent/file.txt')).toBe(true);
            expect(isLikelyPath('src/index.ts')).toBe(true);
        });

        it('should detect file extensions', () => {
            expect(isLikelyPath('file.txt')).toBe(true);
            expect(isLikelyPath('script.js')).toBe(true);
        });

        it('should NOT detect Windows flags as paths', () => {
            expect(isLikelyPath('/i', 'findstr')).toBe(false);
            expect(isLikelyPath('/s', 'dir')).toBe(false);
        });

        it('should NOT detect Unix flags as paths', () => {
            expect(isLikelyPath('-la')).toBe(false);
            expect(isLikelyPath('--help')).toBe(false);
        });
    });

    describe('extractDomains', () => {
        it('should extract domains from URLs', () => {
            const domains = extractDomains('curl https://api.github.com/users');
            expect(domains).toContain('api.github.com');
        });

        it('should extract multiple domains', () => {
            const domains = extractDomains('curl https://a.com && curl https://b.com');
            expect(domains).toContain('a.com');
            expect(domains).toContain('b.com');
        });

        it('should add default domains for npm', () => {
            const domains = extractDomains('npm install lodash');
            expect(domains).toContain('registry.npmjs.org');
        });

        it('should handle commands without network', () => {
            const domains = extractDomains('ls -la');
            expect(domains).toEqual([]);
        });
    });

    describe('extractPaths', () => {
        it('should detect simple output redirection', () => {
            const paths = extractPaths(parseArgv('echo hi > out.txt'));
            expect(paths).toEqual([{ path: 'out.txt', operation: 'write', position: -1 }]);
        });

        it('should detect appended output redirection with quotes', () => {
            const paths = extractPaths(parseArgv('echo hi >> "out file.txt"'));
            expect(paths).toEqual([{ path: 'out file.txt', operation: 'write', position: -1 }]);
        });

        it('should detect redirection without whitespace', () => {
            const paths = extractPaths(parseArgv('echo hi>out.txt'));
            expect(paths).toEqual([{ path: 'out.txt', operation: 'write', position: -1 }]);
        });

        it('should ignore file-descriptor redirects', () => {
            const paths = extractPaths(parseArgv('echo hi 2>&1'));
            expect(paths).toEqual([]);
        });

        it('should ignore missing redirection targets', () => {
            const paths = extractPaths(parseArgv('echo hi >'));
            expect(paths).toEqual([]);
        });
    });

    describe('extractPorts', () => {
        it('should extract port from -p flag', () => {
            const ports = extractPorts('docker run -p 3000:3000 app');
            expect(ports).toContain(3000);
        });

        it('should extract port from --port', () => {
            const ports = extractPorts('npm run dev --port=8080');
            expect(ports).toContain(8080);
        });

        it('should extract port from URL', () => {
            const ports = extractPorts('curl http://localhost:4000/api');
            expect(ports).toContain(4000);
        });

        it('should extract PORT env', () => {
            const ports = extractPorts('PORT=5000 node server.js');
            expect(ports).toContain(5000);
        });
    });
});
