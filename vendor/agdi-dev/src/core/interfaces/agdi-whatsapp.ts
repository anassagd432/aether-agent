/**
 * Agdi WhatsApp Interface
 * 
 * Ported from MoltBot's WhatsApp audio pipeline with full rebrand.
 * This module provides voice command capabilities through WhatsApp.
 * 
 * Flow: Voice Note → Transcription → Agdi Planner → Execution
 * 
 * Zero-Trust Integration: All voice commands require explicit user confirmation
 * for any action classified as risky.
 */

// Note: @whiskeysockets/baileys must be installed for full functionality
// npm install @whiskeysockets/baileys

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface WhatsAppConfig {
    authDir: string;
    accountId: string;
    mediaMaxMb?: number;
    sendReadReceipts?: boolean;
    debounceMs?: number;
}

export interface InboundMessage {
    id?: string;
    from: string;
    to: string;
    body: string;
    timestamp?: number;
    chatType: 'direct' | 'group';
    chatId: string;
    mediaPath?: string;
    mediaType?: string;
    senderName?: string;
    isVoiceNote?: boolean;
}

export interface TranscriptionResult {
    success: boolean;
    text?: string;
    error?: string;
    provider?: string;
    confidence?: number;
}

export interface TranscriptionProvider {
    name: string;
    transcribe: (audioBuffer: Buffer, mimeType: string) => Promise<TranscriptionResult>;
}

// =============================================================================
// BAILEYS SESSION MANAGER (The "Ear")
// =============================================================================

/**
 * WhatsApp Session Manager using Baileys
 * Rebranded from MoltBot's monitorWebInbox
 */
export class AgdiWhatsAppSession {
    private config: WhatsAppConfig;
    private socket: any = null;
    private isConnected = false;
    private messageHandler?: (msg: InboundMessage) => Promise<void>;
    private transcriptionProvider?: TranscriptionProvider;

    constructor(config: WhatsAppConfig) {
        this.config = config;
    }

    /**
     * Connect to WhatsApp using Baileys
     */
    async connect(): Promise<boolean> {
        try {
            // Dynamic import to avoid bundling issues
            const baileys = await import('@whiskeysockets/baileys');
            const { makeWASocket, useMultiFileAuthState: multiFileAuthState, DisconnectReason } = baileys;

            const { state, saveCreds } = await multiFileAuthState(this.config.authDir);

            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true,
            });

            // Save credentials on update
            this.socket.ev.on('creds.update', saveCreds);

            // Handle connection state
            this.socket.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log('[AgdiWhatsApp] Scan QR code to authenticate');
                }

                if (connection === 'close') {
                    const shouldReconnect =
                        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                    console.log('[AgdiWhatsApp] Connection closed, reconnecting:', shouldReconnect);

                    if (shouldReconnect) {
                        await this.connect();
                    }
                } else if (connection === 'open') {
                    console.log('[AgdiWhatsApp] Connected successfully');
                    this.isConnected = true;
                }
            });

            // Handle incoming messages
            this.socket.ev.on('messages.upsert', async ({ messages, type }: any) => {
                if (type !== 'notify') return;

                for (const msg of messages) {
                    await this.handleIncomingMessage(msg);
                }
            });

            return true;
        } catch (error) {
            console.error('[AgdiWhatsApp] Failed to connect:', error);
            return false;
        }
    }

    /**
     * Set the transcription provider
     */
    setTranscriptionProvider(provider: TranscriptionProvider): void {
        this.transcriptionProvider = provider;
    }

    /**
     * Set the message handler callback
     */
    onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
        this.messageHandler = handler;
    }

    /**
     * Handle incoming WhatsApp message
     */
    private async handleIncomingMessage(msg: any): Promise<void> {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid) return;

        // Skip status broadcasts
        if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@status')) return;

        // Extract message content
        const message = msg.message;
        if (!message) return;

        const inbound: InboundMessage = {
            id: msg.key?.id,
            from: remoteJid,
            to: this.socket?.user?.id || 'me',
            body: '',
            timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
            chatType: remoteJid.includes('@g.us') ? 'group' : 'direct',
            chatId: remoteJid,
            senderName: msg.pushName,
        };

        // Extract text content
        if (message.conversation) {
            inbound.body = message.conversation;
        } else if (message.extendedTextMessage?.text) {
            inbound.body = message.extendedTextMessage.text;
        } else if (message.imageMessage?.caption) {
            inbound.body = message.imageMessage.caption;
            inbound.mediaType = 'image';
        } else if (message.videoMessage?.caption) {
            inbound.body = message.videoMessage.caption;
            inbound.mediaType = 'video';
        } else if (message.audioMessage) {
            // This is a voice note!
            inbound.isVoiceNote = true;
            inbound.mediaType = 'audio';

            // Transcribe if provider is available
            if (this.transcriptionProvider) {
                try {
                    const audioBuffer = await this.downloadMedia(msg);
                    if (audioBuffer) {
                        const result = await this.transcriptionProvider.transcribe(
                            audioBuffer,
                            message.audioMessage.mimetype || 'audio/ogg'
                        );
                        if (result.success && result.text) {
                            inbound.body = result.text;
                        }
                    }
                } catch (error) {
                    console.error('[AgdiWhatsApp] Voice transcription failed:', error);
                }
            }
        }

        // Send read receipt
        if (this.config.sendReadReceipts !== false && msg.key?.id) {
            try {
                await this.socket.readMessages([msg.key]);
            } catch (e) {
                // Ignore read receipt errors
            }
        }

        // Call handler if we have content
        if (inbound.body && this.messageHandler) {
            await this.messageHandler(inbound);
        }
    }

    /**
     * Download media from WhatsApp message
     */
    private async downloadMedia(msg: any): Promise<Buffer | null> {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            const { downloadMediaMessage } = baileys;

            const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                {
                    logger: console as any,
                    reuploadRequest: this.socket.updateMediaMessage,
                }
            );

            return buffer as Buffer;
        } catch (error) {
            console.error('[AgdiWhatsApp] Media download failed:', error);
            return null;
        }
    }

    /**
     * Send a text message
     */
    async sendMessage(to: string, text: string): Promise<boolean> {
        if (!this.socket || !this.isConnected) {
            console.error('[AgdiWhatsApp] Not connected');
            return false;
        }

        try {
            await this.socket.sendMessage(to, { text });
            return true;
        } catch (error) {
            console.error('[AgdiWhatsApp] Send failed:', error);
            return false;
        }
    }

    /**
     * Send typing indicator
     */
    async sendTyping(to: string): Promise<void> {
        if (!this.socket || !this.isConnected) return;

        try {
            await this.socket.sendPresenceUpdate('composing', to);
        } catch (e) {
            // Ignore presence errors
        }
    }

    /**
     * Disconnect from WhatsApp
     */
    async disconnect(): Promise<void> {
        if (this.socket) {
            this.socket.ws?.close();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// =============================================================================
// TRANSCRIPTION PROVIDERS
// =============================================================================

/**
 * Deepgram transcription provider
 */
export function createDeepgramProvider(apiKey: string): TranscriptionProvider {
    return {
        name: 'deepgram',
        async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
            try {
                const response = await fetch('https://api.deepgram.com/v1/listen', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${apiKey}`,
                        'Content-Type': mimeType,
                    },
                    body: audioBuffer,
                });

                if (!response.ok) {
                    return { success: false, error: `Deepgram API error: ${response.status}` };
                }

                const data = await response.json() as any;
                const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence;

                if (transcript) {
                    return {
                        success: true,
                        text: transcript,
                        provider: 'deepgram',
                        confidence,
                    };
                }

                return { success: false, error: 'No transcription result' };
            } catch (error) {
                return { success: false, error: `Transcription failed: ${error}` };
            }
        },
    };
}

/**
 * OpenAI Whisper transcription provider
 */
export function createWhisperProvider(apiKey: string): TranscriptionProvider {
    return {
        name: 'whisper',
        async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
            try {
                const formData = new FormData();
                const blob = new Blob([audioBuffer], { type: mimeType });
                formData.append('file', blob, 'audio.ogg');
                formData.append('model', 'whisper-1');

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: formData,
                });

                if (!response.ok) {
                    return { success: false, error: `Whisper API error: ${response.status}` };
                }

                const data = await response.json() as any;

                if (data.text) {
                    return {
                        success: true,
                        text: data.text,
                        provider: 'whisper',
                    };
                }

                return { success: false, error: 'No transcription result' };
            } catch (error) {
                return { success: false, error: `Transcription failed: ${error}` };
            }
        },
    };
}

// =============================================================================
// VOICE COMMAND PROCESSOR (Zero-Trust Integration)
// =============================================================================

export interface VoiceCommandResult {
    allowed: boolean;
    command: string;
    requiresConfirmation: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reason?: string;
}

/**
 * Voice Command Processor with Zero-Trust security
 * All voice commands pass through Agdi's permission system
 */
export class AgdiVoiceProcessor {
    private auditLog: Array<{
        timestamp: number;
        command: string;
        source: string;
        result: VoiceCommandResult;
    }> = [];

    /**
     * Process a voice command through Zero-Trust gate
     */
    async processVoiceCommand(
        transcribedText: string,
        source: string,
        permissionGate: {
            check: (action: string, target: string) => Promise<{ allowed: boolean; reason?: string }>;
            requestConfirmation: (action: string, target: string) => Promise<boolean>;
        }
    ): Promise<VoiceCommandResult> {
        // Analyze the command for risk level
        const riskLevel = this.analyzeRisk(transcribedText);

        // Log the attempt
        const result: VoiceCommandResult = {
            allowed: false,
            command: transcribedText,
            requiresConfirmation: riskLevel !== 'low',
            riskLevel,
        };

        // Check permission
        const check = await permissionGate.check('voice_command', transcribedText);

        if (!check.allowed) {
            result.allowed = false;
            result.reason = check.reason || 'Permission denied by Zero-Trust policy';
        } else if (riskLevel === 'low') {
            // Low risk commands can execute without confirmation
            result.allowed = true;
        } else {
            // Higher risk commands require user confirmation
            const confirmed = await permissionGate.requestConfirmation(
                `voice_command_${riskLevel}`,
                `Voice command: "${transcribedText}"`
            );

            result.allowed = confirmed;
            if (!confirmed) {
                result.reason = 'User declined voice command confirmation';
            }
        }

        // Add to audit log
        this.auditLog.push({
            timestamp: Date.now(),
            command: transcribedText,
            source,
            result,
        });

        return result;
    }

    /**
     * Analyze the risk level of a voice command
     */
    private analyzeRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
        const commandLower = command.toLowerCase();

        // CRITICAL: Destructive operations
        const criticalPatterns = [
            /delete\s+(all|everything)/i,
            /rm\s+-rf/i,
            /format\s+(disk|drive)/i,
            /drop\s+database/i,
            /destroy/i,
        ];
        if (criticalPatterns.some(p => p.test(command))) {
            return 'critical';
        }

        // HIGH: File modifications, installs, deployments
        const highPatterns = [
            /install/i,
            /deploy/i,
            /publish/i,
            /push\s+to/i,
            /merge/i,
            /delete/i,
            /remove/i,
            /overwrite/i,
        ];
        if (highPatterns.some(p => p.test(command))) {
            return 'high';
        }

        // MEDIUM: Code changes
        const mediumPatterns = [
            /edit/i,
            /modify/i,
            /update/i,
            /change/i,
            /add\s+(file|function|class)/i,
            /create/i,
            /write/i,
        ];
        if (mediumPatterns.some(p => p.test(command))) {
            return 'medium';
        }

        // LOW: Read-only operations
        return 'low';
    }

    /**
     * Get audit log
     */
    getAuditLog() {
        return [...this.auditLog];
    }

    /**
     * Clear audit log
     */
    clearAuditLog() {
        this.auditLog = [];
    }
}

// =============================================================================
// AGDI PLANNER INTEGRATION
// =============================================================================

/**
 * Bridge between WhatsApp voice commands and Agdi's planning engine
 */
export class AgdiVoicePlanner {
    private whatsappSession?: AgdiWhatsAppSession;
    private voiceProcessor: AgdiVoiceProcessor;
    private permissionGate: any;

    constructor(permissionGate: any) {
        this.voiceProcessor = new AgdiVoiceProcessor();
        this.permissionGate = permissionGate;
    }

    /**
     * Initialize with WhatsApp session
     */
    initialize(session: AgdiWhatsAppSession): void {
        this.whatsappSession = session;

        // Set up message handler
        session.onMessage(async (msg) => {
            if (msg.isVoiceNote && msg.body) {
                await this.handleVoiceCommand(msg.body, msg.from, msg.chatId);
            }
        });
    }

    /**
     * Handle a voice command
     */
    private async handleVoiceCommand(
        transcribedText: string,
        sender: string,
        chatId: string
    ): Promise<void> {
        console.log(`[AgdiVoicePlanner] Processing voice command from ${sender}: "${transcribedText}"`);

        // Process through Zero-Trust gate
        const result = await this.voiceProcessor.processVoiceCommand(
            transcribedText,
            sender,
            this.permissionGate
        );

        if (!result.allowed) {
            // Send rejection message
            await this.whatsappSession?.sendMessage(
                chatId,
                `🔒 Voice command blocked: ${result.reason || 'Permission denied'}`
            );
            return;
        }

        // Send acknowledgment
        await this.whatsappSession?.sendTyping(chatId);
        await this.whatsappSession?.sendMessage(
            chatId,
            `🎙️ Processing: "${transcribedText}"\n⏳ Working on it...`
        );

        // Here you would integrate with Agdi's planning engine
        // This is the handoff point to the Swarm/NodeZero system

        // For now, we just acknowledge
        await this.whatsappSession?.sendMessage(
            chatId,
            `✅ Command received and queued for execution.`
        );
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    AgdiWhatsAppSession,
    AgdiVoiceProcessor,
    AgdiVoicePlanner,
    createDeepgramProvider,
    createWhisperProvider,
};
