/**
 * Run Command - Execute generated project
 * Starts the dev server for the current or specified directory
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';

export async function runProject(targetDir?: string): Promise<void> {
    const dir = targetDir || process.cwd();
    const absoluteDir = path.resolve(dir);

    console.log(chalk.cyan.bold('\n🚀 Agdi Run\n'));

    // Check if directory exists
    if (!fs.existsSync(absoluteDir)) {
        console.log(chalk.red(`❌ Directory not found: ${absoluteDir}`));
        console.log(chalk.gray('Create a project first with: agdi init'));
        return;
    }

    // Check for package.json
    const packageJsonPath = path.join(absoluteDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.log(chalk.red(`❌ No package.json found in: ${absoluteDir}`));
        console.log(chalk.gray('This doesn\'t appear to be a Node.js project.'));
        return;
    }

    // Read package.json to get scripts
    const packageJson = fs.readJsonSync(packageJsonPath);
    const scripts = packageJson.scripts || {};

    // Determine the run command
    let runScript = 'dev';
    if (!scripts.dev && scripts.start) {
        runScript = 'start';
    } else if (!scripts.dev && !scripts.start) {
        console.log(chalk.red('❌ No "dev" or "start" script found in package.json'));
        console.log(chalk.gray('Add a script like: "dev": "vite" or "start": "node index.js"'));
        return;
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(absoluteDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log(chalk.yellow('📦 Installing dependencies...\n'));

        const installSpinner = ora('Running npm install...').start();

        try {
            await new Promise<void>((resolve, reject) => {
                const install = spawn('npm', ['install'], {
                    cwd: absoluteDir,
                    stdio: 'inherit',
                    shell: true,
                });

                install.on('close', (code) => {
                    if (code === 0) {
                        installSpinner.succeed('Dependencies installed!');
                        resolve();
                    } else {
                        installSpinner.fail('npm install failed');
                        reject(new Error(`npm install exited with code ${code}`));
                    }
                });

                install.on('error', reject);
            });
        } catch (error) {
            console.log(chalk.red(`\n${(error as Error).message}`));
            return;
        }

        console.log('');
    }

    // Run the dev server
    console.log(chalk.green(`▶ Running: npm run ${runScript}`));
    console.log(chalk.gray(`  Directory: ${absoluteDir}\n`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    const child = spawn('npm', ['run', runScript], {
        cwd: absoluteDir,
        stdio: 'inherit',
        shell: true,
    });

    // Handle process termination
    process.on('SIGINT', () => {
        child.kill('SIGINT');
        console.log(chalk.gray('\n\n👋 Server stopped.'));
        process.exit(0);
    });

    child.on('close', (code) => {
        if (code !== 0) {
            console.log(chalk.red(`\n❌ Process exited with code ${code}`));
        }
        process.exit(code || 0);
    });
}
