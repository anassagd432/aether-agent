/**
 * ConversationManager - Maintains chat history for multi-turn conversations
 * 
 * Stores messages in memory and optionally persists to disk.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ChatMessage } from './types/index.js';

// ==================== TYPES ====================

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

export interface ConversationSession {
    id: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    metadata?: {
        model?: string;
        workspace?: string;
        systemPrompt?: string;
    };
}

// ==================== CONSTANTS ====================

const AGDI_DIR = join(homedir(), '.agdi');
const SESSIONS_DIR = join(AGDI_DIR, 'sessions');

/**
 * Approximate token limit for context window
 * Most models support 8k-128k, we use a conservative limit
 */
const MAX_CONTEXT_TOKENS = 32000;
const CHARS_PER_TOKEN = 4; // Rough estimate

// ==================== CONVERSATION MANAGER ====================

export class ConversationManager {
    private messages: Message[] = [];
    private sessionId: string;
    private systemPrompt: string = '';

    constructor(sessionId?: string) {
        this.sessionId = sessionId || this.generateSessionId();
    }

    /**
     * Set the system prompt (persists across conversation)
     */
    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    /**
     * Get the system prompt
     */
    getSystemPrompt(): string {
        return this.systemPrompt;
    }

    /**
     * Add a user message
     */
    addUserMessage(content: string): void {
        this.messages.push({
            role: 'user',
            content,
            timestamp: Date.now(),
        });
        this.trimToContextLimit();
    }

    /**
     * Add an assistant response
     */
    addAssistantMessage(content: string): void {
        this.messages.push({
            role: 'assistant',
            content,
            timestamp: Date.now(),
        });
        this.trimToContextLimit();
    }

    /**
     * Get all messages for LLM context
     */
    getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Get messages formatted for API calls
     */
    getMessagesForAPI(): ChatMessage[] {
        const result: ChatMessage[] = [];

        // Add system prompt if set
        if (this.systemPrompt) {
            result.push({ role: 'system', content: this.systemPrompt });
        }

        // Add conversation history
        for (const msg of this.messages) {
            result.push({ role: msg.role, content: msg.content });
        }

        return result;
    }

    /**
     * Get message count
     */
    getMessageCount(): number {
        return this.messages.length;
    }

    /**
     * Get turn count (user messages)
     */
    getTurnCount(): number {
        return this.messages.filter(m => m.role === 'user').length;
    }

    /**
     * Clear conversation history
     */
    clear(): void {
        this.messages = [];
    }

    /**
     * Get session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Get last N messages
     */
    getLastMessages(n: number): Message[] {
        return this.messages.slice(-n);
    }

    /**
     * Get conversation summary for display
     */
    getSummary(): string {
        const turns = this.getTurnCount();
        const tokens = this.estimateTokens();
        return `Session: ${this.sessionId} | ${turns} turns | ~${tokens} tokens`;
    }

    /**
     * Estimate token count
     */
    estimateTokens(): number {
        let chars = this.systemPrompt.length;
        for (const msg of this.messages) {
            chars += msg.content.length;
        }
        return Math.ceil(chars / CHARS_PER_TOKEN);
    }

    /**
     * Trim messages to stay within context limit
     */
    private trimToContextLimit(): void {
        while (this.estimateTokens() > MAX_CONTEXT_TOKENS && this.messages.length > 2) {
            // Remove oldest messages (keep at least last 2)
            this.messages.shift();
        }
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const random = Math.random().toString(36).substring(2, 8);
        return `${date}-${random}`;
    }

    // ==================== PERSISTENCE ====================

    /**
     * Save session to disk
     */
    save(): void {
        this.ensureDirectories();

        const session: ConversationSession = {
            id: this.sessionId,
            messages: this.messages,
            createdAt: this.messages[0]?.timestamp || Date.now(),
            updatedAt: Date.now(),
            metadata: {
                systemPrompt: this.systemPrompt,
            },
        };

        const filePath = join(SESSIONS_DIR, `${this.sessionId}.json`);
        writeFileSync(filePath, JSON.stringify(session, null, 2));
    }

    /**
     * Load session from disk
     */
    static load(sessionId: string): ConversationManager | null {
        const filePath = join(SESSIONS_DIR, `${sessionId}.json`);

        if (!existsSync(filePath)) {
            return null;
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const session = JSON.parse(content) as ConversationSession;

            const manager = new ConversationManager(session.id);
            manager.messages = session.messages;
            if (session.metadata?.systemPrompt) {
                manager.systemPrompt = session.metadata.systemPrompt;
            }

            return manager;
        } catch {
            return null;
        }
    }

    /**
     * List available sessions
     */
    static listSessions(): string[] {
        if (!existsSync(SESSIONS_DIR)) {
            return [];
        }

        const files = readdirSync(SESSIONS_DIR) as string[];

        return files
            .filter((f: string) => f.endsWith('.json'))
            .map((f: string) => f.replace('.json', ''))
            .sort()
            .reverse();
    }

    /**
     * Ensure directories exist
     */
    private ensureDirectories(): void {
        if (!existsSync(AGDI_DIR)) {
            mkdirSync(AGDI_DIR, { recursive: true });
        }
        if (!existsSync(SESSIONS_DIR)) {
            mkdirSync(SESSIONS_DIR, { recursive: true });
        }
    }
}

// ==================== SINGLETON INSTANCE ====================

let currentConversation: ConversationManager | null = null;

/**
 * Get or create the current conversation
 */
export function getConversation(): ConversationManager {
    if (!currentConversation) {
        currentConversation = new ConversationManager();
    }
    return currentConversation;
}

/**
 * Start a new conversation
 */
export function newConversation(): ConversationManager {
    currentConversation = new ConversationManager();
    return currentConversation;
}

/**
 * Clear current conversation
 */
export function clearConversation(): void {
    if (currentConversation) {
        currentConversation.clear();
    }
}
