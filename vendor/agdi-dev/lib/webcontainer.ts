import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import { GeneratedFile } from './agdi-architect';

/**
 * WebContainer Service - Singleton Pattern
 * Manages the lifecycle of a WebContainer instance for running React apps in-browser
 */
export class WebContainerService {
    private static instance: WebContainer | null = null;
    private static bootPromise: Promise<WebContainer> | null = null;

    /**
     * Boot the WebContainer instance (singleton)
     * Returns the same instance on subsequent calls
     */
    static async boot(): Promise<WebContainer> {
        if (typeof window === 'undefined') {
            throw new Error('WebContainer can only run in a browser environment');
        }

        if (this.instance) {
            return this.instance;
        }

        // Prevent multiple boot calls
        if (this.bootPromise) {
            return this.bootPromise;
        }

        this.bootPromise = WebContainer.boot();
        this.instance = await this.bootPromise;
        return this.instance;
    }

    /**
     * Convert flat GeneratedFile[] to WebContainer FileSystemTree format
     */
    static buildFileSystemTree(files: GeneratedFile[]): FileSystemTree {
        const tree: FileSystemTree = {};

        files.forEach((file) => {
            const normalizedPath = file.path.replace(/^\/+/, '');
            const parts = normalizedPath.split('/');
            let currentLevel: any = tree;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;

                if (isFile) {
                    currentLevel[part] = {
                        file: {
                            contents: file.content,
                        },
                    };
                } else {
                    if (!currentLevel[part]) {
                        currentLevel[part] = {
                            directory: {},
                        };
                    }
                    currentLevel = currentLevel[part].directory;
                }
            });
        });

        return tree;
    }

    /**
     * Generate package.json content with injected dependencies
     */
    static generatePackageJson(dependencies: string[], includeTesting = true): string {
        const uniqueDeps = Array.from(new Set(dependencies.filter(Boolean)));
        const packageJson: Record<string, unknown> = {
            name: 'agdi-generated-app',
            type: 'module',
            scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview',
                ...(includeTesting ? {
                    test: 'vitest run',
                    'test:watch': 'vitest',
                } : {}),
            },
            dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                // Add user-requested dependencies
                ...uniqueDeps.reduce((acc, dep) => {
                    // Default to latest version for simplicity
                    acc[dep] = 'latest';
                    return acc;
                }, {} as Record<string, string>),
            },
            devDependencies: {
                '@types/react': '^18.2.0',
                '@types/react-dom': '^18.2.0',
                '@vitejs/plugin-react': '^4.2.0',
                typescript: '^5.3.0',
                vite: '^5.0.0',
                autoprefixer: '^10.4.16',
                postcss: '^8.4.32',
                tailwindcss: '^3.4.0',
                // TDD Dependencies
                ...(includeTesting ? {
                    'vitest': '^1.0.0',
                    'jsdom': '^24.0.0',
                    '@testing-library/react': '^14.0.0',
                    '@testing-library/jest-dom': '^6.0.0',
                } : {}),
            },
        };

        return JSON.stringify(packageJson, null, 2);
    }

    /**
     * Generate vite.config.js content
     */
    static generateViteConfig(): string {
        return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`;
    }

    /**
     * Generate tailwind.config.js content
     */
    static generateTailwindConfig(): string {
        return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
    }

    /**
     * Generate postcss.config.js content
     */
    static generatePostcssConfig(): string {
        return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
    }

    /**
     * Generate index.html content
     */
    static generateIndexHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agdi Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    }

    /**
     * Generate main.tsx entry point
     */
    static generateMainTsx(): string {
        return `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    }

    /**
     * Mount files to the WebContainer
     */
    static async mountFiles(
        files: GeneratedFile[],
        dependencies: string[],
        onLog?: (log: string) => void
    ): Promise<void> {
        const container = await this.boot();
        onLog?.('Building file system tree...');

        // Build the file system tree
        const fileTree = this.buildFileSystemTree(files);

        // Add essential config files
        fileTree['package.json'] = {
            file: {
                contents: this.generatePackageJson(dependencies),
            },
        };

        fileTree['vite.config.js'] = {
            file: {
                contents: this.generateViteConfig(),
            },
        };

        fileTree['tailwind.config.js'] = {
            file: {
                contents: this.generateTailwindConfig(),
            },
        };

        fileTree['postcss.config.js'] = {
            file: {
                contents: this.generatePostcssConfig(),
            },
        };

        fileTree['index.html'] = {
            file: {
                contents: this.generateIndexHtml(),
            },
        };

        // Add main.tsx if not already present
        if (!files.find((f) => f.path.includes('main.tsx'))) {
            if (!fileTree['src']) {
                fileTree['src'] = { directory: {} };
            }
            (fileTree['src'] as any).directory['main.tsx'] = {
                file: {
                    contents: this.generateMainTsx(),
                },
            };
        }

        onLog?.('Mounting files to WebContainer...');
        await container.mount(fileTree);
        onLog?.('✓ Files mounted successfully');
    }

    /**
     * Install dependencies via npm install
     */
    static async installDependencies(
        onLog?: (log: string) => void
    ): Promise<number> {
        const container = await this.boot();
        onLog?.('Running npm install...');

        const installProcess = await container.spawn('npm', ['install']);

        installProcess.output.pipeTo(
            new WritableStream({
                write(data) {
                    onLog?.(data);
                },
            })
        );

        const exitCode = await installProcess.exit;

        if (exitCode === 0) {
            onLog?.('✓ Dependencies installed successfully');
        } else {
            onLog?.(`⚠ npm install exited with code ${exitCode}`);
        }

        return exitCode;
    }

    /**
     * Start the dev server and return the preview URL
     */
    static async startDevServer(
        onLog?: (log: string) => void
    ): Promise<string> {
        const container = await this.boot();
        onLog?.('Starting dev server...');

        const devProcess = await container.spawn('npm', ['run', 'dev']);

        devProcess.output.pipeTo(
            new WritableStream({
                write(data) {
                    onLog?.(data);
                },
            })
        );

        // Wait for server-ready event
        const url = await new Promise<string>((resolve) => {
            container.on('server-ready', (port, url) => {
                onLog?.(`✓ Server ready at ${url}`);
                resolve(url);
            });
        });

        return url;
    }

    /**
     * Reset the WebContainer instance (useful for cleanup)
     */
    static async teardown(): Promise<void> {
        if (this.instance) {
            await this.instance.teardown();
            this.instance = null;
            this.bootPromise = null;
        }
    }
}

// =============================================================================
// CONVENIENCE FS/PROCESS HELPERS
// =============================================================================

export async function readFile(filePath: string): Promise<string> {
    const container = await WebContainerService.boot();
    const data = await container.fs.readFile(filePath, 'utf-8');
    if (typeof data === 'string') return data;
    return new TextDecoder().decode(data as Uint8Array);
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    const container = await WebContainerService.boot();
    await container.fs.writeFile(filePath, content);
}

export async function listFiles(dirPath: string): Promise<string[]> {
    const container = await WebContainerService.boot();
    const entries = await container.fs.readdir(dirPath);
    return entries.map(entry => String(entry));
}

export async function runCommand(command: string, opts: { timeout?: number } = {}): Promise<string> {
    const container = await WebContainerService.boot();
    const [cmd, ...args] = command.split(' ').filter(Boolean);
    const process = await container.spawn(cmd, args);

    let output = '';
    const writer = new WritableStream({
        write(chunk) {
            output += chunk;
        },
    });

    process.output.pipeTo(writer);

    if (opts.timeout) {
        setTimeout(() => {
            try {
                process.kill();
            } catch {
                // ignore
            }
        }, opts.timeout);
    }

    await process.exit;
    return output;
}
