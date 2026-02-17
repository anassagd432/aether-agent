/**
 * Frontend Agent
 * 
 * Specialist in React/Next.js UI development.
 * Generates components, pages, and styling.
 */

import { BaseAgent, SquadTask, AgentOutput, GeneratedFile, PageSpec } from './base-agent.js';
import type { ILLMProvider } from '../../core/types/index.js';

// ==================== FRONTEND SYSTEM PROMPT ====================

const FRONTEND_SYSTEM_PROMPT = `You are a SENIOR FRONTEND DEVELOPER with expertise in:
- React 19 / Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/UI components
- Framer Motion animations

Your responsibilities:
1. Build beautiful, responsive UI components
2. Create page layouts with proper routing
3. Implement client-side state with hooks
4. Ensure accessibility (ARIA, keyboard nav)
5. Add micro-animations for polish

Code Style:
- Use functional components with hooks
- Type all props with TypeScript interfaces
- Use Tailwind utility classes
- Add helpful comments for complex logic
- Export components as default

Output Format - Always include file paths:
\`\`\`tsx
// filepath: src/components/MyComponent.tsx
import React from 'react';
// ... component code
\`\`\`

Sources:
- If you reference any external APIs, datasets, or design patterns, list their URLs in a "Sources:" section at the end.

Make components production-ready. No placeholders.`;

// ==================== FRONTEND AGENT CLASS ====================

export class FrontendAgent extends BaseAgent {
    constructor(llm: ILLMProvider, options: { verbose?: boolean } = {}) {
        super('frontend', '🎨 Frontend', llm, options);
    }

    getSystemPrompt(): string {
        return FRONTEND_SYSTEM_PROMPT;
    }

    /**
     * Generate a React component
     */
    async generateComponent(
        componentName: string,
        description: string,
        props?: Record<string, string>
    ): Promise<GeneratedFile[]> {
        this.log(`Creating component: ${componentName}`);

        const propsString = props
            ? Object.entries(props).map(([k, v]) => `- ${k}: ${v}`).join('\n')
            : 'No special props needed';

        const response = await this.think(`
Create a React component:

Name: ${componentName}
Description: ${description}
Props:
${propsString}

Make it beautiful with Tailwind. Include hover effects and transitions.
        `);

        const files = this.extractCodeBlocks(response);

        if (files.length === 0) {
            // Create default file if parsing failed
            files.push({
                path: `src/components/${componentName}.tsx`,
                content: response,
                action: 'create',
            });
        }

        this.log(`Generated ${files.length} files for ${componentName}`, 'success');
        return files;
    }

    /**
     * Generate a Next.js page
     */
    async generatePage(page: PageSpec): Promise<GeneratedFile[]> {
        this.log(`Creating page: ${page.name} (${page.route})`);

        const response = await this.think(`
Create a Next.js page:

Route: ${page.route}
Name: ${page.name}
Description: ${page.description}
Components to include: ${page.components.join(', ')}

Requirements:
- Use App Router (page.tsx)
- Add metadata export for SEO
- Make it visually stunning with gradients, animations
- Ensure mobile responsiveness
        `);

        const files = this.extractCodeBlocks(response);

        // Ensure the page file is created
        if (files.length === 0) {
            const routePath = page.route === '/' ? '' : page.route;
            files.push({
                path: `src/app${routePath}/page.tsx`,
                content: response,
                action: 'create',
            });
        }

        this.log(`Generated ${files.length} files for ${page.name} page`, 'success');
        return files;
    }

    /**
     * Generate shared UI components (Button, Card, Input, etc.)
     */
    async generateUIKit(): Promise<GeneratedFile[]> {
        this.log('Creating UI component kit...');

        const response = await this.think(`
Create a complete UI kit with these components:

1. Button - With variants: primary, secondary, ghost, danger
2. Card - With header, content, footer sections
3. Input - With label, error state, icons
4. Badge - For status indicators
5. Avatar - With fallback initials
6. Skeleton - Loading placeholder

Each component should:
- Be in its own file
- Have TypeScript props interface
- Use Tailwind for styling
- Include dark mode support
- Have smooth transitions
        `);

        const files = this.extractCodeBlocks(response);
        this.log(`Generated ${files.length} UI components`, 'success');
        return files;
    }

    /**
     * Execute a frontend task
     */
    async execute(task: SquadTask): Promise<AgentOutput> {
        this.log(`Executing: ${task.title}`);
        this.resetSources();

        let files: GeneratedFile[];
        const errors: string[] = [];

        try {
            if (task.title.toLowerCase().includes('shared') || task.title.toLowerCase().includes('ui component')) {
                files = await this.generateUIKit();
            } else if (task.input?.page) {
                files = await this.generatePage(task.input.page as PageSpec);
            } else {
                // Generic component task
                files = await this.generateComponent(
                    task.title.replace(/create|build|implement/gi, '').trim(),
                    task.description
                );
            }

            return {
                success: true,
                content: `Generated ${files.length} files`,
                files,
                nextSteps: files.map(f => `Created: ${f.path}`),
                sources: this.getSources(),
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Task failed: ${errorMsg}`, 'error');

            return {
                success: false,
                content: errorMsg,
                errors: [errorMsg],
                sources: this.getSources(),
            };
        }
    }
}

export default FrontendAgent;
