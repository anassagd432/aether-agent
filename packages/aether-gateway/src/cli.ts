#!/usr/bin/env node
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const program = new Command();

function openclawBinArgs(args: string[]) {
  // Use local vendored OpenClaw CLI if present (repo checkout), otherwise fall back to global `openclaw`.
  const vendored = join(process.cwd(), 'vendor', 'openclaw', 'openclaw.mjs');
  if (existsSync(vendored)) {
    return { cmd: process.execPath, args: [vendored, ...args] };
  }
  return { cmd: 'openclaw', args };
}

function runOpenClaw(args: string[]) {
  const { cmd, args: argv } = openclawBinArgs(args);
  const r = spawnSync(cmd, argv, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

program
  .name('aether')
  .description('Aether Gateway CLI (wrapper around OpenClaw)')
  .version('0.0.1');

program
  .command('init')
  .description('Create a starter OpenClaw config file in ~/.openclaw/config.yml (does not overwrite)')
  .option('--owner <e164>', 'Owner WhatsApp number in E.164 (e.g. +34616913348)')
  .action(async (opts: { owner?: string }) => {
    const dir = join(os.homedir(), '.openclaw');
    const dst = join(dir, 'config.yml');
    const src = join(process.cwd(), 'packages', 'aether-gateway', 'templates', 'openclaw.config.example.yml');

    mkdirSync(dir, { recursive: true });
    if (existsSync(dst)) {
      console.error(`Refusing to overwrite existing config: ${dst}`);
      process.exit(2);
    }

    // Write template with placeholder replacement.
    const template = await import('node:fs/promises').then((m) => m.readFile(src, 'utf8'));
    const owner = (opts.owner || '').trim();
    const out = template.replaceAll('__AETHER_OWNER__', owner || '+34616913348');
    await import('node:fs/promises').then((m) => m.writeFile(dst, out, 'utf8'));

    console.log(`Wrote: ${dst}`);
    console.log('Next: run: aether whatsapp:login');
  });

program
  .command('start')
  .description('Start the gateway daemon (OpenClaw)')
  .action(() => runOpenClaw(['gateway', 'start']));

program
  .command('stop')
  .description('Stop the gateway daemon (OpenClaw)')
  .action(() => runOpenClaw(['gateway', 'stop']));

program
  .command('restart')
  .description('Restart the gateway daemon (OpenClaw)')
  .action(() => runOpenClaw(['gateway', 'restart']));

program
  .command('status')
  .description('Show gateway status (OpenClaw)')
  .action(() => runOpenClaw(['gateway', 'status']));

program
  .command('whatsapp:login')
  .description('Start WhatsApp QR login flow (OpenClaw)')
  .action(() => runOpenClaw(['whatsapp', 'login']));

program.parse();
