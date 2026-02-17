/**
 * Agdi WhatsApp Client
 * 
 * WhatsApp interface using @whiskeysockets/baileys.
 * Extracted and refactored from MoltBot's web/ integration.
 * 
 * Features:
 * - Message listening with authorization
 * - Voice message handling (audio -> Whisper)
 * - Async notifications
 * - Zero-Trust security (authorized numbers only)
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

/**
 * WhatsApp message structure
 */
export interface WhatsAppMessage {
    /** Unique message ID */
    id: string;
    /** Sender phone number (with @s.whatsapp.net) */
    from: string;
    /** Chat ID (individual or group) */
    chatId: string;
    /** Is this a group message */
    isGroup: boolean;
    /** Message type */
    type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'unknown';
    /** Text content (if text message) */
    text?: string;
    /** Media info (if media message) */
    media?: {
        mimetype: string;
        url: string;
        directPath?: string;
        mediaKey?: Buffer;
        fileLength?: number;
    };
    /** Timestamp */
    timestamp: number;
    /** Is message from me */
    fromMe: boolean;
    /** Mentioned JIDs in group */
    mentionedJids?: string[];
    /** Quoted message (if reply) */
    quotedMessage?: {
        id: string;
        from: string;
        text?: string;
    };
}

/**
 * WhatsApp client configuration
 */
export interface WhatsAppClientConfig {
    /** Authorized phone numbers (with country code, no + prefix) */
    authorizedNumbers: string[];
    /** Owner number for admin commands */
    ownerNumber?: string;
    /** Session name for auth persistence */
    sessionName?: string;
    /** Path to store auth credentials */
    authPath?: string;
    /** Enable voice message transcription */
    enableVoiceTranscription?: boolean;
    /** Require mention in groups */
    requireMentionInGroups?: boolean;
    /** Bot phone number (for self-check) */
    botNumber?: string;
}

/**
 * WhatsApp client events
 */
export interface WhatsAppClientEvents {
    'ready': () => void;
    'qr': (qr: string) => void;
    'message': (msg: WhatsAppMessage) => void;
    'voice': (msg: WhatsAppMessage, buffer: Buffer) => void;
    'disconnected': (reason: string) => void;
    'error': (error: Error) => void;
}

// =============================================================================
// AUTHORIZATION
// =============================================================================

/**
 * Check if a phone number is authorized
 * Security: Only process messages from whitelisted numbers
 */
export function isAuthorizedNumber(
    from: string,
    authorizedNumbers: string[]
): boolean {
    // Extract phone number from JID (e.g., "1234567890@s.whatsapp.net" -> "1234567890")
    const phoneNumber = from.split('@')[0];

    // Check against authorized list
    for (const authorized of authorizedNumbers) {
        // Normalize: remove spaces, dashes, +
        const normalizedAuth = authorized.replace(/[\s\-+]/g, '');
        const normalizedFrom = phoneNumber.replace(/[\s\-+]/g, '');

        if (normalizedFrom === normalizedAuth || normalizedFrom.endsWith(normalizedAuth)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if bot was mentioned in group
 */
export function isMentioned(message: WhatsAppMessage, botNumber: string): boolean {
    if (!message.mentionedJids) return false;
    const botJid = `${botNumber}@s.whatsapp.net`;
    return message.mentionedJids.some(jid => jid === botJid);
}

// =============================================================================
// WHATSAPP CLIENT
// =============================================================================

export class WhatsAppClient extends EventEmitter {
    private config: WhatsAppClientConfig;
    private sock: any = null; // Baileys socket
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    constructor(config: WhatsAppClientConfig) {
        super();
        this.config = {
            ...config,
            authorizedNumbers: config.authorizedNumbers || [],
            enableVoiceTranscription: config.enableVoiceTranscription ?? true,
            requireMentionInGroups: config.requireMentionInGroups ?? true,
        };
    }

    /**
     * Initialize WhatsApp connection with Baileys
     */
    async connect(): Promise<void> {
        try {
            // Dynamic import of Baileys to avoid bundling issues
            const { makeWASocket, useMultiFileAuthState: multiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
            const { Boom } = await import('@hapi/boom');

            const authPath = this.config.authPath || './.agdi/whatsapp-auth';
            const { state, saveCreds } = await multiFileAuthState(authPath);

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                browser: ['Agdi', 'Chrome', '1.0.0'],
            });

            // Save credentials on update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.emit('qr', qr);
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    if (shouldReconnect && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                        this.reconnectAttempts++;
                        console.log(`[WhatsApp] Reconnecting... (attempt ${this.reconnectAttempts})`);
                        setTimeout(() => this.connect(), 3000);
                    } else {
                        this.isConnected = false;
                        this.emit('disconnected', lastDisconnect?.error?.message || 'Connection closed');
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('[WhatsApp] Connected successfully');
                    this.emit('ready');
                }
            });

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m: any) => {
                const messages = m.messages || [];

                for (const msg of messages) {
                    await this.handleMessage(msg);
                }
            });

        } catch (error) {
            console.error('[WhatsApp] Connection error:', error);
            this.emit('error', error as Error);
        }
    }

    /**
     * Handle incoming message
     */
    private async handleMessage(rawMsg: any): Promise<void> {
        try {
            // Skip status updates
            if (rawMsg.key.remoteJid === 'status@broadcast') return;

            // Parse message
            const message = this.parseMessage(rawMsg);
            if (!message) return;

            // Security: Check authorization
            if (!isAuthorizedNumber(message.from, this.config.authorizedNumbers)) {
                console.log(`[WhatsApp] Unauthorized message from: ${message.from}`);
                return;
            }

            // Group handling: require mention if configured
            if (message.isGroup && this.config.requireMentionInGroups) {
                if (this.config.botNumber && !isMentioned(message, this.config.botNumber)) {
                    return; // Skip non-mentioned group messages
                }
            }

            // Handle voice messages
            if (message.type === 'audio' && this.config.enableVoiceTranscription) {
                await this.handleVoiceMessage(rawMsg, message);
                return;
            }

            // Emit text/other messages
            this.emit('message', message);

        } catch (error) {
            console.error('[WhatsApp] Message handling error:', error);
        }
    }

    /**
     * Parse raw Baileys message to our format
     */
    private parseMessage(rawMsg: any): WhatsAppMessage | null {
        const key = rawMsg.key;
        const messageContent = rawMsg.message;

        if (!messageContent) return null;

        const chatId = key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const from = key.participant || key.remoteJid;

        // Determine message type
        let type: WhatsAppMessage['type'] = 'unknown';
        let text: string | undefined;
        let media: WhatsAppMessage['media'] | undefined;

        if (messageContent.conversation) {
            type = 'text';
            text = messageContent.conversation;
        } else if (messageContent.extendedTextMessage) {
            type = 'text';
            text = messageContent.extendedTextMessage.text;
        } else if (messageContent.audioMessage) {
            type = 'audio';
            media = {
                mimetype: messageContent.audioMessage.mimetype,
                url: messageContent.audioMessage.url,
                directPath: messageContent.audioMessage.directPath,
                mediaKey: messageContent.audioMessage.mediaKey,
                fileLength: messageContent.audioMessage.fileLength,
            };
        } else if (messageContent.imageMessage) {
            type = 'image';
            text = messageContent.imageMessage.caption;
            media = {
                mimetype: messageContent.imageMessage.mimetype,
                url: messageContent.imageMessage.url,
                directPath: messageContent.imageMessage.directPath,
                mediaKey: messageContent.imageMessage.mediaKey,
            };
        }

        // Extract mentions
        const mentionedJids = messageContent.extendedTextMessage?.contextInfo?.mentionedJid;

        return {
            id: key.id,
            from,
            chatId,
            isGroup,
            type,
            text,
            media,
            timestamp: rawMsg.messageTimestamp || Date.now(),
            fromMe: key.fromMe || false,
            mentionedJids,
        };
    }

    /**
     * Handle voice message - download and emit for transcription
     */
    private async handleVoiceMessage(rawMsg: any, message: WhatsAppMessage): Promise<void> {
        try {
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

            // Download audio buffer
            const buffer = await downloadMediaMessage(
                rawMsg,
                'buffer',
                {},
                {
                    logger: console as any,
                    reuploadRequest: this.sock.updateMediaMessage,
                }
            );

            if (buffer) {
                // Emit voice event with buffer for transcription
                this.emit('voice', message, buffer as Buffer);
            }
        } catch (error) {
            console.error('[WhatsApp] Voice download error:', error);
        }
    }

    /**
     * Send a text message
     */
    async sendMessage(to: string, text: string): Promise<void> {
        if (!this.sock || !this.isConnected) {
            throw new Error('WhatsApp not connected');
        }

        await this.sock.sendMessage(to, { text });
    }

    /**
     * Send an async notification (e.g., "Build Complete")
     */
    async sendNotification(to: string, title: string, body: string): Promise<void> {
        const text = `*${title}*\n\n${body}`;
        await this.sendMessage(to, text);
    }

    /**
     * Disconnect WhatsApp
     */
    async disconnect(): Promise<void> {
        if (this.sock) {
            await this.sock.logout();
            this.sock = null;
            this.isConnected = false;
        }
    }

    /**
     * Check if connected
     */
    isReady(): boolean {
        return this.isConnected;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let whatsappClientInstance: WhatsAppClient | null = null;

export function getWhatsAppClient(config?: WhatsAppClientConfig): WhatsAppClient {
    if (!whatsappClientInstance && config) {
        whatsappClientInstance = new WhatsAppClient(config);
    }
    if (!whatsappClientInstance) {
        throw new Error('WhatsApp client not initialized. Provide config first.');
    }
    return whatsappClientInstance;
}

export function resetWhatsAppClient(): void {
    if (whatsappClientInstance) {
        whatsappClientInstance.disconnect();
    }
    whatsappClientInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    WhatsAppClient,
    getWhatsAppClient,
    resetWhatsAppClient,
    isAuthorizedNumber,
    isMentioned,
};
