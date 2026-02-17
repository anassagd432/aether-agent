import { describe, it, expect, vi } from 'vitest';
import { login, showStatus } from '../auth';
import { runWizard } from '../wizard';
import { runSquadCommand } from '../squad';
import { runProject } from '../run';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CLI commands smoke', () => {
  it('exports command handlers', () => {
    expect(typeof login).toBe('function');
    expect(typeof showStatus).toBe('function');
    expect(typeof runWizard).toBe('function');
    expect(typeof runSquadCommand).toBe('function');
    expect(typeof runProject).toBe('function');
  });

  it('runProject returns gracefully for missing dirs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runProject(path.join(os.tmpdir(), 'agdi-missing-dir'));
    logSpy.mockRestore();
  });

  it('runProject returns gracefully without package.json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agdi-test-'));
    await runProject(tempDir);
    logSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
