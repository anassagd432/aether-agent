/**
 * WhatsApp Interface
 * 
 * Secure WhatsApp integration for Agdi using Baileys.
 * All commands from voice notes are routed through PermissionManager.
 * 
 * Flow: Voice Note → Transcription → PermissionManager → Execute/Confirm
 */

import type { PermissionManager } from '../security/permission-manager';
import type { PermissionResult } from '../security/types';

// ==================== TYPES ====================

export interface WhatsAppConfig {
    authDir: string;                    // Where to store Baileys auth session
    transcriptionProvider: 'deepgram' | 'whisper' | 'web-speech';
    deepgramApiKey?: string;
    autoReconnect: boolean;
    maxReconnectAttempts: number;
}

export interface VoiceSource {
    phone: string;                      // E.164 format
    timestamp: number;
    messageId: string;
    isGroup: boolean;
    groupId?: string;
}

export interface VoiceCommandResult {
    decision: 'execute' | 'confirm' | 'deny' | 'error';
    response: string;                   // Message to send back
    riskTier?: number;
    originalTranscription: string;
}

export interface TranscriptionResult {
    text: string;
    confidence: number;
    duration: number;                   // Audio duration in seconds
    provider: string;
}

export interface WhatsAppMessage {
    from: string;
    text?: string;
    audioData?: Buffer;
    audioMimeType?: string;
    timestamp: number;
    isGroup: boolean;
    groupId?: string;
    messageId: string;
}

export type MessageHandler = (message: WhatsAppMessage) => Promise<void>;
export type ConnectionHandler = (status: 'connected' | 'disconnected' | 'qr') => void;

// ==================== TRANSCRIPTION PROVIDERS ====================

/**
 * Deepgram transcription provider.
 * Ported from MoltBot's src/media-understanding/providers/deepgram/audio.ts
 */
async function transcribeWithDeepgram(
    audioData: Buffer,
    apiKey: string,
    mimeType: string = 'audio/ogg'
): Promise<TranscriptionResult> {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': mimeType,
        },
        body: audioData,
    });

    if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status}`);
    }

    const result = await response.json() as {
        results?: {
            channels?: Array<{
                alternatives?: Array<{
                    transcript?: string;
                    confidence?: number;
                }>;
            }>;
        };
        metadata?: {
            duration?: number;
        };
    };

    const channel = result.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    return {
        text: alternative?.transcript || '',
        confidence: alternative?.confidence || 0,
        duration: result.metadata?.duration || 0,
        provider: 'deepgram',
    };
}

/**
 * Web Speech API transcription (browser-based fallback).
 */
async function transcribeWithWebSpeech(
    _audioData: Buffer
): Promise<TranscriptionResult> {
    // Note: This is a placeholder. Web Speech API requires browser context.
    // In a real implementation, this would use a worker or browser bridge.
    throw new Error('Web Speech API not available in Node.js context. Use Deepgram or Whisper.');
}

// ==================== VOICE PERMISSION GATE ====================

/**
 * Voice Permission Gate
 * 
 * Wraps PermissionManager with voice-specific behavior:
 * - All voice commands default to riskTier 2+ (require confirmation for dangerous ops)
 * - Provides human-friendly responses for WhatsApp
 */
export class VoicePermissionGate {
    constructor(
        private permissionManager: PermissionManager,
        private cwd: string
    ) { }

    /**
     * Process a voice command through the security gate.
     */
    async processCommand(
        transcription: string,
        source: VoiceSource
    ): Promise<VoiceCommandResult> {
        // Evaluate command through PermissionManager
        const result = this.permissionManager.evaluate(transcription, this.cwd);

        // Log the voice command attempt
        this.logVoiceCommand(transcription, source, result);

        // Handle based on decision
        switch (result.decision) {
            case 'allow':
                // Even allowed commands get elevated scrutiny from voice
                if (result.riskTier >= 2) {
                    return {
                        decision: 'confirm',
                        response: this.formatConfirmationRequest(transcription, result),
                        riskTier: result.riskTier,
                        originalTranscription: transcription,
                    };
                }
                return {
                    decision: 'execute',
                    response: `Got it! Working on: "${transcription.slice(0, 50)}${transcription.length > 50 ? '...' : ''}"`,
                    riskTier: result.riskTier,
                    originalTranscription: transcription,
                };

            case 'deny':
                return {
                    decision: 'deny',
                    response: `🚫 I can't do that. ${result.reason || 'This action is blocked by security policy.'}`,
                    riskTier: result.riskTier,
                    originalTranscription: transcription,
                };

            case 'prompt':
                return {
                    decision: 'confirm',
                    response: this.formatConfirmationRequest(transcription, result),
                    riskTier: result.riskTier,
                    originalTranscription: transcription,
                };

            default:
                return {
                    decision: 'error',
                    response: '❌ Something went wrong processing that command.',
                    originalTranscription: transcription,
                };
        }
    }

    /**
     * Format a human-friendly confirmation request.
     */
    private formatConfirmationRequest(
        transcription: string,
        result: PermissionResult
    ): string {
        const riskEmoji = result.riskTier >= 3 ? '⚠️' : '🔐';
        const preview = transcription.slice(0, 80);
        const truncated = transcription.length > 80 ? '...' : '';

        return [
            `${riskEmoji} I heard you, but I need you to confirm this action on screen first.`,
            ``,
            `Command: "${preview}${truncated}"`,
            ``,
            `${result.reason || 'This action requires explicit approval.'}`,
            ``,
            `📱 Please check your Agdi terminal to approve or deny.`,
        ].join('\n');
    }

    /**
     * Log voice command attempt for audit.
     */
    private logVoiceCommand(
        transcription: string,
        source: VoiceSource,
        result: PermissionResult
    ): void {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'voice_command',
            source: {
                phone: source.phone.slice(-4), // Only last 4 digits for privacy
                isGroup: source.isGroup,
                messageId: source.messageId,
            },
            command: transcription.slice(0, 100), // Truncate for log
            decision: result.decision,
            riskTier: result.riskTier,
            reason: result.reason,
        };

        // Log to console for now - can be extended to audit file
        console.log('[VoicePermissionGate]', JSON.stringify(logEntry));
    }
}

// ==================== WHATSAPP SESSION ====================

/**
 * WhatsApp Session Manager
 * 
 * Handles connection to WhatsApp using Baileys.
 * Note: Actual Baileys integration requires the package to be installed.
 */
export class WhatsAppSession {
    private config: WhatsAppConfig;
    private messageHandlers = new Set<MessageHandler>();
    private connectionHandlers = new Set<ConnectionHandler>();
    private connected = false;
    private socket: unknown = null;

    constructor(config: WhatsAppConfig) {
        this.config = config;
    }

    /**
     * Connect to WhatsApp.
     * In production, this would use Baileys to establish connection.
     */
    async connect(): Promise<void> {
        // This is a mock implementation.
        // Real implementation would use:
        // import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';

        console.log('[WhatsAppSession] Connecting...');
        console.log(`[WhatsAppSession] Auth directory: ${this.config.authDir}`);

        // Notify handlers that we need QR code
        this.notifyConnection('qr');

        // In production:
        // const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
        // this.socket = makeWASocket({ auth: state, ... });
        // this.socket.ev.on('connection.update', (update) => { ... });
        // this.socket.ev.on('messages.upsert', (msg) => { ... });

        throw new Error(
            'WhatsApp connection requires @whiskeysockets/baileys package. ' +
            'Run: npm install @whiskeysockets/baileys'
        );
    }

    /**
     * Register a message handler.
     */
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    /**
     * Register a connection status handler.
     */
    onConnection(handler: ConnectionHandler): () => void {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    /**
     * Send a text message.
     */
    async sendMessage(to: string, text: string): Promise<void> {
        if (!this.connected) {
            throw new Error('Not connected to WhatsApp');
        }

        // In production:
        // await this.socket.sendMessage(to, { text });
        console.log(`[WhatsAppSession] Would send to ${to}: ${text.slice(0, 50)}...`);
    }

    /**
     * Disconnect from WhatsApp.
     */
    async disconnect(): Promise<void> {
        if (this.socket) {
            // In production:
            // await this.socket.logout();
            this.socket = null;
        }
        this.connected = false;
        this.notifyConnection('disconnected');
    }

    /**
     * Check if connected.
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Transcribe audio data.
     */
    async transcribeAudio(
        audioData: Buffer,
        mimeType: string = 'audio/ogg'
    ): Promise<TranscriptionResult> {
        switch (this.config.transcriptionProvider) {
            case 'deepgram':
                if (!this.config.deepgramApiKey) {
                    throw new Error('Deepgram API key required for transcription');
                }
                return transcribeWithDeepgram(audioData, this.config.deepgramApiKey, mimeType);

            case 'whisper':
                // Would require local Whisper model
                throw new Error('Local Whisper transcription not yet implemented');

            case 'web-speech':
                return transcribeWithWebSpeech(audioData);

            default:
                throw new Error(`Unknown transcription provider: ${this.config.transcriptionProvider}`);
        }
    }

    private notifyConnection(status: 'connected' | 'disconnected' | 'qr'): void {
        for (const handler of this.connectionHandlers) {
            try {
                handler(status);
            } catch {
                // Ignore handler errors
            }
        }
    }

    private async notifyMessage(message: WhatsAppMessage): Promise<void> {
        for (const handler of this.messageHandlers) {
            try {
                await handler(message);
            } catch (error) {
                console.error('[WhatsAppSession] Message handler error:', error);
            }
        }
    }
}

// ==================== FACTORY ====================

/**
 * Create a complete WhatsApp interface with security integration.
 */
export function createWhatsAppInterface(params: {
    config: WhatsAppConfig;
    permissionManager: PermissionManager;
    cwd: string;
}): {
    session: WhatsAppSession;
    gate: VoicePermissionGate;
    handleVoiceNote: (audioData: Buffer, source: VoiceSource) => Promise<VoiceCommandResult>;
} {
    const session = new WhatsAppSession(params.config);
    const gate = new VoicePermissionGate(params.permissionManager, params.cwd);

    const handleVoiceNote = async (
        audioData: Buffer,
        source: VoiceSource
    ): Promise<VoiceCommandResult> => {
        try {
            // Transcribe the audio
            const transcription = await session.transcribeAudio(audioData);

            if (!transcription.text.trim()) {
                return {
                    decision: 'error',
                    response: "I couldn't understand that voice note. Could you try again?",
                    originalTranscription: '',
                };
            }

            // Process through security gate
            return gate.processCommand(transcription.text, source);

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                decision: 'error',
                response: `❌ Failed to process voice note: ${message}`,
                originalTranscription: '',
            };
        }
    };

    return { session, gate, handleVoiceNote };
}

// ==================== EXPORTS ====================

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
    authDir: '.agdi/whatsapp-auth',
    transcriptionProvider: 'deepgram',
    autoReconnect: true,
    maxReconnectAttempts: 5,
};
