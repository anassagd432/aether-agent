/**
 * Agdi Browser Tool (Playwright)
 * 
 * Provides web surfing capabilities to the agent.
 * Extracted from MoltBot's browser-tool.ts
 */

// Playwright types - soft dependency
type Browser = any;
type BrowserContext = any;
type Page = any;

// Dynamic import to avoid hard dependency
async function getPlaywright(): Promise<any> {
    try {
        // @ts-expect-error - playwright may not be installed
        return await import('playwright');
    } catch {
        throw new Error('Playwright is not installed. Run: npm install playwright');
    }
}
import { PermissionGate, permissionGate } from '../security';

export interface BrowserToolConfig {
    headless?: boolean;
    userAgent?: string;
    viewport?: { width: number; height: number };
}

export class BrowserSession {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: BrowserToolConfig;

    constructor(config: BrowserToolConfig = {}) {
        this.config = {
            headless: config.headless ?? true,
            userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: config.viewport || { width: 1280, height: 800 }
        };
    }

    async start(): Promise<void> {
        if (this.browser) return;

        // Security check
        if (!await permissionGate.check('browser', 'start', 'Starting new browser session')) {
            throw new Error('Permission denied to start browser');
        }

        const pw = await getPlaywright();
        this.browser = await pw.chromium.launch({
            headless: this.config.headless
        });

        this.context = await this.browser.newContext({
            userAgent: this.config.userAgent,
            viewport: this.config.viewport
        });

        this.page = await this.context.newPage();
    }

    async navigate(url: string): Promise<string> {
        if (!this.page) await this.start();

        if (!await permissionGate.check('browser', url, `Navigating to ${url}`)) {
            throw new Error(`Permission denied to navigate to ${url}`);
        }

        await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
        return await this.getPageContent();
    }

    async click(selector: string): Promise<void> {
        if (!this.page) throw new Error('Browser not started');
        await this.page.click(selector);
    }

    async type(selector: string, text: string): Promise<void> {
        if (!this.page) throw new Error('Browser not started');
        await this.page.fill(selector, text);
    }

    async screenshot(path: string): Promise<void> {
        if (!this.page) throw new Error('Browser not started');
        await this.page.screenshot({ path });
    }

    async getPageContent(): Promise<string> {
        if (!this.page) throw new Error('Browser not started');

        // Simple markdown extraction
        return await this.page.evaluate(() => {
            return document.body.innerText;
        });
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
}
