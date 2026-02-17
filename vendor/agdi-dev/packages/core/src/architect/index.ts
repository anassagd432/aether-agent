/**
 * Architect Module - App planning and generation
 */

import type { ILLMProvider, AppPlan, GeneratedFile } from '../types/index.js';

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
    const planPrompt = `Create a detailed plan for: ${prompt}

Return a JSON object with:
{
  "name": "app-name",
  "description": "Brief description",
  "files": [{"path": "src/App.tsx", "description": "Main component"}],
  "dependencies": ["react", "tailwindcss"],
  "architecture": "Component architecture description"
}

Return ONLY valid JSON, no markdown.`;

    const response = await llm.generate(planPrompt, SYSTEM_PROMPT);

    try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        // Fallback plan
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

    // Generate package.json
    onProgress?.('Creating package.json...', 'package.json');
    files.push({
        path: 'package.json',
        content: JSON.stringify({
            name: plan.name,
            version: '0.1.0',
            type: 'module',
            scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview',
            },
            dependencies: Array.from(new Set(plan.dependencies.filter(Boolean))).reduce((acc, dep) => {
                acc[dep] = 'latest';
                return acc;
            }, {} as Record<string, string>),
        }, null, 2),
    });

    return { plan, files };
}
