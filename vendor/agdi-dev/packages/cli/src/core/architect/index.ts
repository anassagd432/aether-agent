/**
 * Architect Module - App planning and generation
 */

import type { ILLMProvider, AppPlan, GeneratedFile } from '../types/index.js';

import { ui } from '../../utils/ui.js';

export { AppPlan };

const SYSTEM_PROMPT = `You are Agdi Architect, an expert software architect AI.
Your job is to generate complete, production-ready React applications.
Always use TypeScript, Tailwind CSS, and Vite.
Generate all necessary files including package.json, tsconfig.json, vite.config.ts.
Make the UI beautiful with modern design patterns.`;

/**
 * Generate an app plan from a prompt
 */
export async function generatePlan(
    prompt: string,
    llm: ILLMProvider
): Promise<AppPlan> {
    let planPrompt = `Create a detailed plan for: ${prompt}

Return a JSON object with:
{
  "name": "app-name",
  "description": "Brief description",
  "files": [
    {"path": "src/App.tsx", "description": "Main component"},
    {"path": "README.md", "description": "Project documentation"}
  ],
  "dependencies": ["react", "tailwindcss"],
  "architecture": "Component architecture description"
}

Return ONLY valid JSON, no markdown.`;

    if (ui.flags.saas) {
        planPrompt = `Create a SaaS blueprint plan for: ${prompt}

CRITICAL: SaaS mode outputs a production-ready Next.js app (App Router) with:
- Prisma schema (multi-tenant ready)
- Auth routes and session helpers
- Stripe billing + webhook placeholder
- Dashboard + settings pages
- API routes for core entities

Return a JSON object with:
{
  "name": "app-name",
  "description": "Brief description",
  "files": [
    {"path": "app/layout.tsx", "description": "Root layout"},
    {"path": "app/page.tsx", "description": "Landing page"},
    {"path": "app/(dashboard)/dashboard/page.tsx", "description": "Main dashboard"},
    {"path": "app/(auth)/login/page.tsx", "description": "Login page"},
    {"path": "app/api/health/route.ts", "description": "Health check"},
    {"path": "app/api/billing/portal/route.ts", "description": "Stripe customer portal"},
    {"path": "app/api/stripe/webhook/route.ts", "description": "Stripe webhook"},
    {"path": "app/globals.css", "description": "Global styles"},
    {"path": "lib/db.ts", "description": "Prisma client"},
    {"path": "lib/auth.ts", "description": "Auth helpers"},
    {"path": "lib/stripe.ts", "description": "Stripe client"},
    {"path": "prisma/schema.prisma", "description": "DB schema with Tenant/User/Org"},
    {"path": "middleware.ts", "description": "Auth middleware"},
    {"path": "next.config.mjs", "description": "Next.js config"},
    {"path": "tsconfig.json", "description": "TypeScript config"},
    {"path": "tailwind.config.ts", "description": "Tailwind config"},
    {"path": "postcss.config.js", "description": "PostCSS config"},
    {"path": ".env.example", "description": "Environment variables"}
  ],
  "dependencies": ["next", "react", "react-dom", "@prisma/client", "prisma", "stripe", "zod", "bcryptjs"],
  "architecture": "Multi-tenant SaaS with Next.js App Router"
}

Return ONLY valid JSON.`;
    } else if (ui.flags.minimal) {
        planPrompt = `Create a minimal plan for: ${prompt}

CRITICAL: Minimal mode matches user request exactly.
- If user asks for "hello.ts", generate ONLY "hello.ts".
- Do NOT scaffold a full React app unless explicitly asked.
- Do NOT add boilerplate headers/footers.

Return a JSON object with:
{
  "name": "minimal-project",
  "description": "Minimal generation",
  "files": [{"path": "requested-file.ts", "description": "Requested logic"}],
  "dependencies": [], 
  "architecture": "Single file script"
}

Return ONLY valid JSON.`;
    }

    const response = await llm.generate(planPrompt, SYSTEM_PROMPT);

    try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        // Fallback plan
    }

    if (ui.flags.saas) {
        return {
            name: 'saas-app',
            description: prompt,
            files: [
                { path: 'app/layout.tsx', description: 'Root layout' },
                { path: 'app/page.tsx', description: 'Landing page' },
                { path: 'app/(dashboard)/dashboard/page.tsx', description: 'Main dashboard' },
                { path: 'app/(auth)/login/page.tsx', description: 'Login page' },
                { path: 'app/api/health/route.ts', description: 'Health check' },
                { path: 'app/api/billing/portal/route.ts', description: 'Stripe customer portal' },
                { path: 'app/api/stripe/webhook/route.ts', description: 'Stripe webhook' },
                { path: 'app/globals.css', description: 'Global styles' },
                { path: 'lib/db.ts', description: 'Prisma client' },
                { path: 'lib/auth.ts', description: 'Auth helpers' },
                { path: 'lib/stripe.ts', description: 'Stripe client' },
                { path: 'prisma/schema.prisma', description: 'DB schema with Tenant/User/Org' },
                { path: 'middleware.ts', description: 'Auth middleware' },
                { path: 'next.config.mjs', description: 'Next.js config' },
                { path: 'tsconfig.json', description: 'TypeScript config' },
                { path: 'tailwind.config.ts', description: 'Tailwind config' },
                { path: 'postcss.config.js', description: 'PostCSS config' },
                { path: '.env.example', description: 'Environment variables' },
            ],
            dependencies: ['next', 'react', 'react-dom', '@prisma/client', 'prisma', 'stripe', 'zod', 'bcryptjs'],
            architecture: 'Multi-tenant SaaS with Next.js App Router',
        };
    }

    return {
        name: 'my-app',
        description: prompt,
        files: [
            { path: 'src/App.tsx', description: 'Main App component' },
            { path: 'src/main.tsx', description: 'Entry point' },
            { path: 'src/index.css', description: 'Global styles' },
        ],
        dependencies: ['react', 'react-dom', 'tailwindcss'],
        architecture: 'Simple React SPA',
    };
}

/**
 * Generate a file's content based on plan
 */
export async function generateFile(
    filePath: string,
    fileDescription: string,
    plan: AppPlan,
    llm: ILLMProvider
): Promise<GeneratedFile> {
    const prompt = `Generate the complete code for: ${filePath}

Context:
- App: ${plan.name}
- Description: ${plan.description}
- This file: ${fileDescription}
- Architecture: ${plan.architecture}

Return ONLY the file content, no markdown code blocks.`;

    const response = await llm.generate(prompt, SYSTEM_PROMPT);

    let content = response.text;
    // Strip markdown code blocks if present
    if (content.startsWith('```')) {
        content = content.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
    }

    return {
        path: filePath,
        content: content.trim(),
    };
}

/**
 * Generate entire app from prompt
 */
export async function generateApp(
    prompt: string,
    llm: ILLMProvider,
    onProgress?: (step: string, file?: string) => void
): Promise<{ plan: AppPlan; files: GeneratedFile[] }> {
    onProgress?.('Planning app architecture...');
    const plan = await generatePlan(prompt, llm);

    onProgress?.('Generating files...');
    const files: GeneratedFile[] = [];

    for (const fileSpec of plan.files) {
        onProgress?.(`Creating ${fileSpec.path}...`, fileSpec.path);
        const file = await generateFile(fileSpec.path, fileSpec.description, plan, llm);
        files.push(file);
    }

    // Generate package.json (SKIP in minimal mode)
    if (!ui.flags.minimal) {
        onProgress?.('Creating package.json...', 'package.json');

        if (ui.flags.saas) {
            files.push({
                path: 'package.json',
                content: JSON.stringify({
                    name: plan.name,
                    version: '0.1.0',
                    private: true,
                    scripts: {
                        dev: 'next dev',
                        build: 'next build',
                        start: 'next start',
                        lint: 'next lint',
                        prisma: 'prisma',
                        'db:push': 'prisma db push',
                        'db:generate': 'prisma generate',
                    },
                    dependencies: {
                        next: '^14.2.0',
                        react: '^18.3.1',
                        'react-dom': '^18.3.1',
                        '@prisma/client': '^5.19.0',
                        stripe: '^16.12.0',
                        zod: '^3.23.0',
                        bcryptjs: '^2.4.3',
                        ...Array.from(new Set(plan.dependencies.filter(Boolean))).reduce((acc, dep) => {
                            if (!['next', 'react', 'react-dom', '@prisma/client', 'stripe'].includes(dep)) {
                                acc[dep] = 'latest';
                            }
                            return acc;
                        }, {} as Record<string, string>),
                    },
                    devDependencies: {
                        prisma: '^5.19.0',
                        typescript: '^5.5.0',
                        '@types/node': '^20.12.0',
                        '@types/react': '^18.3.0',
                        '@types/react-dom': '^18.3.0',
                        '@types/bcryptjs': '^2.4.6',
                        eslint: '^9.6.0',
                        'eslint-config-next': '^14.2.0',
                        tailwindcss: '^3.4.10',
                        postcss: '^8.4.45',
                        autoprefixer: '^10.4.20',
                    },
                }, null, 2),
            });
        } else {
            files.push({
                path: 'package.json',
                content: JSON.stringify({
                    name: plan.name,
                    version: '0.1.0',
                    type: 'module',
                    scripts: {
                        dev: 'vite',
                        build: 'tsc -b && vite build',
                        preview: 'vite preview',
                    },
                    dependencies: {
                        'react': '^18.3.1',
                        'react-dom': '^18.3.1',
                        ...Array.from(new Set(plan.dependencies.filter(Boolean))).reduce((acc, dep) => {
                            if (dep !== 'react' && dep !== 'react-dom') {
                                acc[dep] = 'latest';
                            }
                            return acc;
                        }, {} as Record<string, string>),
                    },
                    devDependencies: {
                        '@types/react': '^18.3.0',
                        '@types/react-dom': '^18.3.0',
                        '@vitejs/plugin-react': '^4.3.0',
                        'autoprefixer': '^10.4.20',
                        'postcss': '^8.4.45',
                        'tailwindcss': '^3.4.10',
                        'typescript': '~5.5.0',
                        'vite': '^5.4.0',
                    },
                }, null, 2),
            });
        }
    }

    return { plan, files };
}
